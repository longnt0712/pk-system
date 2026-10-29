package com.globits.richy.schedule;

import com.globits.richy.domain.TestResult;
import com.globits.richy.domain.Topic;
import com.globits.richy.dto.ComprehensiveAssignmentSectionDto;
import com.globits.richy.dto.EnrolmentClassScheduleTaskDto;
import com.globits.richy.dto.EnrolmentClassTaskProgressDto;
import com.globits.richy.repository.TestResultRepository;
import com.globits.richy.service.impl.HomeworkTopicCompletion;
import com.globits.security.domain.User;
import java.util.*;
import javax.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.joda.time.LocalDateTime;
import org.junit.Test;
import static org.junit.Assert.*;

/** Section completion is based on separately passed attempts, not the number of submitted rows. */
public class ComprehensiveSectionProgressTest {
    private final LocalDateTime start = new LocalDateTime(2026, 10, 29, 20, 0), end = start.plusDays(7);

    private EnrolmentClassScheduleTaskDto assignment() {
        EnrolmentClassScheduleTaskDto task = new EnrolmentClassScheduleTaskDto();
        task.setId(10L); task.setIeltsTestId(20L); task.setSection("HOMEWORK"); task.setActivityType("COMPREHENSIVE");
        task.setIeltsParts(Collections.singletonList(1)); task.setRequiredAttempts(1);
        List<ComprehensiveAssignmentSectionDto> sections = new ArrayList<ComprehensiveAssignmentSectionDto>();
        for (int number = 1; number <= 4; number++) {
            ComprehensiveAssignmentSectionDto section = new ComprehensiveAssignmentSectionDto();
            section.setKey("section-" + number); section.setNumber(number);
            List<Long> ids = new ArrayList<Long>();
            for (long id = (number - 1) * 50 + 1; id <= number * 50; id++) { ids.add(id); }
            section.setQuestionIds(ids); section.setDurationMinutes(20); sections.add(section);
        }
        task.setComprehensiveSections(sections); return task;
    }
    private Object[] evidence(int section, long id) {
        return new Object[] {30L, 20L, 1, start.plusHours(1), id, 6, 10L, ",1,", "section-" + section};
    }
    private EnrolmentClassTaskProgressDto progress(EnrolmentClassScheduleTaskDto task) { return task.getStudentProgress().get(0); }

