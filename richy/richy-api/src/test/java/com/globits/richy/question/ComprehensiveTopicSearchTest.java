package com.globits.richy.question;

import com.globits.richy.domain.*;
import com.globits.richy.dto.*;
import com.globits.richy.service.impl.QuestionServiceImpl;
import com.globits.richy.service.impl.EnrolmentClassServiceImpl;
import com.globits.richy.repository.QuestionRepository;
import com.globits.richy.repository.QuestionTopicRepository;
import com.globits.security.domain.User;
import java.util.*;
import java.util.stream.Collectors;
import javax.persistence.Entity;
import javax.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.*;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.data.domain.Page;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

/** Exercises the real catalog search and count queries using an isolated database. */
public class ComprehensiveTopicSearchTest {
    private static SessionFactory factory;
    private EntityManager manager;
    private QuestionServiceImpl service;
    private QuestionType type;
    private User owner;
    private Topic topic;
    private TopicCategory category;

    @BeforeClass public static void createDatabase() throws Exception {
        JdbcDataSource dataSource = new JdbcDataSource();
        dataSource.setURL("jdbc:h2:mem:comprehensive_topic_search;MODE=MSSQLServer;DB_CLOSE_DELAY=-1");
        Configuration config = new Configuration().setProperty("hibernate.dialect", "org.hibernate.dialect.H2Dialect")
                .setProperty("hibernate.hbm2ddl.auto", "create-drop").setProperty("hibernate.show_sql", "false");
        config.getProperties().put("hibernate.connection.datasource", dataSource);
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));
        for (org.springframework.beans.factory.config.BeanDefinition definition : scanner.findCandidateComponents("com.globits")) {
            config.addAnnotatedClass(Class.forName(definition.getBeanClassName()));
        }
        factory = config.buildSessionFactory();
    }
    @AfterClass public static void closeDatabase() { if (factory != null) factory.close(); }
    @Before public void seed() {
        manager = factory.createEntityManager(); manager.getTransaction().begin();
        service = new QuestionServiceImpl(); ReflectionTestUtils.setField(service, "manager", manager);
        type = new QuestionType(); type.setName("Tests"); manager.persist(type);
        com.globits.richy.repository.QuestionTypeRepository types = mock(com.globits.richy.repository.QuestionTypeRepository.class);
        when(types.getOne(type.getId())).thenReturn(type); ReflectionTestUtils.setField(service, "questionTypeRepository", types);
        owner = new User(); owner.setUsername("topic-owner"); owner.setEmail("owner@example.test"); owner.setPassword("unused"); manager.persist(owner);
        category = new TopicCategory(); category.setName("GRADE 6"); manager.persist(category);
        topic = topic("Animals"); Topic another = topic("Food");
        question("Standalone", 7, "COMPREHENSIVE"); question("Draft", 6, "COMPREHENSIVE");
        question("Hidden", 8, "COMPREHENSIVE"); question("Reading", 7, null);
        Question tagged = question("Tagged", 7, "COMPREHENSIVE"); link(tagged, topic); link(tagged, another);
        manager.flush(); manager.clear();
    }
    @After public void rollback() {
        if (manager != null) { if (manager.getTransaction().isActive()) manager.getTransaction().rollback(); manager.close(); }
    }
    private Topic topic(String name) { Topic value = new Topic(); value.setName(name); value.setTopicCategory(category); value.setUser(owner); manager.persist(value); return value; }
    private Question question(String title, int status, String format) {
        Question value = new Question(); value.setTitle(title); value.setQuestionType(type); value.setStatus(status);
        value.setTestFormat(format); value.setOrdinalNumber(1); manager.persist(value); return value;
    }
    private void link(Question question, Topic topic) { QuestionTopic link = new QuestionTopic(); link.setQuestion(question); link.setTopic(topic); manager.persist(link); }
    private QuestionDto filter(int status) {
        QuestionDto dto = new QuestionDto(); dto.setLower(0); dto.setUpper(100); dto.setStatus(status); dto.setTestFormat("COMPREHENSIVE");
        QuestionTypeDto kind = new QuestionTypeDto(); kind.setId(type.getId()); dto.setQuestionType(kind); return dto;
    }
    private void expect(QuestionDto dto, String... titles) {
        Page<QuestionForTestsDto> page = service.getPageObjectForTests(dto, 1, 100);
        assertEquals(new HashSet<String>(Arrays.asList(titles)), page.getContent().stream().map(QuestionForTestsDto::getTitle).collect(Collectors.toSet()));
        assertEquals(titles.length, page.getTotalElements());
    }
    private Question writingTest(String title, int status, QuestionType kind, int... tasks) {
        Question root = question(title, status, "WRITING"); root.setQuestionType(kind);
        Question part = question(title + " passage", 7, null); part.setParent(root);
        for (int task : tasks) {
            Question pack = question(title + " task " + task, 7, null);
            pack.setParent(part); pack.setType(task == 1 ? 16 : 17);
        }
        return root;
    }
    @Test public void scheduleCatalogDetectsAvailableWritingTasksUsingTheRealQueries() throws Exception {
        QuestionType kind = manager.find(QuestionType.class, 11L);
        if (kind == null) {
            manager.createNativeQuery("insert into tbl_question_type (id, name, create_date, created_by) "
                + "values (11, 'Published tests', CURRENT_TIMESTAMP, 'test')").executeUpdate();
            kind = manager.find(QuestionType.class, 11L);
        }
        Question task1 = writingTest("Task 1 only", 7, kind, 1, 1);
        writingTest("Task 2 only", 7, kind, 2); writingTest("Both tasks", 7, kind, 1, 2);
        writingTest("Draft writing", 6, kind, 1); writingTest("Hidden writing", 8, kind, 2);
        link(task1, topic); manager.flush(); manager.clear();

        String catalogQuery = QuestionRepository.class.getMethod("findPublishedIeltsTests")
            .getAnnotation(org.springframework.data.jpa.repository.Query.class).value();
        String partsQuery = QuestionRepository.class.getMethod("findPublishedWritingTaskTypes")
            .getAnnotation(org.springframework.data.jpa.repository.Query.class).value();
        String topicsQuery = QuestionTopicRepository.class.getMethod("findPublishedTestTopicIds")
            .getAnnotation(org.springframework.data.jpa.repository.Query.class).value();
        List<Object[]> parts = manager.createQuery(partsQuery, Object[].class).getResultList();
        assertEquals(4, parts.size()); // Duplicate packages do not duplicate task choices.
        QuestionRepository questions = mock(QuestionRepository.class);
        QuestionTopicRepository topics = mock(QuestionTopicRepository.class);
        when(questions.findPublishedIeltsTests()).thenReturn(manager.createQuery(catalogQuery, QuestionForTestsDto.class).getResultList());
        when(questions.findPublishedWritingTaskTypes()).thenReturn(parts);
        when(topics.findPublishedTestTopicIds()).thenReturn(manager.createQuery(topicsQuery, Object[].class).getResultList());
        EnrolmentClassServiceImpl schedules = new EnrolmentClassServiceImpl();
        ReflectionTestUtils.setField(schedules, "questionRepository", questions);
        ReflectionTestUtils.setField(schedules, "questionTopicRepository", topics);
        Map<String, QuestionForTestsDto> catalog = schedules.getAssignableIeltsTests().stream()
            .collect(Collectors.toMap(QuestionForTestsDto::getTitle, item -> item));
        assertEquals(3, catalog.size());
        assertTrue(catalog.get("Task 1 only").isHasWritingTask1()); assertFalse(catalog.get("Task 1 only").isHasWritingTask2());
        assertFalse(catalog.get("Task 2 only").isHasWritingTask1()); assertTrue(catalog.get("Task 2 only").isHasWritingTask2());
        assertTrue(catalog.get("Both tasks").isHasWritingTask1()); assertTrue(catalog.get("Both tasks").isHasWritingTask2());
        assertEquals(topic.getId(), catalog.get("Task 1 only").getTopics().get(0).getId());
    }
    @Test public void allPublishedTestsIncludeTaggedAndStandaloneTests() { expect(filter(7), "Tagged", "Standalone"); }
    @Test public void unassignedSearchKeepsDraftAndHiddenVisibilityRules() {
        QuestionDto dto = filter(9); dto.setWithoutTopics(true); expect(dto, "Draft", "Standalone");
        dto.setStatus(7); expect(dto, "Standalone"); dto.setStatus(8); expect(dto, "Hidden");
    }
    @Test public void unassignedSearchIgnoresStaleTopicSelectionsAndStillSearchesTheTitle() {
        QuestionDto dto = filter(9); dto.setWithoutTopics(true); dto.setTopicOwnerUserId(owner.getId());
        dto.setTopicCategoryId(category.getId()); dto.setTopicId(topic.getId());
        QuestionTopicDto selected = new QuestionTopicDto(); TopicDto selectedTopic = new TopicDto(); selectedTopic.setId(topic.getId()); selected.setTopic(selectedTopic);
        dto.setQuestionTopics(Collections.singletonList(selected)); dto.setTextSearch("Stand"); dto.setFindExactWord(false);
        expect(dto, "Standalone");
    }
    @Test public void explicitTopicFiltersStillWorkAndDoNotDuplicateTests() {
        QuestionDto dto = filter(7); dto.setTopicOwnerUserId(owner.getId()); dto.setTopicCategoryId(category.getId()); expect(dto, "Tagged");
        dto.setTopicId(topic.getId()); expect(dto, "Tagged");
    }
    @Test public void pageCountsAreConsistentForUnassignedAndAllTests() {
        QuestionDto dto = filter(9); dto.setWithoutTopics(true);
        Page<QuestionForTestsDto> first = service.getPageObjectForTests(dto, 1, 1), second = service.getPageObjectForTests(dto, 2, 1);
        assertEquals(2L, first.getTotalElements()); assertEquals(2L, second.getTotalElements());
        assertNotEquals(first.getContent().get(0).getId(), second.getContent().get(0).getId());
        dto.setWithoutTopics(false); dto.setStatus(7);
        first = service.getPageObjectForTests(dto, 1, 1); second = service.getPageObjectForTests(dto, 2, 1);
        assertEquals(2L, first.getTotalElements()); assertEquals(2L, second.getTotalElements());
        assertNotEquals(first.getContent().get(0).getId(), second.getContent().get(0).getId());
    }
}
