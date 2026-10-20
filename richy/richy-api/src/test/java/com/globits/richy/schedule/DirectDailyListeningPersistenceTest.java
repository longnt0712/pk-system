package com.globits.richy.schedule;

import com.globits.richy.domain.*;
import com.globits.richy.dto.*;
import com.globits.richy.repository.*;
import com.globits.richy.service.impl.*;
import com.globits.security.domain.User;
import com.globits.security.repository.UserRepository;
import java.util.*;
import javax.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.joda.time.LocalDateTime;
import org.junit.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

/** The production mappings, save service and repository JPQL run against an isolated real database. */
public class DirectDailyListeningPersistenceTest {
    private static SessionFactory factory;
    private EntityManager manager;
    private User student, otherStudent;
    private Question source;
    private EnrolmentClassScheduleTask task;
    private TestResultServiceImpl saves;
    private final LocalDateTime start = LocalDateTime.now().minusDays(1), end = start.plusDays(2);
    @BeforeClass public static void database() throws Exception {
        org.h2.jdbcx.JdbcDataSource dataSource = new org.h2.jdbcx.JdbcDataSource();
        dataSource.setURL("jdbc:h2:mem:direct_daily_assignments;MODE=MSSQLServer;DB_CLOSE_DELAY=-1");
        try (java.sql.Connection connection=dataSource.getConnection(); java.sql.Statement sql=connection.createStatement()) {sql.execute("CREATE SCHEMA dbo");}
        Configuration cfg = new Configuration().setProperty("hibernate.default_schema","dbo")
                .setProperty("hibernate.dialect","org.hibernate.dialect.H2Dialect").setProperty("hibernate.hbm2ddl.auto","create-drop")
                .setProperty("hibernate.show_sql","false").setProperty("hibernate.temp.use_jdbc_metadata_defaults","false")
                .setProperty("hibernate.hbm2ddl.halt_on_error","true");
        cfg.getProperties().put("hibernate.connection.datasource",dataSource);
        MultiTopicVocabularyPersistenceTest.register(cfg,Topic.class,"com.globits.richy.domain");
        MultiTopicVocabularyPersistenceTest.register(cfg,com.globits.core.domain.Organization.class,"com.globits.core.domain");
        MultiTopicVocabularyPersistenceTest.register(cfg,User.class,"com.globits.security.domain");
        factory=cfg.buildSessionFactory();
    }
    @AfterClass public static void closeDatabase() {if(factory!=null)factory.close();}
    private User user(String name) {User value=new User();value.setUsername(name);value.setEmail(name+"@example.invalid");value.setPassword("unused");manager.persist(value);return value;}
    @Before public void fixture() {
        manager=factory.createEntityManager();manager.getTransaction().begin();
        manager.createNativeQuery("insert into dbo.tbl_question_type (id,name,create_date,created_by) values (11,'Daily',CURRENT_TIMESTAMP,'test')").executeUpdate();
        QuestionType type=manager.find(QuestionType.class,11L);
        source=new Question();source.setQuestionType(type);source.setTestFormat("DAILY_LISTENING");source.setStatus(7);source.setTitle("Standalone");source.setQuestion("Standalone");manager.persist(source);
        EnrolmentClass clazz=new EnrolmentClass();clazz.setName("Class");clazz.setSchoolId(2);manager.persist(clazz);
        student=user("student-"+UUID.randomUUID());otherStudent=user("other-"+UUID.randomUUID());student.setEnrollmentClassIds(Collections.singleton(clazz.getId()));
        EnrolmentClassScheduleDay day=new EnrolmentClassScheduleDay();day.setEnrolmentClass(clazz);day.setScheduleDate("2026-10-19");manager.persist(day);
        task=new EnrolmentClassScheduleTask();task.setScheduleDay(day);task.setSection("HOMEWORK");task.setStatus("TODO");task.setTitle("Standalone homework");
        task.setActivityType("DAILY_LISTENING");task.setSourceQuestion(source);task.setRequiredAttempts(2);manager.persist(task);manager.flush();
        saves=new TestResultServiceImpl();ReflectionTestUtils.setField(saves,"manager",manager);
        UserRepository users=mock(UserRepository.class);when(users.findById(anyLong())).thenAnswer(c->manager.find(User.class,c.getArguments()[0]));ReflectionTestUtils.setField(saves,"userRepository",users);
        QuestionRepository questions=mock(QuestionRepository.class);when(questions.findOne(anyLong())).thenAnswer(c->manager.find(Question.class,c.getArguments()[0]));ReflectionTestUtils.setField(saves,"questionRepository",questions);
        EnrolmentClassRepository classes=mock(EnrolmentClassRepository.class);when(classes.findOne(anyLong())).thenAnswer(c->manager.find(EnrolmentClass.class,c.getArguments()[0]));ReflectionTestUtils.setField(saves,"enrolmentClassRepository",classes);
        EnrolmentClassScheduleTaskRepository tasks=mock(EnrolmentClassScheduleTaskRepository.class);when(tasks.findOne(anyLong())).thenAnswer(c->manager.find(EnrolmentClassScheduleTask.class,c.getArguments()[0]));ReflectionTestUtils.setField(saves,"scheduleTaskRepository",tasks);
        TestResultRepository results=mock(TestResultRepository.class);when(results.save(any(TestResult.class))).thenAnswer(c->{TestResult value=(TestResult)c.getArguments()[0];manager.persist(value);return value;});
        when(results.findAttemptsForRetry(anyLong(),anyString(),anyInt())).thenAnswer(c->manager.createQuery("select r from TestResult r where r.user.id=:user and r.clientAttemptKey=:key and r.testType=:type order by r.id",TestResult.class)
            .setParameter("user",c.getArguments()[0]).setParameter("key",c.getArguments()[1]).setParameter("type",c.getArguments()[2]).getResultList());
        ReflectionTestUtils.setField(saves,"testResultRepository",results);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(student,"",Collections.emptyList()));
    }
    @After public void cleanup() {SecurityContextHolder.clearContext();if(manager!=null){if(manager.getTransaction().isActive())manager.getTransaction().rollback();manager.close();}}
    private TestResultDto submit(String key,String percentage) {TestResultDto dto=new TestResultDto();dto.setTestType(3);dto.setAssignmentTaskId(task.getId());dto.setSourceQuestionId(source.getId());dto.setTestTime("GAPS "+percentage+"%");dto.setClientAttemptKey(key);return saves.saveObject(dto);}
    private TestResult evidence(User user, Long sourceId, Long taskId, Integer type, String status, LocalDateTime date) {
        TestResult value=new TestResult();value.setUser(user);value.setSourceQuestionId(sourceId);value.setAssignmentTaskId(taskId);value.setTestType(type);value.setResultStatus(status);
        manager.persist(value);manager.flush();value.setCreateDate(date);manager.flush();return value;
    }
    private String query(String method,Class<?>... args)throws Exception {return TestResultRepository.class.getMethod(method,args).getAnnotation(org.springframework.data.jpa.repository.Query.class).value();}
    private long count()throws Exception {
        return manager.createQuery(query("countSuccessfulDirectListeningAttempts",Long.class,Long.class,Long.class,LocalDateTime.class,LocalDateTime.class),Long.class)
            .setParameter("studentId",student.getId()).setParameter("taskId",task.getId()).setParameter("sourceQuestionId",source.getId()).setParameter("fromDate",start).setParameter("toDate",end).getSingleResult();
    }
    private List<Object[]> rows()throws Exception {
        return manager.createQuery(query("findDirectListeningCompletions",List.class,List.class,LocalDateTime.class,LocalDateTime.class),Object[].class)
            .setParameter("students",Collections.singletonList(student.getId())).setParameter("sources",Collections.singletonList(source.getId()))
            .setParameter("fromDate",start).setParameter("toDate",end).getResultList();
    }
    @Test public void persistedTopiclessTaskAndSavedAttemptCountForBothTeacherAndStudentWithoutTagJoin()throws Exception {
        String key="0123456789abcdef0123456789abcdef";TestResultDto saved=submit(key,"90");
        assertEquals("SUCCESS",saved.getResultStatus());assertEquals(saved.getId(),submit(key,"90").getId());assertEquals(1,count());
        assertEquals("FAILED",submit("1123456789abcdef0123456789abcdef","89").getResultStatus());assertEquals(1,count());
        TestResultDto second=submit("2123456789abcdef0123456789abcdef","100");assertNotEquals(saved.getId(),second.getId());
        manager.flush();Long id=task.getId();manager.clear();task=manager.find(EnrolmentClassScheduleTask.class,id);
        assertNull(task.getTopic());assertTrue(task.getTopics().isEmpty());assertEquals(source.getId(),task.getSourceQuestion().getId());
        assertTrue(manager.find(TestResult.class,saved.getId()).getTopics().isEmpty());assertEquals(2,count());
        EnrolmentClassScheduleTaskDto teacher=new EnrolmentClassScheduleTaskDto(task);HomeworkTopicCompletion.applyDirectListening(teacher,rows(),start,end);
        assertEquals("DONE",teacher.getStudentProgress().get(0).getStatus());assertEquals(Integer.valueOf(100),teacher.getStudentProgress().get(0).getProgressPercent());
    }
    @Test public void realQueriesExcludeFailedNullForeignTaskSourceStudentTypeAndOutOfWindowEvidence()throws Exception {
        evidence(student,source.getId(),task.getId(),3,"SUCCESS",start);
        evidence(student,source.getId(),task.getId(),3,"FAILED",start.plusHours(1));evidence(student,source.getId(),task.getId(),3,null,start.plusHours(1));
        evidence(student,source.getId(),task.getId()+1,3,"SUCCESS",start.plusHours(1));evidence(student,source.getId()+1,task.getId(),3,"SUCCESS",start.plusHours(1));
        evidence(otherStudent,source.getId(),task.getId(),3,"SUCCESS",start.plusHours(1));evidence(student,source.getId(),task.getId(),1,"SUCCESS",start.plusHours(1));
        evidence(student,source.getId(),null,3,"SUCCESS",start.plusHours(1));evidence(student,source.getId(),task.getId(),3,"SUCCESS",start.minusMillis(1));
        evidence(student,source.getId(),task.getId(),3,"SUCCESS",end);
        assertEquals(1,count());EnrolmentClassScheduleTaskDto teacher=new EnrolmentClassScheduleTaskDto(task);
        HomeworkTopicCompletion.applyDirectListening(teacher,rows(),start,end);assertEquals("PROGRESS_50",teacher.getStudentProgress().get(0).getStatus());
        assertEquals(Integer.valueOf(50),teacher.getStudentProgress().get(0).getProgressPercent());
    }
}