    @Test public void eachPassedSectionAdvancesExactQuartersUntilTheSingleTaskIsDone() {
        EnrolmentClassScheduleTaskDto task = assignment(); List<Object[]> evidence = new ArrayList<Object[]>();
        assertEquals(4, HomeworkTopicCompletion.requiredIeltsAttempts(task));
        for (int number = 1; number <= 4; number++) {
            evidence.add(evidence(number, 100 + number)); HomeworkTopicCompletion.applyIelts(task, evidence, start, end);
            assertEquals(Integer.valueOf(number * 25), progress(task).getProgressPercent());
            assertEquals(number == 4 ? "DONE" : "PROGRESS_" + number * 25, progress(task).getStatus());
            assertTrue(progress(task).isAutomatic());
        }
    }
    @Test public void repeatingOnePassedSectionCannotReplaceAnyOtherSection() {
        EnrolmentClassScheduleTaskDto task = assignment();
        HomeworkTopicCompletion.applyIelts(task, Arrays.asList(evidence(1, 101), evidence(1, 102), evidence(1, 103), evidence(1, 104)), start, end);
        assertEquals("PROGRESS_25", progress(task).getStatus()); assertEquals(Integer.valueOf(25), progress(task).getProgressPercent());
    }
    @Test public void repeatRequirementsApplyIndependentlyAndDuplicateRowsDoNotCreateExtraAttempts() {
        EnrolmentClassScheduleTaskDto task = assignment(); task.setRequiredAttempts(2); Object[] first = evidence(1, 101);
        HomeworkTopicCompletion.applyIelts(task, Arrays.asList(first, first), start, end);
        assertEquals("PROGRESS_13", progress(task).getStatus()); assertEquals(8, HomeworkTopicCompletion.requiredIeltsAttempts(task));
        List<Object[]> rows = new ArrayList<Object[]>();
        for (int number = 1; number <= 4; number++) { rows.add(evidence(number, number * 100)); rows.add(evidence(number, number * 100 + 1)); }
        HomeworkTopicCompletion.applyIelts(task, rows, start, end); assertEquals("DONE", progress(task).getStatus());
    }
    @Test public void evidenceMustMatchTheTaskTestTypeSectionAndWindowAndContainAResultIdentity() {
        EnrolmentClassScheduleTaskDto task = assignment(); List<Object[]> rows = new ArrayList<Object[]>();
        Object[] otherTask = evidence(1, 101); otherTask[6] = 11L; rows.add(otherTask);
        Object[] otherTest = evidence(1, 102); otherTest[1] = 21L; rows.add(otherTest);
        Object[] otherType = evidence(1, 103); otherType[5] = 4; rows.add(otherType);
        Object[] otherSection = evidence(1, 104); otherSection[8] = "foreign-section"; rows.add(otherSection);
        Object[] early = evidence(1, 105); early[3] = start.minusMillis(1); rows.add(early);
        Object[] late = evidence(1, 106); late[3] = end; rows.add(late);
        Object[] noIdentity = evidence(1, 107); noIdentity[4] = null; rows.add(noIdentity);
        rows.add(new Object[] {30L, 20L, 1, start.plusHours(1), 108L, 6, 10L});
        rows.add(new Object[] {30L, 20L, 1, start.plusHours(1), 109L, 6, 10L, ",1,"});
        HomeworkTopicCompletion.applyIelts(task, rows, start, end); assertTrue(task.getStudentProgress().isEmpty());
        Object[] onStart = evidence(1, 110); onStart[3] = start;
        HomeworkTopicCompletion.applyIelts(task, Collections.singletonList(onStart), start, end); assertEquals("PROGRESS_25", progress(task).getStatus());
    }
    @Test public void teacherFeedbackKeepsTheSamePrecedenceAsBefore() {
        for (String status : Arrays.asList("NEEDS_REVIEW", "DONE", "UNRECORDED", "PROGRESS_40")) {
            EnrolmentClassScheduleTaskDto task = assignment(); EnrolmentClassTaskProgressDto manual = new EnrolmentClassTaskProgressDto();
            manual.setStudentUserId(30L); manual.setStatus(status); task.getStudentProgress().add(manual);
            HomeworkTopicCompletion.applyIelts(task, Arrays.asList(evidence(1, 101), evidence(2, 102), evidence(3, 103), evidence(4, 104)), start, end);
            assertSame(manual, progress(task)); assertEquals(status, manual.getStatus()); assertFalse(manual.isAutomatic());
        }
    }
    @Test public void oldAutomaticProgressIsRebuiltFromCurrentEvidenceRatherThanAccumulated() {
        EnrolmentClassScheduleTaskDto task = assignment(); HomeworkTopicCompletion.applyIelts(task, Collections.singletonList(evidence(1, 101)), start, end);
        HomeworkTopicCompletion.applyIelts(task, Collections.<Object[]>emptyList(), start, end); assertTrue(task.getStudentProgress().isEmpty());
        EnrolmentClassTaskProgressDto reset = new EnrolmentClassTaskProgressDto(); reset.setStudentUserId(30L); reset.setStatus("TODO"); task.getStudentProgress().add(reset);
        HomeworkTopicCompletion.applyIelts(task, Collections.singletonList(evidence(2, 102)), start, end);
        assertEquals("PROGRESS_25", progress(task).getStatus()); assertEquals("TODO", progress(task).getManualStatus());
    }
    @Test public void slicedResultsNeverCompleteLegacyFullTestAssignments() {
        EnrolmentClassScheduleTaskDto task = assignment(); task.setComprehensiveSections(Collections.<ComprehensiveAssignmentSectionDto>emptyList());
        HomeworkTopicCompletion.applyIelts(task, Collections.singletonList(evidence(1, 101)), start, end); assertTrue(task.getStudentProgress().isEmpty());
        Object[] legacy = evidence(1, 102); legacy[8] = null;
        HomeworkTopicCompletion.applyIelts(task, Collections.singletonList(legacy), start, end); assertEquals("DONE", progress(task).getStatus());
        task.setActivityType("IELTS_READING"); task.setIeltsParts(Arrays.asList(1, 2)); task.getStudentProgress().clear();
        HomeworkTopicCompletion.applyIelts(task, Collections.singletonList(new Object[] {30L, 20L, 1, start.plusHours(1), 103L, 4, 10L}), start, end);
        assertEquals("PROGRESS_50", progress(task).getStatus());
    }

