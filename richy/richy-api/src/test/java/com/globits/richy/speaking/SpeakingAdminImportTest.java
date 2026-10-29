package com.globits.richy.speaking;

import com.globits.core.domain.Person;
import com.globits.richy.domain.*;
import com.globits.richy.dto.SpeakingStudentAnswerDto.*;
import com.globits.richy.repository.EnrolmentClassRepository;
import com.globits.richy.rest.RestSpeakingController;
import com.globits.richy.rest.RestSpeakingStudentAnswerController;
import com.globits.richy.service.impl.*;
import com.globits.security.domain.Role;
import com.globits.security.domain.User;
import com.globits.security.repository.UserRepository;
import java.io.File;
import java.util.*;
import javax.persistence.*;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.annotation.Secured;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.multipart.MultipartFile;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

/** Real roster JPQL and authorization against isolated H2, including legacy Person memberships. */
public class SpeakingAdminImportTest {
    private static SessionFactory factory;
    private EntityManager em;
    private SpeakingServiceImpl speaking;
    private SpeakingStudentAnswerService answers;
    private User admin,teacher,collectionOnly,legacyOnly,duplicate,outside,inactive;
    private EnrolmentClass parent,child,otherClass;
    private SpeakingSet set;
    private SpeakingQuestion cue,followup;
    private static void register(Configuration cfg,Class<?> sample,String name)throws Exception {
        File directory=new File(new File(sample.getProtectionDomain().getCodeSource().getLocation().toURI()),name.replace('.','/'));
        for(File file:Objects.requireNonNull(directory.listFiles()))if(file.getName().endsWith(".class")&&!file.getName().contains("$")) {
            Class<?> type=Class.forName(name+"."+file.getName().replace(".class",""));if(type.isAnnotationPresent(Entity.class))cfg.addAnnotatedClass(type);
        }
    }
    @BeforeClass public static void database()throws Exception {
        org.h2.jdbcx.JdbcDataSource ds=new org.h2.jdbcx.JdbcDataSource();ds.setURL("jdbc:h2:mem:speaking_admin_roster;MODE=MSSQLServer;DB_CLOSE_DELAY=-1");
        try(java.sql.Connection c=ds.getConnection();java.sql.Statement s=c.createStatement()){s.execute("CREATE SCHEMA dbo");}
        Configuration cfg=new Configuration().setProperty("hibernate.default_schema","dbo").setProperty("hibernate.dialect","org.hibernate.dialect.H2Dialect")
            .setProperty("hibernate.hbm2ddl.auto","create-drop").setProperty("hibernate.show_sql","false").setProperty("hibernate.temp.use_jdbc_metadata_defaults","false").setProperty("hibernate.hbm2ddl.halt_on_error","true");
        cfg.getProperties().put("hibernate.connection.datasource",ds);
        register(cfg,Topic.class,"com.globits.richy.domain");register(cfg,Person.class,"com.globits.core.domain");register(cfg,User.class,"com.globits.security.domain");factory=cfg.buildSessionFactory();
    }
    @AfterClass public static void close(){if(factory!=null)factory.close();}
    private User user(String name,Long...classes) {
        User user=new User();user.setUsername(name+UUID.randomUUID());user.setPassword("unused");user.setEmail(user.getUsername()+"@example.invalid");user.setActive(true);
        user.setEnrollmentClassIds(new HashSet<Long>(Arrays.asList(classes)));em.persist(user);return user;
    }
    private EnrolmentClass clazz(String name,EnrolmentClass parent) {
        EnrolmentClass value=new EnrolmentClass();value.setName(name);value.setSchoolId(1);value.setParent(parent);em.persist(value);return value;
    }
    private void as(User actor){SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(actor,"",Collections.emptyList()));}
    private SpeakingQuestion question(int part) {
        SpeakingQuestion q=new SpeakingQuestion();q.setOwnerId(admin.getId());q.setPart(part);q.setTopic("Topic");q.setPrompt("Prompt");q.setContentKey(UUID.randomUUID().toString());em.persist(q);
        entry(q);return q;
    }
    private void entry(SpeakingQuestion q){SpeakingSetEntry entry=new SpeakingSetEntry();entry.setSetId(set.getId());entry.setQuestionId(q.getId());entry.setEntryKey(UUID.randomUUID().toString());entry.setImportCode("Q"+q.getId());em.persist(entry);}
    private void answer(User user,SpeakingQuestion q) {
        SpeakingStudentAnswer value=new SpeakingStudentAnswer();value.setStudentId(user.getId());value.setQuestionId(q.getId());value.setEditorId(admin.getId());value.setHtml("<p>Saved</p>");value.setNotesJson("[]");em.persist(value);
    }
    @Before public void fixture() {
        em=factory.createEntityManager();em.getTransaction().begin();admin=user("admin");teacher=user("teacher");Role role=new Role();role.setName("ROLE_ADMIN");em.persist(role);admin.getRoles().add(role);
        parent=clazz("Parent",null);child=clazz("Child",parent);otherClass=clazz("Outside",null);parent.getTeachers().add(teacher);
        collectionOnly=user("Collection",child.getId());legacyOnly=user("Legacy");duplicate=user("Duplicate",parent.getId(),child.getId());outside=user("Outside",otherClass.getId());inactive=user("Inactive",child.getId());inactive.setActive(false);
        Person person=new Person();person.setDisplayName("Legacy person");person.setEnrollmentClassId(child.getId().intValue());person.setUser(legacyOnly);legacyOnly.setPerson(person);em.persist(person);
        set=new SpeakingSet();set.setOwnerId(admin.getId());set.setSeasonYear(2026);set.setSetNumber(1);set.setName("Common");set.setClassIdsJson("[]");set.setStudentIdsJson("[]");em.persist(set);cue=question(2);followup=question(3);em.flush();
        UserRepository users=mock(UserRepository.class);when(users.findByUsernameAndPerson(anyString())).thenAnswer(c->em.createQuery("select u from User u where u.username=:name",User.class).setParameter("name",c.getArguments()[0]).getSingleResult());when(users.findOne(anyLong())).thenAnswer(c->em.find(User.class,c.getArguments()[0]));
        EnrolmentClassRepository classes=mock(EnrolmentClassRepository.class);when(classes.findAll()).thenAnswer(c->em.createQuery("select c from EnrolmentClass c",EnrolmentClass.class).getResultList());when(classes.findOne(anyLong())).thenAnswer(c->em.find(EnrolmentClass.class,c.getArguments()[0]));
        speaking=new SpeakingServiceImpl();ReflectionTestUtils.setField(speaking,"em",em);ReflectionTestUtils.setField(speaking,"users",users);ReflectionTestUtils.setField(speaking,"classes",classes);
        answers=new SpeakingStudentAnswerService();ReflectionTestUtils.setField(answers,"em",em);ReflectionTestUtils.setField(answers,"speaking",speaking);as(admin);
    }
    @After public void cleanup(){SecurityContextHolder.clearContext();if(em!=null){if(em.getTransaction().isActive())em.getTransaction().rollback();em.close();}}
    @SuppressWarnings("unchecked") private List<Map<String,Object>> students(Map<String,Object> result){return(List<Map<String,Object>>)result.get("students");}
    private Set<Long> ids(List<Map<String,Object>> rows){Set<Long> result=new HashSet<Long>();for(Map<String,Object> row:rows)result.add(((Number)row.get("id")).longValue());return result;}
    @Test public void rosterIncludesBothMembershipFormsDescendantsAndDeduplicatesBeforePaging() {
        Map<String,Object> roster=speaking.adminStudents(set.getId(),parent.getId(),"",0,25);
        assertEquals(3,roster.get("total"));assertEquals(new HashSet<Long>(Arrays.asList(collectionOnly.getId(),legacyOnly.getId(),duplicate.getId())),ids(students(roster)));
        assertTrue(speaking.adminStudents(set.getId(),parent.getId(),outside.getUsername(),0,25).get("students") instanceof List);
        assertTrue(students(speaking.adminStudents(set.getId(),parent.getId(),outside.getUsername(),0,25)).isEmpty());
        assertEquals(new HashSet<Long>(Arrays.asList(collectionOnly.getId(),legacyOnly.getId(),duplicate.getId())),ids(students(speaking.adminStudents(set.getId(),child.getId(),"",0,25))));
    }
    @Test public void rosterSearchAndPaginationDoNotTruncateAtTwoHundredStudents() {
        for(int index=0;index<207;index++)user(String.format("Page%03d",index),child.getId());em.flush();
        Map<String,Object> result=speaking.adminStudents(set.getId(),parent.getId(),"Page",8,25);assertEquals(207,result.get("total"));assertEquals(7,students(result).size());assertEquals(8,result.get("page"));assertEquals(25,result.get("pageSize"));
        assertTrue(students(speaking.adminStudents(set.getId(),parent.getId(),"Page",9,25)).isEmpty());
    }
    @Test public void summaryCountsCanonicalAnswersOnceAndViewPointsToAQuestionInTheSelectedSet() {
        answer(collectionOnly,cue);answer(collectionOnly,followup);entry(cue);
        SpeakingQuestion elsewhere=question(1);em.remove(em.createQuery("select e from SpeakingSetEntry e where e.questionId=:q",SpeakingSetEntry.class).setParameter("q",elsewhere.getId()).getSingleResult());answer(collectionOnly,elsewhere);em.flush();
        Map<String,Object> row=students(speaking.adminStudents(set.getId(),parent.getId(),collectionOnly.getUsername(),0,25)).get(0);
        assertEquals(2L,row.get("answerCount"));assertEquals(cue.getId(),row.get("firstAnswerQuestionId"));assertEquals(2,row.get("firstAnswerPart"));assertEquals(true,row.get("canAccess"));
        row=students(speaking.adminStudents(set.getId(),parent.getId(),legacyOnly.getUsername(),0,25)).get(0);assertEquals(0L,row.get("answerCount"));assertNull(row.get("firstAnswerQuestionId"));assertNull(row.get("firstAnswerPart"));
    }
    @Test public void nonAdminsCannotImportEvenIntoTheirOwnAnswersButCanStillEditDirectly()throws Exception {
        for(User actor:Arrays.asList(collectionOnly,teacher)) {
            as(actor);try{answers.template(set.getId(),collectionOnly.getId());fail();}catch(AccessDeniedException expected){}
            try{answers.preview(set.getId(),collectionOnly.getId(),new byte[]{1});fail();}catch(AccessDeniedException expected){}
            try{answers.confirm(null);fail();}catch(AccessDeniedException expected){}
            try{speaking.adminStudents(set.getId(),parent.getId(),"",0,25);fail();}catch(AccessDeniedException expected){}
        }
        as(collectionOnly);WriteRequest request=new WriteRequest();request.setId=set.getId();request.studentId=collectionOnly.getId();request.questionId=cue.getId();request.html="<b>My edited answer</b>";request.revision=0L;Map<String,Object> ack=answers.save(request);assertEquals(1L,ack.get("revision"));
        as(teacher);request.html="<u>Teacher correction</u>";request.revision=1L;ack=answers.save(request);assertEquals(2L,ack.get("revision"));assertEquals(teacher.getId(),ack.get("editorId"));
    }
    @Test public void rosterRequiresARealClassAndDoesNotBroadenPrivateBankReview() {
        for(Long id:Arrays.asList(null,0L,999999L))try{speaking.adminStudents(set.getId(),id,"",0,25);fail();}catch(IllegalArgumentException expected){}
        try{speaking.adminStudents(set.getId(),parent.getId(),"",-1,25);fail();}catch(IllegalArgumentException expected){}
        try{speaking.adminStudents(set.getId(),parent.getId(),"",0,101);fail();}catch(IllegalArgumentException expected){}
        set.setOwnerId(teacher.getId());set.setStudentIdsJson("["+admin.getId()+"]");em.flush();assertTrue(speaking.canRead(set,admin));
        try{speaking.adminStudents(set.getId(),parent.getId(),"",0,25);fail();}catch(AccessDeniedException expected){}
    }
    @Test public void importRoutesHaveAdminMethodSecurityAndManualEditingDoesNot()throws Exception {
        assertArrayEquals(new String[]{"ROLE_ADMIN"},RestSpeakingController.class.getMethod("preview",Long.class,MultipartFile.class).getAnnotation(Secured.class).value());
        assertArrayEquals(new String[]{"ROLE_ADMIN"},RestSpeakingController.class.getMethod("confirm",Long.class,com.globits.richy.dto.SpeakingDto.ConfirmImport.class).getAnnotation(Secured.class).value());
        assertArrayEquals(new String[]{"ROLE_ADMIN"},RestSpeakingStudentAnswerController.class.getMethod("template",Long.class,Long.class).getAnnotation(Secured.class).value());
        assertArrayEquals(new String[]{"ROLE_ADMIN"},RestSpeakingStudentAnswerController.class.getMethod("preview",Long.class,Long.class,MultipartFile.class).getAnnotation(Secured.class).value());
        assertArrayEquals(new String[]{"ROLE_ADMIN"},RestSpeakingStudentAnswerController.class.getMethod("confirm",ImportRequest.class).getAnnotation(Secured.class).value());
        assertNull(RestSpeakingStudentAnswerController.class.getMethod("save",WriteRequest.class).getAnnotation(Secured.class));
    }
}
