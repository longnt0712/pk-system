package com.globits.richy.schedule;

import com.globits.richy.domain.*;
import com.globits.richy.dto.*;
import com.globits.richy.repository.*;
import com.globits.richy.service.impl.TestResultServiceImpl;
import com.globits.security.domain.User;
import com.globits.security.dto.UserDto;
import com.globits.security.repository.UserRepository;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import javax.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.joda.time.LocalDateTime;
import org.junit.*;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.SharedEntityManagerCreator;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionTemplate;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

/** Invokes the real save service concurrently in separate database transactions. */
public class TestResultAtomicAttemptTest {
    private static SessionFactory factory;
    private static EntityManager manager;
    private static JpaTransactionManager transactions;
    private User actor;
    private Long objectiveSource, writingSource, objectiveAnswer, writingAnswer;
    private Map<Integer, Long> assignedTasks;
    private TestResultServiceImpl service;
    private TestResultRepository results;
    private final AtomicInteger retryLookups = new AtomicInteger();
    private volatile CountDownLatch firstLookupEntered;
    private volatile CountDownLatch releaseFirstLookup;

    @BeforeClass public static void database() throws Exception {
        org.h2.jdbcx.JdbcDataSource dataSource = new org.h2.jdbcx.JdbcDataSource();
        dataSource.setURL("jdbc:h2:mem:atomic_attempts;MODE=MSSQLServer;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000");
        try (java.sql.Connection connection = dataSource.getConnection(); java.sql.Statement sql = connection.createStatement()) { sql.execute("CREATE SCHEMA dbo"); }
        Configuration cfg = new Configuration(); cfg.getProperties().put("hibernate.connection.datasource", dataSource);
        cfg.setProperty("hibernate.default_schema", "dbo"); cfg.setProperty("hibernate.dialect", "org.hibernate.dialect.H2Dialect");
        cfg.setProperty("hibernate.hbm2ddl.auto", "create-drop"); cfg.setProperty("hibernate.show_sql", "false");
        cfg.setProperty("hibernate.temp.use_jdbc_metadata_defaults", "false"); cfg.setProperty("hibernate.hbm2ddl.halt_on_error", "true");
        MultiTopicVocabularyPersistenceTest.register(cfg, Topic.class, "com.globits.richy.domain");
        MultiTopicVocabularyPersistenceTest.register(cfg, com.globits.core.domain.Organization.class, "com.globits.core.domain");
        MultiTopicVocabularyPersistenceTest.register(cfg, User.class, "com.globits.security.domain");
        factory = cfg.buildSessionFactory(); manager = SharedEntityManagerCreator.createSharedEntityManager(factory);
        transactions = new JpaTransactionManager(factory);
        Path migration = Paths.get(System.getProperty("attempt.lookup.migration", "../database/test-result-attempt-lookup.sql"));
        String sql = new String(Files.readAllBytes(migration), StandardCharsets.UTF_8);
        sql = sql.substring(sql.indexOf("CREATE NONCLUSTERED INDEX")).replace("CREATE NONCLUSTERED INDEX", "CREATE INDEX");
        try (java.sql.Connection connection = dataSource.getConnection(); java.sql.Statement statement = connection.createStatement()) { statement.execute(sql); }
    }
    @AfterClass public static void closeDatabase() { if (factory != null) { factory.close(); } }
    private <T> T transaction(java.util.concurrent.Callable<T> work) {
        return new TransactionTemplate(transactions).execute(status -> { try { return work.call(); } catch (RuntimeException failure) { throw failure; } catch (Exception failure) { throw new RuntimeException(failure); } });
    }
    private Question question(Question parent, int type, String format) {
        Question value = new Question(); value.setParent(parent); value.setType(type); value.setOrdinalNumber(1);
        value.setTitle("Test"); value.setQuestion("Prompt"); value.setStatus(7); value.setTestFormat(format); manager.persist(value); return value;
    }
    private Long[] source(boolean writing) {
        Question source = question(null, 0, writing ? "WRITING" : "COMPREHENSIVE");
        Question part = question(source, 0, null); Question pack = question(part, writing ? 16 : 1, null); Question child = question(pack, 0, null);
        source.setSubQuestions(new LinkedHashSet<Question>(Collections.singletonList(part)));
        part.setSubQuestions(new LinkedHashSet<Question>(Collections.singletonList(pack)));
        pack.setSubQuestions(new LinkedHashSet<Question>(Collections.singletonList(child)));
        Answer text = new Answer(); text.setAnswer(writing ? "Writing" : "Correct"); manager.persist(text);
        QuestionAnswer choice = new QuestionAnswer(); choice.setQuestion(child); choice.setAnswer(text); choice.setOrdinalNumber(1); choice.setCorrect(true); manager.persist(choice);
        child.setQuestionAnswers(new LinkedHashSet<QuestionAnswer>(Collections.singletonList(choice))); return new Long[] {source.getId(), choice.getId()};
    }
    @Before public void fixture() {
        transaction(() -> {
            actor = new User(); actor.setUsername("student-" + UUID.randomUUID()); actor.setEmail(actor.getUsername() + "@example.invalid"); actor.setPassword("unused"); manager.persist(actor);
            Long[] objective = source(false), writing = source(true); objectiveSource = objective[0]; objectiveAnswer = objective[1]; writingSource = writing[0]; writingAnswer = writing[1];
            EnrolmentClass clazz = new EnrolmentClass(); clazz.setName("Class"); clazz.setSchoolId(2); manager.persist(clazz);
            EnrolmentClassScheduleDay day = new EnrolmentClassScheduleDay(); day.setEnrolmentClass(clazz); day.setScheduleDate("2026-10-19"); manager.persist(day);
            assignedTasks = new LinkedHashMap<Integer, Long>();
            for (int type : new int[] {2, 4, 6, 7}) {
                EnrolmentClassScheduleTask task = new EnrolmentClassScheduleTask(); task.setScheduleDay(day); task.setSection("HOMEWORK"); task.setStatus("TODO"); task.setTitle("Assigned");
                task.setActivityType(type == 7 ? "IELTS_WRITING" : type == 6 ? "COMPREHENSIVE" : type == 2 ? "IELTS_LISTENING" : "IELTS_READING");
                task.setIeltsTest(manager.find(Question.class, type == 7 ? writingSource : objectiveSource)); task.setIeltsParts(Collections.singletonList(1)); task.setRequiredAttempts(2); manager.persist(task); assignedTasks.put(type, task.getId());
            }
            return null;
        });
        service = new TestResultServiceImpl(); ReflectionTestUtils.setField(service, "manager", manager);
        results = mock(TestResultRepository.class); ReflectionTestUtils.setField(service, "testResultRepository", results);
        when(results.findAttemptsForRetry(anyLong(), anyString(), anyInt())).thenAnswer(call -> {
            int lookup = retryLookups.incrementAndGet();
            if (lookup == 1 && firstLookupEntered != null) {
                firstLookupEntered.countDown(); if (!releaseFirstLookup.await(8, TimeUnit.SECONDS)) { throw new IllegalStateException("First lookup release timed out"); }
            }
            List<TestResult> found = manager.createQuery("select r from TestResult r where r.user.id = :user and r.clientAttemptKey = :key and r.testType = :type order by r.id asc", TestResult.class)
                    .setParameter("user", call.getArguments()[0]).setParameter("key", call.getArguments()[1]).setParameter("type", call.getArguments()[2]).getResultList();
            return found;
        });
        when(results.save(any(TestResult.class))).thenAnswer(call -> { TestResult value = (TestResult) call.getArguments()[0]; if (value.getId() == null) { manager.persist(value); } return value; });
        UserRepository users = mock(UserRepository.class); when(users.findById(anyLong())).thenAnswer(call -> manager.find(User.class, call.getArguments()[0]));
        when(users.save(any(User.class))).thenAnswer(call -> manager.merge((User) call.getArguments()[0])); ReflectionTestUtils.setField(service, "userRepository", users);
        QuestionRepository questions = mock(QuestionRepository.class); when(questions.findOne(anyLong())).thenAnswer(call -> manager.find(Question.class, call.getArguments()[0])); ReflectionTestUtils.setField(service, "questionRepository", questions);
        QuestionAnswerRepository answers = mock(QuestionAnswerRepository.class); when(answers.findOne(anyLong())).thenAnswer(call -> manager.find(QuestionAnswer.class, call.getArguments()[0]));
        when(answers.getOne(anyLong())).thenAnswer(call -> manager.find(QuestionAnswer.class, call.getArguments()[0])); ReflectionTestUtils.setField(service, "questionAnswerRepository", answers);
        EnrolmentClassScheduleTaskRepository tasks = mock(EnrolmentClassScheduleTaskRepository.class); when(tasks.findOne(anyLong())).thenAnswer(call -> manager.find(EnrolmentClassScheduleTask.class, call.getArguments()[0])); ReflectionTestUtils.setField(service, "scheduleTaskRepository", tasks);
    }
    @After public void clearAuthentication() { SecurityContextHolder.clearContext(); }
    private String key(String suffix) { return UUID.nameUUIDFromBytes((getClass().getName() + suffix).getBytes(StandardCharsets.UTF_8)).toString().replace("-", ""); }
    private TestResultDto submission(int type, String key, boolean failed) {
        TestResultDto dto = new TestResultDto(); dto.setTestType(type); dto.setClientAttemptKey(key); dto.setUser(new UserDto(actor, false)); dto.setTestName("Attempt");
        if (type == 1) { dto.setTotalWord(10); dto.setNumberOfWords(failed ? 5 : 10); }
        else if (type == 3) { dto.setTestTime(failed ? "GAPS 50%" : "GAPS 100%"); }
        else {
            dto.setSourceQuestionId(type == 7 ? writingSource : objectiveSource); dto.setAssignmentTaskId(assignedTasks.get(type)); dto.setCompletedParts(Collections.singletonList(1)); dto.setActiveDurationSeconds(60);
            QuestionAnswerDto selected = new QuestionAnswerDto(); selected.setId(type == 7 ? writingAnswer : objectiveAnswer);
            QuestionAnswerTestResultDto row = new QuestionAnswerTestResultDto(); row.setOrdinalNumber(1); row.setQuestionAnswer(selected);
            row.setClientAnswer(type == 7 ? String.join(" ", Collections.nCopies(failed ? 126 : 151, "word")) : "Correct"); dto.setQuestionAnswerTestResult(Collections.singletonList(row));
        }
        return dto;
    }
    private TestResultDto save(TestResultDto dto, boolean rollback) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(actor, "", Collections.emptyList()));
        try { return transaction(() -> { TestResultDto value = service.saveObject(dto); if (rollback) { throw new IllegalStateException("Deliberate rollback"); } return value; }); }
        finally { SecurityContextHolder.clearContext(); }
    }
    private long count(String key) { return transaction(() -> manager.createQuery("select count(r) from TestResult r where r.user.id = :user and r.clientAttemptKey = :key", Long.class).setParameter("user", actor.getId()).setParameter("key", key).getSingleResult()); }
    private long xp() { return transaction(() -> manager.find(User.class, actor.getId()).getTotalVocabularyWordsLearned()); }
    private TestResultDto[] overlap(int type, boolean failed, boolean rollbackFirst) throws Exception {
        firstLookupEntered = new CountDownLatch(1); releaseFirstLookup = new CountDownLatch(1); retryLookups.set(0);
        ExecutorService workers = Executors.newFixedThreadPool(2); String key = key(type + ":" + failed + ":" + rollbackFirst);
        try {
            Future<TestResultDto> first = workers.submit(() -> save(submission(type, key, failed), rollbackFirst));
            assertTrue(firstLookupEntered.await(8, TimeUnit.SECONDS));
            Future<TestResultDto> second = workers.submit(() -> save(submission(type, key, failed), false));
            Thread.sleep(150); assertEquals("Second request must wait on the user row before its retry lookup", 1, retryLookups.get()); assertFalse(second.isDone());
            releaseFirstLookup.countDown(); TestResultDto firstResult = null;
            try { firstResult = first.get(10, TimeUnit.SECONDS); if (rollbackFirst) { fail("Expected first transaction rollback"); } }
            catch (ExecutionException failure) { if (!rollbackFirst || !(failure.getCause() instanceof IllegalStateException)) { throw failure; } }
            TestResultDto secondResult = second.get(10, TimeUnit.SECONDS); assertEquals(1, count(key));
            return new TestResultDto[] {firstResult, secondResult};
        } finally { releaseFirstLookup.countDown(); workers.shutdownNow(); workers.awaitTermination(5, TimeUnit.SECONDS); firstLookupEntered = null; }
    }
    @Test public void everyModernTestTypeReturnsOneIdForConcurrentSameAttempt() throws Exception {
        for (int type : new int[] {7, 2, 4, 6, 3, 1}) {
            TestResultDto[] result = overlap(type, false, false); assertEquals(result[0].getId(), result[1].getId());
            assertEquals("SUCCESS", result[1].getResultStatus()); assertEquals(Integer.valueOf(type), result[1].getTestType());
            assertNotNull(result[1].getClientAttemptKey()); assertEquals(1, count(result[1].getClientAttemptKey()));
            if (type == 7) {
                assertEquals(writingSource, result[1].getSourceQuestionId()); assertEquals(assignedTasks.get(7), result[1].getAssignmentTaskId()); assertEquals(Collections.singletonList(1), result[1].getCompletedParts());
                long completed = transaction(() -> manager.createQuery("select count(r.id) from TestResult r where r.assignmentTaskId = :task and r.testType = 7 and r.resultStatus = 'SUCCESS'", Long.class).setParameter("task", assignedTasks.get(7)).getSingleResult());
                assertEquals("One Writing attempt cannot satisfy two required repetitions", 1, completed);
            }
        }
        assertEquals("Daily Vocab XP is awarded once", 10, xp());
    }
    @Test public void failedWritingRetryReturnsSameFailedIdWithoutNewRecord() throws Exception {
        TestResultDto[] result = overlap(7, true, false); assertEquals(result[0].getId(), result[1].getId()); assertEquals("FAILED", result[1].getResultStatus()); assertEquals(0, xp());
    }
    @Test public void rollbackOfFirstConcurrentSaveAllowsTheWaitingRetryToPersistOnce() throws Exception {
        TestResultDto[] result = overlap(1, false, true); assertNull(result[0]); assertEquals("SUCCESS", result[1].getResultStatus()); assertEquals(10, xp());
    }
    @Test public void differentAttemptKeysAreIndependentAndRefreshCachedXp() throws Exception {
        ExecutorService workers = Executors.newFixedThreadPool(2); CyclicBarrier bothLoaded = new CyclicBarrier(2);
        java.util.concurrent.Callable<TestResultDto> first = () -> saveWithWarmUser(submission(1, key("differentA"), false), bothLoaded);
        java.util.concurrent.Callable<TestResultDto> second = () -> saveWithWarmUser(submission(1, key("differentB"), false), bothLoaded);
        try { Future<TestResultDto> a = workers.submit(first), b = workers.submit(second); assertNotEquals(a.get(15, TimeUnit.SECONDS).getId(), b.get(15, TimeUnit.SECONDS).getId()); assertEquals(20, xp()); }
        finally { workers.shutdownNow(); workers.awaitTermination(5, TimeUnit.SECONDS); }
    }
    private TestResultDto saveWithWarmUser(TestResultDto dto, CyclicBarrier bothLoaded) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(actor, "", Collections.emptyList()));
        try { return transaction(() -> { manager.find(User.class, actor.getId()); bothLoaded.await(8, TimeUnit.SECONDS); return service.saveObject(dto); }); }
        finally { SecurityContextHolder.clearContext(); }
    }
    @Test public void foreignUserPayloadIsRejectedBeforeAnyRetryLookupOrPersistence() {
        TestResultDto dto = submission(7, key("foreign"), false); UserDto other = new UserDto(); other.setId(actor.getId() + 999); dto.setUser(other);
        try { save(dto, false); fail("Expected access denied"); } catch (AccessDeniedException expected) { }
        assertEquals(0, retryLookups.get()); assertEquals(0, count(dto.getClientAttemptKey())); assertEquals(0, xp());
    }
    @SuppressWarnings("unchecked") private List<Object[]> writingCompletions(LocalDateTime from, LocalDateTime to) {
        return transaction(() -> {
            String query = TestResultRepository.class.getMethod("findIeltsPartCompletions", List.class, List.class,
                    LocalDateTime.class, LocalDateTime.class).getAnnotation(org.springframework.data.jpa.repository.Query.class).value();
            return manager.createQuery(query).setParameter("students", Collections.singletonList(actor.getId()))
                    .setParameter("tests", Collections.singletonList(writingSource)).setParameter("fromDate", from).setParameter("toDate", to).getResultList();
        });
    }
    private long writingStudentCount(LocalDateTime from, LocalDateTime to) {
        return transaction(() -> {
            String query = TestResultRepository.class.getMethod("countIeltsPartAssignmentAttempts", Long.class, Long.class, Long.class,
                    Integer.class, String.class, Integer.class, LocalDateTime.class, LocalDateTime.class)
                    .getAnnotation(org.springframework.data.jpa.repository.Query.class).value();
            return (Long) manager.createQuery(query).setParameter("studentId", actor.getId()).setParameter("taskId", assignedTasks.get(7))
                    .setParameter("testId", writingSource).setParameter("part", 1).setParameter("partToken", "%,1,%")
                    .setParameter("testType", 7).setParameter("fromDate", from).setParameter("toDate", to).getSingleResult();
        });
    }
    @Test public void nextClassReviewCountsOnlySuccessfulWritingAttemptsInTheAssignedWindow() throws Exception {
        LocalDateTime from = LocalDateTime.now().minusDays(1), due = from.plusDays(2);
        for (int index = 0; index < 3; index++) {
            TestResultDto failed = save(submission(7, key("126words-" + index), true), false);
            assertEquals("FAILED", failed.getResultStatus()); assertEquals(Integer.valueOf(126), failed.getNumberOfWords());
        }
        assertTrue("Three failed 126-word submissions never count as homework completion", writingCompletions(from, due).isEmpty());
        assertEquals(0, writingStudentCount(from, due));
        TestResultDto[] concurrentSuccess = overlap(7, false, false);
        assertEquals(concurrentSuccess[0].getId(), concurrentSuccess[1].getId());
        EnrolmentClassScheduleTaskDto review = new EnrolmentClassScheduleTaskDto(); review.setId(assignedTasks.get(7));
        review.setSection("HOMEWORK"); review.setActivityType("IELTS_WRITING"); review.setIeltsTestId(writingSource);
        review.setIeltsParts(Collections.singletonList(1)); review.setRequiredAttempts(2);
        com.globits.richy.service.impl.HomeworkTopicCompletion.applyIelts(review, writingCompletions(from, due), from, due);
        assertEquals("PROGRESS_50", review.getStudentProgress().get(0).getStatus()); assertEquals(1, writingStudentCount(from, due));
        TestResultDto secondAttempt = save(submission(7, key("explicit-new-writing-attempt"), false), false);
        assertNotEquals(concurrentSuccess[0].getId(), secondAttempt.getId());
        com.globits.richy.service.impl.HomeworkTopicCompletion.applyIelts(review, writingCompletions(from, due), from, due);
        assertEquals("DONE", review.getStudentProgress().get(0).getStatus()); assertEquals(2, writingStudentCount(from, due));
        TestResultDto late = save(submission(7, key("outside-writing-deadline"), false), false);
        transaction(() -> { manager.find(TestResult.class, late.getId()).setCreateDate(due.plusMillis(1)); return null; });
        assertEquals("A later-class review keeps the task deadline instead of counting a late result", 2, writingStudentCount(from, due));
        assertEquals(2, writingCompletions(from, due).size());
    }
    @Test public void identicalHistoricalDuplicateKeysAcknowledgeOldestWithoutRewritingHistory() {
        String key = key("identical-history"); Long[] ids = transaction(() -> {
            User user = manager.find(User.class, actor.getId()); Long[] stored = new Long[2];
            for (int index = 0; index < 2; index++) {
                TestResult row = new TestResult(); row.setUser(user); row.setClientAttemptKey(key); row.setTestType(1);
                row.setResultStatus(index == 0 ? null : "SUCCESS"); row.setNumberOfWords(10); manager.persist(row); stored[index] = row.getId();
            }
            return stored;
        });
        TestResultDto ack = save(submission(1, key, false), false);
        assertEquals(ids[0], ack.getId()); assertEquals("SUCCESS", ack.getResultStatus()); assertEquals(2, count(key)); assertEquals(0, xp());
    }
    @Test public void conflictingHistoricalDuplicateOutcomeRejectsRetryAndPreservesBothRows() {
        String key = key("conflicting-history"); transaction(() -> {
            User user = manager.find(User.class, actor.getId());
            for (String outcome : new String[] {"SUCCESS", "FAILED"}) {
                TestResult row = new TestResult(); row.setUser(user); row.setClientAttemptKey(key); row.setTestType(1); row.setResultStatus(outcome); row.setNumberOfWords(10); manager.persist(row);
            }
            return null;
        });
        try { save(submission(1, key, false), false); fail("Ambiguous existing outcomes require review"); }
        catch (IllegalStateException expected) { assertTrue(expected.getMessage().contains("không đồng nhất")); }
        assertEquals(2, count(key)); assertEquals(0, xp());
    }
    @Test public void conflictingHistoricalAssignmentContextCannotSilentlyConfirmAnotherTask() {
        String key = key("conflicting-context"); transaction(() -> {
            User user = manager.find(User.class, actor.getId());
            for (long taskId : new long[] {100L, 101L}) {
                TestResult row = new TestResult(); row.setUser(user); row.setClientAttemptKey(key); row.setTestType(1); row.setResultStatus("SUCCESS"); row.setAssignmentTaskId(taskId); manager.persist(row);
            }
            return null;
        });
        try { save(submission(1, key, false), false); fail("Ambiguous task contexts require review"); }
        catch (IllegalStateException expected) { assertTrue(expected.getMessage().contains("không đồng nhất")); }
        assertEquals(2, count(key));
    }
    @Test public void conflictingHistoricalPracticeTopicsRequireReviewWithoutChoosingOne() {
        String key = key("conflicting-practice-topics"); transaction(() -> {
            User user = manager.find(User.class, actor.getId());
            for (int number = 0; number < 2; number++) {
                Topic topic = new Topic(); topic.setName("Different practice topic " + number); manager.persist(topic);
                TestResult row = new TestResult(); row.setUser(user); row.setClientAttemptKey(key); row.setTestType(1);
                row.setResultStatus("SUCCESS"); row.setNumberOfWords(10); row.getTopics().add(topic); manager.persist(row);
            }
            return null;
        });
        try { save(submission(1, key, false), false); fail("Ambiguous practice topics require review"); }
        catch (IllegalStateException expected) { assertTrue(expected.getMessage().contains("không đồng nhất")); }
        assertEquals(2, count(key));
    }
    @Test public void historicalDuplicateKeysDoNotPreventTheNonuniqueLookupIndex() {
        String key = key("history"); transaction(() -> {
            User user = manager.find(User.class, actor.getId());
            for (int i = 0; i < 2; i++) { TestResult row = new TestResult(); row.setUser(user); row.setClientAttemptKey(key); row.setTestType(1); row.setResultStatus("SUCCESS"); manager.persist(row); }
            return null;
        }); assertEquals(2, count(key));
    }
}