    private String query(String method, Class<?>... types) throws Exception {
        return TestResultRepository.class.getMethod(method, types).getAnnotation(org.springframework.data.jpa.repository.Query.class).value();
    }
    private TestResult save(EntityManager em, User user, Long task, Long source, int type, String key, String status, LocalDateTime date) {
        TestResult result = new TestResult(); result.setUser(user); result.setAssignmentTaskId(task); result.setSourceQuestionId(source);
        result.setTestType(type); result.setAssignmentSectionKey(key); result.setResultStatus(status); result.setCompletedParts(Collections.singletonList(1));
        em.persist(result); em.flush(); result.setCreateDate(date); em.flush(); return result;
    }
    @Test public void realQueriesExcludeFailedForeignLegacyAndOutOfWindowRowsFromSectionCounts() throws Exception {
        org.h2.jdbcx.JdbcDataSource ds = new org.h2.jdbcx.JdbcDataSource(); ds.setURL("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MSSQLServer;DB_CLOSE_DELAY=-1");
        try (java.sql.Connection c = ds.getConnection(); java.sql.Statement s = c.createStatement()) { s.execute("CREATE SCHEMA dbo"); }
        Configuration cfg = new Configuration().setProperty("hibernate.default_schema", "dbo").setProperty("hibernate.dialect", "org.hibernate.dialect.H2Dialect")
            .setProperty("hibernate.hbm2ddl.auto", "create-drop").setProperty("hibernate.show_sql", "false").setProperty("hibernate.temp.use_jdbc_metadata_defaults", "false")
            .setProperty("hibernate.hbm2ddl.halt_on_error", "true"); cfg.getProperties().put("hibernate.connection.datasource", ds);
        MultiTopicVocabularyPersistenceTest.register(cfg, Topic.class, "com.globits.richy.domain");
        MultiTopicVocabularyPersistenceTest.register(cfg, com.globits.core.domain.Organization.class, "com.globits.core.domain");
        MultiTopicVocabularyPersistenceTest.register(cfg, User.class, "com.globits.security.domain");
        try (SessionFactory factory = cfg.buildSessionFactory()) {
            EntityManager em = factory.createEntityManager(); em.getTransaction().begin();
            try {
                User user = new User(); user.setUsername("section-student"); user.setPassword("unused"); user.setEmail("section@example.invalid"); em.persist(user);
                User other = new User(); other.setUsername("other-section-student"); other.setPassword("unused"); other.setEmail("other-section@example.invalid"); em.persist(other);
                save(em, user, 10L, 20L, 6, "section-1", "SUCCESS", start);
                save(em, user, 10L, 20L, 6, "section-1", "FAILED", start.plusMinutes(1));
                save(em, user, 11L, 20L, 6, "section-1", "SUCCESS", start.plusMinutes(2));
                save(em, user, 10L, 21L, 6, "section-1", "SUCCESS", start.plusMinutes(3));
                save(em, user, 10L, 20L, 4, "section-1", "SUCCESS", start.plusMinutes(4));
                save(em, other, 10L, 20L, 6, "section-1", "SUCCESS", start.plusMinutes(5));
                save(em, user, 10L, 20L, 6, "section-1", "SUCCESS", start.minusMillis(1));
                save(em, user, 10L, 20L, 6, "section-1", "SUCCESS", end);
                save(em, user, 10L, 20L, 6, "section-2", "SUCCESS", start.plusMinutes(6));
                save(em, user, 10L, 20L, 6, "foreign-section", "SUCCESS", start.plusMinutes(7));
                save(em, user, 10L, 20L, 6, null, "SUCCESS", start.plusMinutes(8));
                String count = query("countComprehensiveSectionAssignmentAttempts", Long.class, Long.class, Long.class, String.class, LocalDateTime.class, LocalDateTime.class);
                assertEquals(Long.valueOf(1), em.createQuery(count, Long.class).setParameter("studentId", user.getId()).setParameter("taskId", 10L).setParameter("testId", 20L)
                    .setParameter("sectionKey", "section-1").setParameter("fromDate", start).setParameter("toDate", end).getSingleResult());
                String oldCount = query("countIeltsPartAssignmentAttempts", Long.class, Long.class, Long.class, Integer.class, String.class, Integer.class, LocalDateTime.class, LocalDateTime.class);
                assertEquals(Long.valueOf(1), em.createQuery(oldCount, Long.class).setParameter("studentId", user.getId()).setParameter("taskId", 10L).setParameter("testId", 20L)
                    .setParameter("part", 1).setParameter("partToken", "%,1,%").setParameter("testType", 6).setParameter("fromDate", start).setParameter("toDate", end).getSingleResult());
                String rows = query("findIeltsPartCompletions", List.class, List.class, LocalDateTime.class, LocalDateTime.class);
                List<Object[]> found = em.createQuery(rows, Object[].class).setParameter("students", Collections.singletonList(user.getId())).setParameter("tests", Collections.singletonList(20L))
                    .setParameter("fromDate", start).setParameter("toDate", end).getResultList();
                assertTrue(found.stream().allMatch(row -> row.length == 9));
                EnrolmentClassScheduleTaskDto task = assignment(); HomeworkTopicCompletion.applyIelts(task, found, start, end);
                assertEquals("PROGRESS_50", progress(task).getStatus()); assertEquals(user.getId(), progress(task).getStudentUserId());
            } finally { em.getTransaction().rollback(); em.close(); }
        }
    }
}
