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
import java.io.*;
import java.util.*;
import javax.persistence.*;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
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
        return clazz(name,parent,1);
    }
    private EnrolmentClass clazz(String name,EnrolmentClass parent,Integer schoolId) {
        EnrolmentClass value=new EnrolmentClass();value.setName(name);value.setSchoolId(schoolId);value.setParent(parent);em.persist(value);return value;
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
    @SuppressWarnings("unchecked") private List<Map<String,Object>> classOptions(){return(List<Map<String,Object>>)speaking.bootstrap().get("classes");}
    private Map<String,Object> option(List<Map<String,Object>> rows,Long id){for(Map<String,Object> row:rows)if(id.equals(row.get("id")))return row;throw new AssertionError("Missing class "+id);}
    private Set<Long> ids(List<Map<String,Object>> rows){Set<Long> result=new HashSet<Long>();for(Map<String,Object> row:rows)result.add(((Number)row.get("id")).longValue());return result;}
    private void viewer(User user){Role role=new Role();role.setName("ROLE_VIEWER");em.persist(role);user.getRoles().add(role);em.flush();}
    private byte[] ownWorkbook(String response)throws Exception{
        try(XSSFWorkbook book=new XSSFWorkbook(new ByteArrayInputStream(answers.selfTemplate(set.getId(),null)));ByteArrayOutputStream out=new ByteArrayOutputStream()){
            book.getSheet("CAU_TRA_LOI").getRow(1).getCell(5).setCellValue(response);book.write(out);return out.toByteArray();
        }
    }
    private WriteRequest ownRow(Long questionId,String html,long revision){WriteRequest row=new WriteRequest();row.questionId=questionId;row.html=html;row.revision=revision;return row;}
    private ImportRequest ownImport(WriteRequest...rows){ImportRequest request=new ImportRequest();request.setId=set.getId();request.rows=Arrays.asList(rows);return request;}
    private ImportRequest classImport(User student,WriteRequest...rows){ImportRequest request=ownImport(rows);request.studentId=student.getId();return request;}
    private byte[] classWorkbook(User student,String response)throws Exception{
        try(XSSFWorkbook book=new XSSFWorkbook(new ByteArrayInputStream(answers.classTemplate(set.getId(),student.getId())));ByteArrayOutputStream out=new ByteArrayOutputStream()){
            book.getSheet("CAU_TRA_LOI").getRow(1).getCell(5).setCellValue(response);book.write(out);return out.toByteArray();
        }
    }
    @SuppressWarnings("unchecked") private List<Map<String,Object>> importRows(Map<String,Object> value){return(List<Map<String,Object>>)value.get("rows");}
    @SuppressWarnings("unchecked") private List<Map<String,Object>> answerRows(Map<String,Object> value){return(List<Map<String,Object>>)value.get("answers");}
    @Test public void adminAndClassAssignedViewerTeacherCanImportOwnAnswersWithoutStudentEnrollment()throws Exception {
        viewer(teacher);assertTrue(speaking.teacher(teacher));assertTrue(teacher.getRoles().stream().noneMatch(role->"ROLE_USER".equals(role.getName())));
        for(User actor:Arrays.asList(admin,teacher)) {
            as(actor);assertTrue(actor.getEnrollmentClassIds().isEmpty());
            byte[] bytes=ownWorkbook("My own response");
            try(XSSFWorkbook book=new XSSFWorkbook(new ByteArrayInputStream(bytes))){
                assertEquals(String.valueOf(actor.getId()),book.getSheet("THONG_TIN").getRow(2).getCell(1).getStringCellValue());
                assertEquals(actor.getUsername(),book.getSheet("THONG_TIN").getRow(3).getCell(1).getStringCellValue());
            }
            Map<String,Object> preview=answers.selfPreview(set.getId(),null,bytes);assertEquals(actor.getId(),preview.get("studentId"));
            Map<String,Object> row=importRows(preview).get(0);assertEquals("NEW",row.get("status"));
            ImportRequest request=ownImport(ownRow(cue.getId(),(String)row.get("html"),((Number)row.get("revision")).longValue()));
            Map<String,Object> ack=answers.selfConfirm(request);assertEquals(actor.getId(),ack.get("studentId"));assertEquals(1,ack.get("saved"));assertEquals(actor.getId(),answerRows(ack).get(0).get("studentId"));
            assertEquals("My own response",answerRows(answers.list(set.getId(),null,cue.getId())).get(0).get("html"));
        }
        assertEquals(0L,(long)em.createQuery("select count(a) from SpeakingStudentAnswer a where a.studentId=:student",Long.class).setParameter("student",collectionOnly.getId()).getSingleResult());
    }
    @Test public void selfImportRejectsForeignTargetsRowsAndWorkbookMetadataBeforeSaving()throws Exception {
        for(User actor:Arrays.asList(admin,teacher)) {
            as(actor);
            try{answers.selfTemplate(set.getId(),collectionOnly.getId());fail();}catch(AccessDeniedException expected){}
            try{answers.selfPreview(set.getId(),collectionOnly.getId(),new byte[]{1});fail();}catch(AccessDeniedException expected){}
            ImportRequest forged=ownImport(ownRow(cue.getId(),"Do not save",0));forged.studentId=collectionOnly.getId();
            try{answers.selfConfirm(forged);fail();}catch(AccessDeniedException expected){}
            forged.studentId=null;forged.rows.get(0).studentId=collectionOnly.getId();
            try{answers.selfConfirm(forged);fail();}catch(IllegalArgumentException expected){}
            forged.rows.get(0).studentId=null;forged.rows.get(0).setId=set.getId()+100000;
            try{answers.selfConfirm(forged);fail();}catch(IllegalArgumentException expected){}
            byte[] own=ownWorkbook("Mine");
            for(int identityRow:new int[]{1,2,3})try(XSSFWorkbook book=new XSSFWorkbook(new ByteArrayInputStream(own));ByteArrayOutputStream out=new ByteArrayOutputStream()){
                book.getSheet("THONG_TIN").getRow(identityRow).getCell(1).setCellValue(identityRow==1?String.valueOf(set.getId()+100000):identityRow==2?String.valueOf(collectionOnly.getId()):collectionOnly.getUsername());book.write(out);
                try{answers.selfPreview(set.getId(),null,out.toByteArray());fail();}catch(IllegalArgumentException expected){}
            }
        }
        assertEquals(0L,(long)em.createQuery("select count(a) from SpeakingStudentAnswer a",Long.class).getSingleResult());
    }
    @Test public void ordinaryStudentsCannotUseAnySelfImportRouteButCanStillEditTheirAnswers()throws Exception {
        viewer(collectionOnly);as(collectionOnly);assertFalse(speaking.teacher(collectionOnly));
        try{answers.selfTemplate(set.getId(),null);fail();}catch(AccessDeniedException expected){}
        try{answers.selfPreview(set.getId(),null,new byte[]{1});fail();}catch(AccessDeniedException expected){}
        try{answers.selfConfirm(null);fail();}catch(AccessDeniedException expected){}
        WriteRequest write=ownRow(cue.getId(),"I can edit manually",0);write.setId=set.getId();write.studentId=collectionOnly.getId();assertEquals(collectionOnly.getId(),answers.save(write).get("studentId"));
    }
    @Test public void teacherSelfImportPreflightsAllRevisionsAndRetriesWithoutDuplicateHistory()throws Exception {
        as(teacher);answers.selfConfirm(ownImport(ownRow(cue.getId(),"Original",0),ownRow(followup.getId(),"Existing",0)));
        ImportRequest stale=ownImport(ownRow(cue.getId(),"Do not partly save",1),ownRow(followup.getId(),"Stale",0));
        try{answers.selfConfirm(stale);fail();}catch(SpeakingStudentAnswerService.Conflict expected){}
        assertEquals("Original",answerRows(answers.list(set.getId(),null,cue.getId())).get(0).get("html"));
        ImportRequest good=ownImport(ownRow(cue.getId(),"Updated",1),ownRow(followup.getId(),"Updated followup",1));good.studentId=teacher.getId();
        Map<String,Object> ack=answers.selfConfirm(good);assertEquals(teacher.getId(),ack.get("studentId"));assertEquals(2,ack.get("saved"));
        long history=em.createQuery("select count(v) from SpeakingStudentAnswerVersion v",Long.class).getSingleResult();
        assertEquals(2,answers.selfConfirm(good).get("saved"));assertEquals(history,(long)em.createQuery("select count(v) from SpeakingStudentAnswerVersion v",Long.class).getSingleResult());
        assertEquals(2L,answerRows(answers.list(set.getId(),null,cue.getId())).get(0).get("revision"));
    }
    @Test public void selfImportPreservesNotebookSamplesAndPassAndRecordsImportCheckpoint()throws Exception {
        as(teacher);NotebookRequest paper=new NotebookRequest();paper.setId=set.getId();paper.studentId=teacher.getId();paper.questionId=cue.getId();paper.revision=0L;
        paper.document=SpeakingServiceImpl.map("text","My paper notes","orientation","portrait","pattern","lined","strokes",new ArrayList<Object>());answers.saveNotebook(paper);
        Map<String,Object> row=importRows(answers.selfPreview(set.getId(),null,ownWorkbook("New own text"))).get(0);
        ImportRequest request=ownImport(ownRow(cue.getId(),(String)row.get("html"),((Number)row.get("revision")).longValue()));answers.selfConfirm(request);
        assertEquals(paper.document,answers.notebook(set.getId(),null,cue.getId(),null).get("document"));
        @SuppressWarnings("unchecked") List<Map<String,Object>> history=(List<Map<String,Object>>)answers.history(set.getId(),null,cue.getId()).get("versions");assertEquals("IMPORT",history.get(0).get("source"));
        assertEquals(0L,(long)em.createQuery("select count(p) from SpeakingPass p",Long.class).getSingleResult());assertNull(em.find(SpeakingQuestion.class,cue.getId()).getSample());
    }
    @Test public void primaryTeacherIdAloneEnablesOwnClassImportAndViewForBothStudentMembershipForms()throws Exception {
        parent.getTeachers().clear();parent.setPrimaryTeacherId(teacher.getId());child.setPrimaryTeacherId(teacher.getId());viewer(teacher);as(teacher);
        assertTrue(speaking.teacher(teacher));assertEquals(true,speaking.bootstrap().get("canManage"));assertEquals(true,speaking.bootstrap().get("canImportStudentAnswers"));
        @SuppressWarnings("unchecked") List<Map<String,Object>> importClasses=(List<Map<String,Object>>)speaking.bootstrap().get("importClasses");assertEquals(new HashSet<Long>(Arrays.asList(parent.getId(),child.getId())),ids(importClasses));
        for(User target:Arrays.asList(collectionOnly,legacyOnly)) {
            Map<String,Object> preview=answers.classPreview(set.getId(),target.getId(),classWorkbook(target,"Primary teacher import"));assertEquals(target.getId(),preview.get("studentId"));
            Map<String,Object> row=importRows(preview).get(0);Map<String,Object> ack=answers.classConfirm(classImport(target,ownRow(cue.getId(),(String)row.get("html"),((Number)row.get("revision")).longValue())));
            assertEquals(target.getId(),ack.get("studentId"));assertEquals("Primary teacher import",answerRows(answers.list(set.getId(),target.getId(),cue.getId())).get(0).get("html"));
        }
        for(Map<String,Object> row:students(answers.classStudents(set.getId(),parent.getId(),"",0,25)))assertEquals(true,row.get("canImport"));
    }
    @Test public void secondaryTeachersAndOrdinaryStudentsCannotImportClassAnswers()throws Exception {
        User primary=user("Primary");parent.setPrimaryTeacherId(primary.getId());child.setPrimaryTeacherId(primary.getId());as(teacher);
        assertTrue(speaking.teacher(teacher));assertTrue(speaking.canReviewStudents(set,teacher));assertEquals(collectionOnly.getId(),speaking.reviewableStudent(set,collectionOnly.getId()).getId());
        @SuppressWarnings("unchecked") List<Map<String,Object>> options=(List<Map<String,Object>>)speaking.bootstrap().get("importClasses");assertTrue(options.isEmpty());assertEquals(false,speaking.bootstrap().get("canImportStudentAnswers"));
        for(User actor:Arrays.asList(teacher,collectionOnly)) {
            as(actor);try{answers.classStudents(set.getId(),parent.getId(),"",0,25);fail();}catch(AccessDeniedException expected){}
            try{answers.classTemplate(set.getId(),collectionOnly.getId());fail();}catch(AccessDeniedException expected){}
            try{answers.classPreview(set.getId(),collectionOnly.getId(),new byte[]{1});fail();}catch(AccessDeniedException expected){}
            try{answers.classConfirm(classImport(collectionOnly,ownRow(cue.getId(),"Forbidden",0)));fail();}catch(AccessDeniedException expected){}
        }
        assertEquals(0L,(long)em.createQuery("select count(a) from SpeakingStudentAnswer a",Long.class).getSingleResult());
    }
    @Test public void classImportRequiresActiveDirectMembershipInSchoolOneNotAnAncestorOrForeignBridge()throws Exception {
        parent.setPrimaryTeacherId(teacher.getId());EnrolmentClass foreign=clazz("Foreign",parent,2),unknown=clazz("Unknown",parent,null);foreign.setPrimaryTeacherId(teacher.getId());unknown.setPrimaryTeacherId(teacher.getId());
        User foreignStudent=user("Foreign",foreign.getId()),unknownStudent=user("Unknown",unknown.getId());as(teacher);
        for(User target:Arrays.asList(collectionOnly,legacyOnly,outside,inactive,foreignStudent,unknownStudent))try{answers.classTemplate(set.getId(),target.getId());fail();}catch(AccessDeniedException expected){}
        // A direct extra class is sufficient; no Person association is required.
        assertNotNull(answers.classTemplate(set.getId(),duplicate.getId()));
        EnrolmentClass ownedChild=clazz("Owned child",parent);ownedChild.setPrimaryTeacherId(teacher.getId());User valid=user("Valid child",ownedChild.getId());
        EnrolmentClass bridge=clazz("Other primary bridge",parent);bridge.setPrimaryTeacherId(admin.getId());EnrolmentClass behind=clazz("Owned behind bridge",bridge);behind.setPrimaryTeacherId(teacher.getId());User independent=user("Independent",behind.getId());em.flush();
        assertEquals(new HashSet<Long>(Arrays.asList(duplicate.getId(),valid.getId())),ids(students(answers.classStudents(set.getId(),parent.getId(),"",0,25))));
        assertEquals(Collections.singleton(independent.getId()),ids(students(answers.classStudents(set.getId(),behind.getId(),"",0,25))));
        assertNotNull(answers.classTemplate(set.getId(),independent.getId()));
        try{answers.classStudents(set.getId(),child.getId(),"",0,25);fail();}catch(AccessDeniedException expected){}
        try{answers.classStudents(set.getId(),foreign.getId(),"",0,25);fail();}catch(AccessDeniedException expected){}
        try{answers.classStudents(set.getId(),parent.getId(),"",-1,25);fail();}catch(IllegalArgumentException expected){}
    }
    @Test public void classImportRechecksPrimaryAssignmentAndStudentMembershipAfterPreview()throws Exception {
        parent.setPrimaryTeacherId(teacher.getId());child.setPrimaryTeacherId(teacher.getId());as(teacher);
        Map<String,Object> row=importRows(answers.classPreview(set.getId(),collectionOnly.getId(),classWorkbook(collectionOnly,"Pending"))).get(0);
        ImportRequest request=classImport(collectionOnly,ownRow(cue.getId(),(String)row.get("html"),((Number)row.get("revision")).longValue()));
        child.setPrimaryTeacherId(admin.getId());em.flush();try{answers.classConfirm(request);fail();}catch(AccessDeniedException expected){}
        child.setPrimaryTeacherId(teacher.getId());collectionOnly.getEnrollmentClassIds().clear();collectionOnly.getEnrollmentClassIds().add(otherClass.getId());em.flush();
        try{answers.classConfirm(request);fail();}catch(AccessDeniedException expected){}
        assertEquals(0L,(long)em.createQuery("select count(a) from SpeakingStudentAnswer a",Long.class).getSingleResult());
    }
    @Test public void classImportCannotSmuggleAnotherStudentThroughWorkbookOrNestedRows()throws Exception {
        byte[] foreign;
        as(admin);try(XSSFWorkbook book=new XSSFWorkbook(new ByteArrayInputStream(answers.template(set.getId(),outside.getId())));ByteArrayOutputStream out=new ByteArrayOutputStream()){
            book.getSheet("CAU_TRA_LOI").getRow(1).getCell(5).setCellValue("Someone else's answer");book.write(out);foreign=out.toByteArray();
        }
        parent.setPrimaryTeacherId(teacher.getId());child.setPrimaryTeacherId(teacher.getId());as(teacher);
        try{answers.classPreview(set.getId(),collectionOnly.getId(),foreign);fail();}catch(IllegalArgumentException expected){}
        ImportRequest forged=classImport(collectionOnly,ownRow(cue.getId(),"Forged",0));forged.rows.get(0).studentId=outside.getId();
        try{answers.classConfirm(forged);fail();}catch(IllegalArgumentException expected){}
        forged.rows.get(0).studentId=null;forged.rows.get(0).setId=set.getId()+100000;
        try{answers.classConfirm(forged);fail();}catch(IllegalArgumentException expected){}
        assertEquals(0L,(long)em.createQuery("select count(a) from SpeakingStudentAnswer a",Long.class).getSingleResult());
    }
    @Test public void primaryIdOnlyDoesNotInheritChildViewRightsWhileLegacyTeacherReviewStaysUnchanged()throws Exception {
        parent.getTeachers().clear();parent.setPrimaryTeacherId(teacher.getId());child.setPrimaryTeacherId(admin.getId());viewer(teacher);as(teacher);
        assertTrue(speaking.teacher(teacher));assertTrue(speaking.canReviewStudents(set,teacher));
        try{speaking.bank(set.getId(),collectionOnly.getId());fail();}catch(AccessDeniedException expected){}
        try{answers.list(set.getId(),collectionOnly.getId(),cue.getId());fail();}catch(AccessDeniedException expected){}
        assertTrue(speaking.students(set.getId(),collectionOnly.getUsername()).isEmpty());
        assertNotNull(speaking.bank(set.getId(),duplicate.getId()));
        assertEquals(Collections.singleton(parent.getId()),ids(classOptions()));
        // Existing teachers-set assignment retains the previous ancestor review
        // authority, but never grants the new primary-only import permission.
        parent.getTeachers().add(teacher);em.flush();assertNotNull(speaking.bank(set.getId(),collectionOnly.getId()));
        try{answers.classTemplate(set.getId(),collectionOnly.getId());fail();}catch(AccessDeniedException expected){}
    }
    @Test public void privateBankAccessAndPrimaryClassScopeAreBothRequiredWithoutLeakingOtherLearners()throws Exception {
        parent.setPrimaryTeacherId(teacher.getId());child.setPrimaryTeacherId(teacher.getId());set.setOwnerId(outside.getId());cue.setOwnerId(outside.getId());followup.setOwnerId(outside.getId());
        set.setStudentIdsJson("["+teacher.getId()+","+collectionOnly.getId()+","+outside.getId()+"]");em.flush();as(teacher);
        assertTrue(speaking.canReviewStudents(set,teacher));assertNotNull(answers.classTemplate(set.getId(),collectionOnly.getId()));assertEquals(collectionOnly.getId(),speaking.reviewableStudent(set,collectionOnly.getId()).getId());
        try{answers.list(set.getId(),outside.getId(),cue.getId());fail();}catch(AccessDeniedException expected){}
        try{answers.classTemplate(set.getId(),outside.getId());fail();}catch(AccessDeniedException expected){}
        assertTrue(speaking.students(set.getId(),outside.getUsername()).isEmpty());
        set.setStudentIdsJson("["+teacher.getId()+"]");em.flush();try{answers.classTemplate(set.getId(),collectionOnly.getId());fail();}catch(AccessDeniedException expected){}
        set.setStudentIdsJson("["+collectionOnly.getId()+"]");em.flush();try{answers.classTemplate(set.getId(),collectionOnly.getId());fail();}catch(AccessDeniedException expected){}
        // Owning the question bank does not permit importing a learner outside the teacher's primary classes.
        set.setOwnerId(teacher.getId());cue.setOwnerId(teacher.getId());followup.setOwnerId(teacher.getId());set.setStudentIdsJson("["+outside.getId()+"]");em.flush();
        assertEquals(outside.getId(),speaking.reviewableStudent(set,outside.getId()).getId());try{answers.classTemplate(set.getId(),outside.getId());fail();}catch(AccessDeniedException expected){}
    }
    @Test public void rosterUsesCurrentDirectoryNameAndSearchInsteadOfStaleDisplayName() {
        Person person=legacyOnly.getPerson();person.setLastName("Thái");person.setFirstName("Hà");person.setDisplayName("Minh Châu | Grade 11");em.flush();
        Map<String,Object> row=students(speaking.adminStudents(set.getId(),parent.getId(),legacyOnly.getUsername(),0,25)).get(0);
        assertEquals("Thái Hà",row.get("name"));
        assertEquals(Collections.singleton(legacyOnly.getId()),ids(students(speaking.adminStudents(set.getId(),parent.getId(),"THÁI HÀ",0,25))));
        assertTrue(students(speaking.adminStudents(set.getId(),parent.getId(),"Minh Châu",0,25)).isEmpty());
        person.setLastName(null);person.setFirstName("  Hà  ");assertEquals("Hà",speaking.displayName(legacyOnly));
        person.setFirstName(" ");assertEquals(legacyOnly.getUsername(),speaking.displayName(legacyOnly));assertEquals(collectionOnly.getUsername(),speaking.displayName(collectionOnly));
    }
    @Test public void inactiveAccountsAreExcludedFromBothLegacyAndAdditionalClassMemberships() {
        legacyOnly.setActive(false);collectionOnly.setActive(false);em.flush();
        assertEquals(Collections.singleton(duplicate.getId()),ids(students(speaking.adminStudents(set.getId(),parent.getId(),"",0,25))));
        assertTrue(students(speaking.adminStudents(set.getId(),parent.getId(),inactive.getUsername(),0,25)).isEmpty());
        assertTrue(students(speaking.adminStudents(set.getId(),parent.getId(),legacyOnly.getUsername(),0,25)).isEmpty());
        assertTrue(students(speaking.adminStudents(set.getId(),parent.getId(),collectionOnly.getUsername(),0,25)).isEmpty());
        set.setStudentIdsJson("["+inactive.getId()+","+legacyOnly.getId()+"]");
        assertTrue(speaking.students(set.getId(),inactive.getUsername()).isEmpty());
        assertTrue(speaking.students(set.getId(),legacyOnly.getUsername()).isEmpty());
    }
    @Test public void bootstrapOnlyOffersIeltsRoomClassesWithVisibleTreeParents() {
        parent.setCode("IELTS-ROOT");EnrolmentClass foreign=clazz("Foreign",parent,2),unknown=clazz("Unknown",parent,null),orphan=clazz("IELTS below foreign",foreign);
        em.flush();List<Map<String,Object>> options=classOptions();
        assertEquals(new HashSet<Long>(Arrays.asList(parent.getId(),child.getId(),otherClass.getId(),orphan.getId())),ids(options));
        assertNull(option(options,parent.getId()).get("parentId"));assertEquals("IELTS-ROOT",option(options,parent.getId()).get("code"));
        assertEquals(parent.getId(),option(options,child.getId()).get("parentId"));assertNull(option(options,orphan.getId()).get("parentId"));
        for(Map<String,Object> row:options)assertEquals(1,row.get("schoolId"));assertFalse(ids(options).contains(unknown.getId()));
    }
    @Test public void bootstrapRetainsTeacherClassAuthorizationAndRootsClassesWhoseParentIsHidden() {
        EnrolmentClass foreign=clazz("Foreign managed branch",parent,2),orphan=clazz("Managed IELTS below foreign",foreign);
        EnrolmentClass separatelyManaged=clazz("Separately managed",otherClass);separatelyManaged.getTeachers().add(teacher);
        em.flush();as(teacher);List<Map<String,Object>> options=classOptions();
        assertEquals(new HashSet<Long>(Arrays.asList(parent.getId(),child.getId(),orphan.getId(),separatelyManaged.getId())),ids(options));
        assertEquals(parent.getId(),option(options,child.getId()).get("parentId"));assertNull(option(options,orphan.getId()).get("parentId"));assertNull(option(options,separatelyManaged.getId()).get("parentId"));
        as(collectionOnly);assertTrue(classOptions().isEmpty());
    }
    @Test public void rosterRejectsForeignOrUnknownSchoolsAndStopsAtForeignDescendantBranches() {
        EnrolmentClass foreign=clazz("Foreign branch",parent,2),unknown=clazz("Unknown branch",parent,null);
        EnrolmentClass behindForeign=clazz("IELTS behind foreign",foreign),behindUnknown=clazz("IELTS behind unknown",unknown),validChild=clazz("Valid independent child",behindForeign);
        user("Foreign member",foreign.getId());user("Unknown member",unknown.getId());User independent=user("Independent",behindForeign.getId()),independentChild=user("Independent child",validChild.getId());user("Hidden through unknown",behindUnknown.getId());
        User legacyForeign=user("Legacy foreign");Person person=new Person();person.setDisplayName("Legacy foreign");person.setEnrollmentClassId(foreign.getId().intValue());person.setUser(legacyForeign);legacyForeign.setPerson(person);em.persist(person);em.flush();
        for(Long id:Arrays.asList(foreign.getId(),unknown.getId()))try{speaking.adminStudents(set.getId(),id,"",0,25);fail("Non-IELTSRoom class accepted");}catch(IllegalArgumentException expected){}
        assertEquals(new HashSet<Long>(Arrays.asList(collectionOnly.getId(),legacyOnly.getId(),duplicate.getId())),ids(students(speaking.adminStudents(set.getId(),parent.getId(),"",0,25))));
        assertEquals(new HashSet<Long>(Arrays.asList(independent.getId(),independentChild.getId())),ids(students(speaking.adminStudents(set.getId(),behindForeign.getId(),"",0,25))));
    }
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
    @Test public void studentImportRoutesRemainAdminOnlyAndManualEditingRemainsAvailable()throws Exception {
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
        assertNull(RestSpeakingStudentAnswerController.class.getMethod("selfTemplate",Long.class,Long.class).getAnnotation(Secured.class));
        assertNull(RestSpeakingStudentAnswerController.class.getMethod("selfPreview",Long.class,Long.class,MultipartFile.class).getAnnotation(Secured.class));
        assertNull(RestSpeakingStudentAnswerController.class.getMethod("selfConfirm",ImportRequest.class).getAnnotation(Secured.class));
        assertNull(RestSpeakingStudentAnswerController.class.getMethod("classTemplate",Long.class,Long.class).getAnnotation(Secured.class));
        assertNull(RestSpeakingStudentAnswerController.class.getMethod("classPreview",Long.class,Long.class,MultipartFile.class).getAnnotation(Secured.class));
        assertNull(RestSpeakingStudentAnswerController.class.getMethod("classConfirm",ImportRequest.class).getAnnotation(Secured.class));
        assertTrue(Arrays.asList(RestSpeakingStudentAnswerController.class.getAnnotation(Secured.class).value()).contains("ROLE_VIEWER"));
        assertNull(RestSpeakingStudentAnswerController.class.getMethod("save",WriteRequest.class).getAnnotation(Secured.class));
    }
}
