package com.globits.richy.schedule;

import com.globits.richy.domain.*;
import com.globits.richy.dto.*;
import com.globits.richy.repository.TestResultRepository;
import com.globits.richy.service.impl.HomeworkTestScore;
import com.globits.security.domain.User;
import java.util.*;
import javax.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.joda.time.LocalDateTime;
import org.junit.Test;
import static org.junit.Assert.*;

public class HomeworkTestScoreTest {
    private final LocalDateTime start = new LocalDateTime(2026, 11, 9, 20, 0), end = start.plusDays(7);

    private EnrolmentClassScheduleTaskDto task() {
        EnrolmentClassScheduleTaskDto task = new EnrolmentClassScheduleTaskDto();
        task.setId(10L); task.setSection("HOMEWORK"); task.setActivityType("IELTS_READING");
        task.setIeltsTestId(20L); task.setIeltsParts(Collections.singletonList(1)); task.setRequiredAttempts(1);
        return task;
    }
    private TestResult result(long id, int correct, int total) {
        TestResult result = new TestResult(); result.setId(id); result.setUser(new User()); result.getUser().setId(30L);
        result.setAssignmentTaskId(10L); result.setSourceQuestionId(20L); result.setTestType(4);
        result.setCompletedPart(1); result.setCreateDate(start.plusHours(1)); result.setResultStatus(correct * 100D / total >= 85 ? "SUCCESS" : "FAILED");
        Question pack = new Question(); pack.setType(1);
        Set<QuestionAnswerTestResult> rows = new LinkedHashSet<QuestionAnswerTestResult>();
        for (int i = 0; i < total; i++) {
            Question question = new Question(); question.setParent(pack);
            QuestionAnswer option = new QuestionAnswer(); option.setQuestion(question); option.setCorrect(i < correct);
            QuestionAnswerTestResult row = new QuestionAnswerTestResult(); row.setId(id * 1000 + i);
            row.setQuestionAnswer(option); row.setClientAnswer("answer"); rows.add(row);
        }
        result.setQuestionAnswerTestResult(rows); return result;
    }
    private EnrolmentClassTaskProgressDto apply(EnrolmentClassScheduleTaskDto task, TestResult... results) {
        HomeworkTestScore.apply(task, Arrays.asList(results), start, end); return task.getStudentProgress().get(0);
    }
    @Test public void failedAndSuccessfulSubmissionsRespectExactBoundariesWithoutRounding() {
        for (int correct : new int[] {0, 79, 80, 81, 169, 170, 200}) {
            double percent = correct / 2D;
            EnrolmentClassTaskProgressDto progress = apply(task(), result(100, correct, 200));
            assertEquals(percent, progress.getResultPercent(), 0.000001);
            assertEquals(percent >= 85 ? "DONE" : percent <= 40 ? "TODO" : "PROGRESS_" + (int) percent, progress.getStatus());
            assertTrue(progress.isAutomatic());
        }
    }
    @Test public void retriesKeepBestScoreAndRepeatedFetchRowsDoNotCountAsExtraAttempts() {
        EnrolmentClassScheduleTaskDto task = task(); task.setRequiredAttempts(2);
        TestResult best = result(100, 90, 100), worse = result(101, 40, 100);
        assertEquals(65D, apply(task, best, best, worse).getResultPercent(), 0.000001);
        task = task(); assertEquals(90D, apply(task, best, worse).getResultPercent(), 0.000001);
    }
    @Test public void selectedPartsAndSectionsIncludeUnattemptedWorkAsZero() {
        EnrolmentClassScheduleTaskDto task = task(); task.setIeltsParts(Arrays.asList(1, 2));
        assertEquals(50D, apply(task, result(100, 100, 100)).getResultPercent(), 0.000001);
        task = task(); task.setActivityType("COMPREHENSIVE");
        List<ComprehensiveAssignmentSectionDto> sections = new ArrayList<ComprehensiveAssignmentSectionDto>();
        for (String key : Arrays.asList("section-1", "section-2")) {
            ComprehensiveAssignmentSectionDto section = new ComprehensiveAssignmentSectionDto(); section.setKey(key); sections.add(section);
        }
        task.setComprehensiveSections(sections);
        TestResult one = result(100, 80, 100); one.setTestType(6); one.setAssignmentSectionKey("section-1");
        TestResult two = result(101, 90, 100); two.setTestType(6); two.setAssignmentSectionKey("section-2");
        assertEquals(40D, apply(task, one).getResultPercent(), 0.000001);
        assertEquals(85D, apply(task, one, two).getResultPercent(), 0.000001);
    }
    @Test public void combinedSubmissionsScoreOnlyTheSelectedPartsUsingTheirOwnQuestions() {
        TestResult result = result(100, 160, 200); result.setCompletedParts(Arrays.asList(1, 2));
        Question source = new Question(); source.setId(20L);
        int index = 0;
        for (QuestionAnswerTestResult response : result.getQuestionAnswerTestResult()) {
            Question part = new Question(); part.setId(index < 100 ? 21L : 22L); part.setParent(source); part.setOrdinalNumber(index < 100 ? 1 : 2);
            Question pack = new Question(); pack.setType(1); pack.setParent(part); response.getQuestionAnswer().getQuestion().setParent(pack);
            index++;
        }
        assertEquals(100D, apply(task(), result).getResultPercent(), 0.000001);
        EnrolmentClassScheduleTaskDto task = task(); task.setIeltsParts(Collections.singletonList(2));
        assertEquals(60D, apply(task, result).getResultPercent(), 0.000001);
    }
    @Test public void teacherOverridesKeepTheirStatusAndNotesAndDefaultTodoRetainsItsManualStatus() {
        for (String status : Arrays.asList("DONE", "NEEDS_REVIEW", "UNRECORDED", "PROGRESS_60", "TODO")) {
            EnrolmentClassScheduleTaskDto task = task(); EnrolmentClassTaskProgressDto manual = new EnrolmentClassTaskProgressDto();
            manual.setStudentUserId(30L); manual.setStatus(status); manual.setNotes("Teacher note"); task.getStudentProgress().add(manual);
            EnrolmentClassTaskProgressDto progress = apply(task, result(100, 60, 100));
            assertEquals("Teacher note", progress.getNotes());
            if ("TODO".equals(status)) { assertEquals("TODO", progress.getManualStatus()); assertEquals("PROGRESS_60", progress.getStatus()); }
            else { assertEquals(status, progress.getStatus()); assertNull(progress.getResultPercent()); assertFalse(progress.isAutomatic()); }
        }
    }
    @Test public void foreignAssignmentsSourcesTypesPartsAndOutOfWindowResultsAreExcluded() {
        List<TestResult> results = new ArrayList<TestResult>();
        TestResult wrongTask = result(100, 90, 100); wrongTask.setAssignmentTaskId(11L); results.add(wrongTask);
        TestResult wrongSource = result(101, 90, 100); wrongSource.setSourceQuestionId(21L); results.add(wrongSource);
        TestResult wrongType = result(102, 90, 100); wrongType.setTestType(2); results.add(wrongType);
        TestResult wrongPart = result(103, 90, 100); wrongPart.setCompletedPart(2); results.add(wrongPart);
        TestResult early = result(104, 90, 100); early.setCreateDate(start.minusMillis(1)); results.add(early);
        TestResult late = result(105, 90, 100); late.setCreateDate(end); results.add(late);
        TestResult sliced = result(106, 90, 100); sliced.setAssignmentSectionKey("foreign"); results.add(sliced);
        EnrolmentClassScheduleTaskDto task = task(); HomeworkTestScore.apply(task, results, start, end); assertTrue(task.getStudentProgress().isEmpty());
    }
    @Test public void realQueryIncludesFailedResultsAndEnforcesStudentTaskTypeAndTimeScope() throws Exception {
        org.h2.jdbcx.JdbcDataSource ds = new org.h2.jdbcx.JdbcDataSource(); ds.setURL("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MSSQLServer;DB_CLOSE_DELAY=-1");
        try (java.sql.Connection c = ds.getConnection(); java.sql.Statement s = c.createStatement()) { s.execute("CREATE SCHEMA dbo"); }
        Configuration cfg = new Configuration().setProperty("hibernate.default_schema", "dbo").setProperty("hibernate.dialect", "org.hibernate.dialect.H2Dialect")
                .setProperty("hibernate.hbm2ddl.auto", "create-drop").setProperty("hibernate.show_sql", "false");
        cfg.getProperties().put("hibernate.connection.datasource", ds);
        MultiTopicVocabularyPersistenceTest.register(cfg, Topic.class, "com.globits.richy.domain");
        MultiTopicVocabularyPersistenceTest.register(cfg, com.globits.core.domain.Organization.class, "com.globits.core.domain");
        MultiTopicVocabularyPersistenceTest.register(cfg, User.class, "com.globits.security.domain");
        try (SessionFactory factory = cfg.buildSessionFactory()) {
            EntityManager em = factory.createEntityManager(); em.getTransaction().begin();
            try {
                User student = new User(); student.setUsername("score-student"); student.setPassword("unused"); student.setEmail("score@example.invalid"); em.persist(student);
                for (int i = 0; i < 6; i++) {
                    TestResult row = new TestResult(); row.setUser(student); row.setAssignmentTaskId(i == 2 ? 11L : 10L);
                    row.setTestType(i == 3 ? 7 : 4); row.setResultStatus(i == 0 ? "SUCCESS" : "FAILED"); em.persist(row); em.flush();
                    row.setCreateDate(i == 4 ? start.minusMillis(1) : i == 5 ? end : start); em.flush();
                }
                String query = TestResultRepository.class.getMethod("findHomeworkTestScores", List.class, List.class, LocalDateTime.class, LocalDateTime.class)
                        .getAnnotation(org.springframework.data.jpa.repository.Query.class).value();
                List<TestResult> found = em.createQuery(query, TestResult.class).setParameter("students", Collections.singletonList(student.getId()))
                        .setParameter("tasks", Collections.singletonList(10L)).setParameter("fromDate", start).setParameter("toDate", end).getResultList();
                assertEquals(2, found.size()); assertEquals("SUCCESS", found.get(0).getResultStatus()); assertEquals("FAILED", found.get(1).getResultStatus());
                assertTrue(em.createQuery(query, TestResult.class).setParameter("students", Collections.singletonList(-1L))
                        .setParameter("tasks", Collections.singletonList(10L)).setParameter("fromDate", start).setParameter("toDate", end).getResultList().isEmpty());
            } finally { em.getTransaction().rollback(); em.close(); }
        }
    }
}
