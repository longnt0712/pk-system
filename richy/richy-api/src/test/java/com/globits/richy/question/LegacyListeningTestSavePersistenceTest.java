package com.globits.richy.question;

import com.globits.richy.domain.*;
import com.globits.richy.dto.*;
import com.globits.richy.repository.*;
import com.globits.richy.service.impl.QuestionServiceImpl;
import com.globits.security.domain.User;
import java.util.*;
import javax.persistence.Entity;
import javax.persistence.EntityManager;
import org.h2.jdbcx.JdbcDataSource;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.*;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

/** Real Hibernate flushes protect historical results while legacy Part 4 is moved. */
public class LegacyListeningTestSavePersistenceTest {
    private static SessionFactory factory;
    private EntityManager manager;
    private QuestionServiceImpl service;
    private User teacher;
    private QuestionType kind;
    private Long rootId, resultId, detailId, answerId;
    private Set<Long> originalQuestions, originalAnswers;

    @BeforeClass public static void createDatabase() throws Exception {
        JdbcDataSource dataSource = new JdbcDataSource();
        dataSource.setURL("jdbc:h2:mem:legacy_listening_save;MODE=MSSQLServer;DB_CLOSE_DELAY=-1");
        Configuration config = new Configuration().setProperty("hibernate.dialect", "org.hibernate.dialect.H2Dialect")
            .setProperty("hibernate.hbm2ddl.auto", "create-drop").setProperty("hibernate.show_sql", "false");
        config.getProperties().put("hibernate.connection.datasource", dataSource);
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));
        for (String basePackage : Arrays.asList("com.globits.richy", "com.globits.core", "com.globits.security")) {
            for (org.springframework.beans.factory.config.BeanDefinition definition : scanner.findCandidateComponents(basePackage)) {
                config.addAnnotatedClass(Class.forName(definition.getBeanClassName()));
            }
        }
        factory = config.buildSessionFactory();
    }
    @AfterClass public static void closeDatabase() { if (factory != null) factory.close(); }
    @Before public void seed() {
        manager = factory.createEntityManager(); manager.getTransaction().begin();
        teacher = new User(); teacher.setUsername("legacy-teacher"); teacher.setEmail("legacy@example.test"); teacher.setPassword("unused"); manager.persist(teacher);
        kind = new QuestionType(); kind.setName("IELTS test"); manager.persist(kind);
        Question root = question(null, 1, 0); root.setTitle("Legacy Listening"); root.setPronounce("https://school.test/lesson.mp3");
        root.setQuestionType(kind); root.setUser(teacher); root.setStatus(6); root.setTestFormat("LISTENING");
        List<Question> parts = new ArrayList<Question>();
        for (int part = 1; part <= 3; part++) { parts.add(question(root, part, 0)); }
        for (int part = 1; part <= 4; part++) {
            Question pack = question(parts.get(Math.min(part, 3) - 1), part >= 3 ? part - 2 : 1, 2);
            for (int index = 1; index <= 10; index++) {
                int ordinal = (part - 1) * 10 + index;
                Question child = question(pack, ordinal, 0); child.setQuestion("Question " + ordinal);
                Answer text = new Answer(); text.setAnswer("answer " + ordinal); manager.persist(text);
                QuestionAnswer option = new QuestionAnswer(); option.setQuestion(child); option.setAnswer(text); option.setCorrect(true); option.setOrdinalNumber(1);
                child.setQuestionAnswers(new LinkedHashSet<QuestionAnswer>(Collections.singletonList(option)));
                if (ordinal == 40) {
                    manager.persist(root); manager.flush();
                    TestResult history = new TestResult(); history.setUser(teacher); history.setTestType(2); history.setSourceQuestionId(root.getId());
                    history.setAssignmentTaskId(900L); history.setResultStatus("SUCCESS"); manager.persist(history);
                    QuestionAnswerTestResult detail = new QuestionAnswerTestResult(); detail.setQuestionAnswer(option); detail.setTestResult(history);
                    detail.setOrdinalNumber(40); detail.setClientAnswer("answer 40"); manager.persist(detail); manager.flush();
                    resultId = history.getId(); detailId = detail.getId(); answerId = option.getId();
                }
            }
        }
        manager.persist(root); manager.flush(); rootId = root.getId();
        originalQuestions = ids("Question"); originalAnswers = ids("QuestionAnswer"); manager.clear();
        service = new QuestionServiceImpl(); ReflectionTestUtils.setField(service, "manager", manager);
        QuestionRepository questions = mock(QuestionRepository.class);
        when(questions.findOne(anyLong())).thenAnswer(call -> manager.find(Question.class, call.getArguments()[0]));
        when(questions.getOne(anyLong())).thenAnswer(call -> manager.find(Question.class, call.getArguments()[0]));
        when(questions.save(any(Question.class))).thenAnswer(call -> { Question value = (Question) call.getArguments()[0]; manager.persist(value); return value; });
        QuestionAnswerRepository options = mock(QuestionAnswerRepository.class);
        when(options.getOne(anyLong())).thenAnswer(call -> manager.find(QuestionAnswer.class, call.getArguments()[0]));
        AnswerRepository answers = mock(AnswerRepository.class);
        when(answers.getOne(anyLong())).thenAnswer(call -> manager.find(Answer.class, call.getArguments()[0]));
        when(answers.save(any(Answer.class))).thenAnswer(call -> { Answer value = (Answer) call.getArguments()[0]; manager.persist(value); return value; });
        QuestionTypeRepository types = mock(QuestionTypeRepository.class);
        when(types.getOne(anyLong())).thenAnswer(call -> manager.find(QuestionType.class, call.getArguments()[0]));
        ReflectionTestUtils.setField(service, "questionRepository", questions); ReflectionTestUtils.setField(service, "questionAnswerRepository", options);
        ReflectionTestUtils.setField(service, "answerRepository", answers); ReflectionTestUtils.setField(service, "questionTypeRepository", types);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(teacher, "unused",
            Collections.singletonList(new SimpleGrantedAuthority("ROLE_ADMIN"))));
    }
    @After public void rollback() {
        SecurityContextHolder.clearContext();
        if (manager != null) { if (manager.getTransaction().isActive()) { manager.getTransaction().rollback(); } manager.close(); }
    }
    private Question question(Question parent, int ordinal, int type) {
        Question value = new Question(); value.setParent(parent); value.setOrdinalNumber(ordinal); value.setType(type);
        value.setSubQuestions(new LinkedHashSet<Question>());
        if (parent != null) { parent.getSubQuestions().add(value); }
        return value;
    }
    private Set<Long> ids(String entity) { return new HashSet<Long>(manager.createQuery("select item.id from " + entity + " item", Long.class).getResultList()); }
    private QuestionDto migrate() {
        QuestionDto dto = new QuestionDto(manager.find(Question.class, rootId));
        QuestionDto third = dto.getSubQuestions().get(2), fourth = new QuestionDto(); fourth.setOrdinalNumber(4);
        fourth.setType(0); fourth.setSubQuestions(new ArrayList<QuestionDto>());
        Iterator<QuestionDto> iterator = third.getSubQuestions().iterator();
        while (iterator.hasNext()) {
            QuestionDto pack = iterator.next();
            if (pack.getSubQuestions().get(0).getOrdinalNumber() >= 31) { fourth.getSubQuestions().add(pack); iterator.remove(); }
        }
        dto.getSubQuestions().add(fourth); return dto;
    }
    @Test public void legacyPartFourMovesWithoutDeletingAnswerHistoryAndCanBeSavedAgainAsDraftAndPublished() {
        QuestionDto saved = service.saveObject(migrate()); manager.flush(); manager.clear();
        assertEquals(rootId, saved.getId()); assertEquals(4, saved.getSubQuestions().size());
        assertEquals(1, saved.getSubQuestions().get(2).getSubQuestions().size()); assertEquals(1, saved.getSubQuestions().get(3).getSubQuestions().size());
        Long newPartId = saved.getSubQuestions().get(3).getId(); assertNotNull(newPartId);
        for (int status : Arrays.asList(6, 7, 6, 7)) {
            QuestionDto input = new QuestionDto(manager.find(Question.class, rootId)); input.setStatus(status);
            input.setTitle("Legacy Listening updated " + status); saved = service.saveObject(input); manager.flush(); manager.clear();
            assertEquals(rootId, saved.getId()); assertEquals(status, manager.find(Question.class, rootId).getStatus());
            assertEquals(newPartId, saved.getSubQuestions().get(3).getId());
            assertEquals(31, saved.getSubQuestions().get(3).getSubQuestions().get(0).getSubQuestions().get(0).getOrdinalNumber().intValue());
            Set<Long> expectedQuestions = new HashSet<Long>(originalQuestions); expectedQuestions.add(newPartId);
            assertEquals(expectedQuestions, ids("Question")); assertEquals(originalAnswers, ids("QuestionAnswer"));
            QuestionAnswerTestResult detail = manager.find(QuestionAnswerTestResult.class, detailId);
            assertEquals(answerId, detail.getQuestionAnswer().getId()); assertEquals(resultId, detail.getTestResult().getId());
            TestResult history = manager.find(TestResult.class, resultId);
            assertEquals(rootId, history.getSourceQuestionId()); assertEquals(Long.valueOf(900L), history.getAssignmentTaskId());
            assertEquals("SUCCESS", history.getResultStatus()); assertEquals("answer 40", detail.getClientAnswer());
        }
    }
    @Test public void movingToAnEarlierExistingPartKeepsTheSameAnswerHistory() {
        QuestionDto input = new QuestionDto(manager.find(Question.class, rootId));
        QuestionDto third = input.getSubQuestions().get(2), target = input.getSubQuestions().get(1);
        QuestionDto moving = third.getSubQuestions().remove(1); Long movingId = moving.getId();
        target.getSubQuestions().add(moving);
        QuestionDto saved = service.saveObject(input); manager.flush(); manager.clear();
        assertEquals(3, saved.getSubQuestions().size());
        assertEquals(1, saved.getSubQuestions().get(2).getSubQuestions().size());
        assertEquals(2, saved.getSubQuestions().get(1).getSubQuestions().size());
        assertEquals(target.getId(), manager.find(Question.class, movingId).getParent().getId());
        assertEquals(originalQuestions, ids("Question")); assertEquals(originalAnswers, ids("QuestionAnswer"));
        assertEquals(answerId, manager.find(QuestionAnswerTestResult.class, detailId).getQuestionAnswer().getId());
        assertEquals(resultId, manager.find(QuestionAnswerTestResult.class, detailId).getTestResult().getId());
    }
    @Test public void genuinelyRemovedUnreferencedPackagesStillUseExistingOrphanRemoval() {
        QuestionDto input = new QuestionDto(manager.find(Question.class, rootId));
        QuestionDto removed = input.getSubQuestions().get(2).getSubQuestions().remove(0);
        Long removedId = removed.getId();
        service.saveObject(input); manager.flush(); manager.clear();
        assertNull(manager.find(Question.class, removedId));
        assertEquals(originalQuestions.size() - 11, ids("Question").size());
        assertEquals(originalAnswers.size() - 10, ids("QuestionAnswer").size());
        assertEquals(answerId, manager.find(QuestionAnswerTestResult.class, detailId).getQuestionAnswer().getId());
        assertEquals("SUCCESS", manager.find(TestResult.class, resultId).getResultStatus());
    }
    @Test public void aLegacyPartContainingOnlyTheMovingPackageIsRefreshedBeforeReturningTheDto() {
        QuestionDto original = new QuestionDto(manager.find(Question.class, rootId));
        original.getSubQuestions().get(2).getSubQuestions().remove(0);
        service.saveObject(original); manager.flush(); manager.clear();
        Set<Long> questionsBefore = ids("Question"), answersBefore = ids("QuestionAnswer");
        QuestionDto saved = service.saveObject(migrate()); manager.flush(); manager.clear();
        Long fourthId = saved.getSubQuestions().get(3).getId();
        for (int status : Arrays.asList(6, 7)) {
            List<QuestionDto> remaining = saved.getSubQuestions().get(2).getSubQuestions();
            assertTrue(remaining == null || remaining.isEmpty());
            assertEquals(1, saved.getSubQuestions().get(3).getSubQuestions().size());
            assertEquals(31, saved.getSubQuestions().get(3).getSubQuestions().get(0).getSubQuestions().get(0).getOrdinalNumber().intValue());
            Set<Long> expectedQuestions = new HashSet<Long>(questionsBefore); expectedQuestions.add(fourthId);
            assertEquals(expectedQuestions, ids("Question")); assertEquals(answersBefore, ids("QuestionAnswer"));
            assertEquals(answerId, manager.find(QuestionAnswerTestResult.class, detailId).getQuestionAnswer().getId());
            assertEquals(resultId, manager.find(QuestionAnswerTestResult.class, detailId).getTestResult().getId());
            saved.setStatus(status); saved = service.saveObject(saved); manager.flush(); manager.clear();
        }
    }
}
