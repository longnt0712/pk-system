package com.globits.richy.tntt;

import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import com.globits.richy.domain.EducationProgram;
import com.globits.richy.domain.School;
import com.globits.richy.dto.EducationProgramDto;
import com.globits.richy.repository.EducationProgramRepository;
import com.globits.richy.service.impl.EducationProgramServiceImpl;
import com.globits.richy.service.impl.SchoolAccess;
import com.globits.richy.service.impl.SchoolService;
import com.globits.security.domain.User;
import java.util.*;
import java.util.concurrent.*;
import javax.persistence.*;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.joda.time.LocalDateTime;
import org.junit.*;
import org.springframework.data.domain.Page;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

public class EducationProgramMainTest {
    private static SessionFactory factory;
    private EntityManager em;
    private EducationProgramServiceImpl service;
    @BeforeClass public static void database() throws Exception {
        org.h2.jdbcx.JdbcDataSource ds=new org.h2.jdbcx.JdbcDataSource();
        ds.setURL("jdbc:h2:mem:education_main;MODE=MSSQLServer;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=8000");
        try(java.sql.Connection c=ds.getConnection();java.sql.Statement s=c.createStatement()){
            s.execute("CREATE SCHEMA dbo");
            s.execute("CREATE TABLE dbo.tbl_user(id BIGINT PRIMARY KEY,username VARCHAR(100),active BIT)");
            s.execute("CREATE TABLE dbo.tbl_role(id BIGINT PRIMARY KEY,role_name VARCHAR(150))");
            s.execute("CREATE TABLE dbo.tbl_school_user_role(school_id BIGINT,user_id BIGINT,role_id BIGINT)");
            s.execute("INSERT INTO dbo.tbl_user VALUES(1,'main-test',1)");
            s.execute("INSERT INTO dbo.tbl_role VALUES(1,'ROLE_EDUCATION_MANAGERMENT'),(2,'ROLE_STUDENT_MANAGERMENT')");
        }
        Configuration cfg=new Configuration().addAnnotatedClass(EducationProgram.class).addAnnotatedClass(School.class)
            .setProperty("hibernate.default_schema","dbo").setProperty("hibernate.dialect","org.hibernate.dialect.H2Dialect")
            .setProperty("hibernate.hbm2ddl.auto","create-drop").setProperty("hibernate.show_sql","false");
        cfg.getProperties().put("hibernate.connection.datasource",ds);factory=cfg.buildSessionFactory();
    }
    @AfterClass public static void shutdown(){if(factory!=null)factory.close();}
    private static void actor(){User user=new User();user.setUsername("main-test");SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user,null,Collections.emptyList()));}
    private static EducationProgramServiceImpl bound(EntityManager manager){
        EducationProgramRepository repo=mock(EducationProgramRepository.class);
        when(repo.save(any(EducationProgram.class))).thenAnswer(call->{EducationProgram p=(EducationProgram)call.getArguments()[0];if(p.getId()==null){manager.persist(p);return p;}return manager.contains(p)?p:manager.merge(p);});
        when(repo.getOne(anyLong())).thenAnswer(call->manager.find(EducationProgram.class,call.getArguments()[0]));
        EducationProgramServiceImpl result=new EducationProgramServiceImpl();ReflectionTestUtils.setField(result,"manager",manager);ReflectionTestUtils.setField(result,"educationProgramRepository",repo);return result;
    }
    private Long schoolId;
    private Long school(String name) {
        School school = new School(); school.setName(name); school.setDomain(name + ".example");
        em.persist(school); em.flush(); return school.getId();
    }
    @Before public void setup(){actor();em=factory.createEntityManager();em.getTransaction().begin();service=bound(em);schoolId=school("one");}
    @After public void cleanup(){if(em.getTransaction().isActive())em.getTransaction().rollback();em.getTransaction().begin();em.createQuery("delete from EducationProgram").executeUpdate();em.createQuery("delete from School").executeUpdate();em.getTransaction().commit();em.close();SecurityContextHolder.clearContext();}
    private EducationProgram program(String name,String date){EducationProgram p=new EducationProgram();p.setName(name);p.setCode(name);p.setSchoolId(schoolId);p.setMain(false);em.persist(p);em.flush();p.setCreateDate(LocalDateTime.parse(date));em.flush();return p;}
    private long countMain(){return em.createQuery("select count(p) from EducationProgram p where p.main=true",Long.class).getSingleResult();}
    @Test public void pagesSortByCreationTimeWithStableIdTieBreakerAndSearchStillWorks(){
        program("old","2020-01-01T00:00:00");EducationProgram a=program("new A","2026-01-01T00:00:00"),b=program("new B","2026-01-01T00:00:00");
        Page<EducationProgramDto> first=service.getPageObject(new EducationProgramDto(),1,2);
        assertEquals(3,first.getTotalElements());assertEquals(b.getId(),first.getContent().get(0).getId());assertEquals(a.getId(),first.getContent().get(1).getId());
        assertEquals("2026-01-01T00:00:00",first.getContent().get(0).getCreateDate());
        EducationProgramDto query=new EducationProgramDto();query.setTextSearch("new");assertEquals(2,service.getPageObject(query,1,10).getTotalElements());
    }
    @Test public void selectingMainReplacesThePreviousFlagAcrossTheWholeList(){
        List<EducationProgram> programs=new ArrayList<>();for(int i=0;i<8;i++)programs.add(program("program "+i,"2026-01-01T00:00:00"));
        service.setMain(programs.get(7).getId());assertEquals(1,countMain());
        EducationProgramDto selected=service.setMain(programs.get(0).getId());assertEquals(Boolean.TRUE,selected.getMain());assertEquals(1,countMain());assertFalse(programs.get(7).getMain());
        service.setMain(programs.get(0).getId());assertEquals(1,countMain());
        try{service.setMain(-1L);fail();}catch(IllegalArgumentException expected){}assertEquals(1,countMain());
    }
    @Test public void metadataEditsPreserveMainAndCreatingAnotherMainStillKeepsOnlyOne(){
        EducationProgram a=program("A","2026-01-01T00:00:00");service.setMain(a.getId());
        EducationProgramDto edit=new EducationProgramDto();edit.setId(a.getId());edit.setName("Renamed");edit.setCode("A");assertTrue(service.saveObject(edit));assertTrue(a.getMain());
        EducationProgramDto create=new EducationProgramDto();create.setName("New main");create.setCode("NEW");create.setMain(true);create.setSchoolId(schoolId);assertTrue(service.saveObject(create));assertEquals(1,countMain());assertFalse(a.getMain());
    }
    @Test public void twoConcurrentMainSelectionsAreSerialized() throws Exception {
        Long a=program("A","2026-01-01T00:00:00").getId(),b=program("B","2026-01-01T00:00:00").getId();em.getTransaction().commit();
        ExecutorService pool=Executors.newFixedThreadPool(2);CountDownLatch ready=new CountDownLatch(2),start=new CountDownLatch(1);
        List<Future<?>> tasks=new ArrayList<>();
        try{
            for(Long id:Arrays.asList(a,b))tasks.add(pool.submit(()->{actor();EntityManager manager=factory.createEntityManager();manager.getTransaction().begin();ready.countDown();try{start.await();bound(manager).setMain(id);manager.getTransaction().commit();}catch(Exception e){if(manager.getTransaction().isActive())manager.getTransaction().rollback();throw new RuntimeException(e);}finally{manager.close();SecurityContextHolder.clearContext();}}));
            assertTrue(ready.await(5,TimeUnit.SECONDS));start.countDown();for(Future<?> task:tasks)task.get(15,TimeUnit.SECONDS);
            em.clear();assertEquals(1,countMain());
        }finally{start.countDown();pool.shutdownNow();}
    }
    @Test public void schoolsHaveIndependentMainProgramsAndScopedPages() {
        EducationProgram a=program("A","2026-01-01T00:00:00");
        Long firstSchool=schoolId;
        schoolId=school("two");
        EducationProgram b=program("B","2026-01-01T00:00:00");
        service.setMain(a.getId()); service.setMain(b.getId());
        assertEquals(2,countMain());
        EducationProgramDto filter=new EducationProgramDto();
        filter.setPermittedSchoolIds(Collections.singleton(firstSchool));
        assertEquals(a.getId(),service.getPageObject(filter,1,10).getContent().get(0).getId());
        filter.setSchoolId(schoolId);
        assertEquals(0,service.getPageObject(filter,1,10).getTotalElements());
    }
    @Test public void domainAndAccountRolesResolveIndependentlyForEachSchool() {
        Long second = school("two");
        em.createNativeQuery("insert into dbo.tbl_school_user_role values(:school,1,1)").setParameter("school",schoolId).executeUpdate();
        em.createNativeQuery("insert into dbo.tbl_school_user_role values(:school,1,2)").setParameter("school",second).executeUpdate();
        SchoolAccess access = new SchoolAccess();
        ReflectionTestUtils.setField(access,"em",em);
        SchoolService schoolService = new SchoolService();
        ReflectionTestUtils.setField(schoolService,"em",em);
        assertEquals(schoolId, schoolService.current("www.ONE.example.").id);
        assertNull(schoolService.current("other.example"));
        assertEquals(Collections.singleton(schoolId),access.schoolsFor(SchoolAccess.EDUCATION));
        access.require(second,SchoolAccess.STUDENTS);
        try {
            access.require(second,SchoolAccess.EDUCATION);
            fail("Student management must not grant education management in the second School");
        } catch (org.springframework.security.access.AccessDeniedException expected) { }
    }
}
