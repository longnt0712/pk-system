package com.globits.richy.question;

import com.globits.richy.domain.*;
import com.globits.richy.dto.QuestionDto;
import com.globits.richy.repository.TopicRepository;
import com.globits.richy.service.impl.QuestionServiceImpl;
import com.globits.richy.service.impl.TopicServiceImpl;
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

/** Exercise the real lesson links and JPQL filters against Hibernate, including unlink-only deletion. */
public class VocabularyWorkspacePersistenceTest {
    private static SessionFactory factory;
    private EntityManager manager;
    private QuestionServiceImpl cards;
    private TopicServiceImpl lessons;
    private Long lessonId, foreignLessonId;

    @BeforeClass public static void database() throws Exception {
        JdbcDataSource source = new JdbcDataSource(); source.setURL("jdbc:h2:mem:vocabulary_workspace;MODE=MSSQLServer;DB_CLOSE_DELAY=-1");
        Configuration config = new Configuration().setProperty("hibernate.dialect", "org.hibernate.dialect.H2Dialect")
            .setProperty("hibernate.hbm2ddl.auto", "create-drop").setProperty("hibernate.show_sql", "false");
        config.getProperties().put("hibernate.connection.datasource", source);
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));
        for (String base : Arrays.asList("com.globits.richy", "com.globits.core", "com.globits.security")) {
            for (org.springframework.beans.factory.config.BeanDefinition entity : scanner.findCandidateComponents(base)) {
                config.addAnnotatedClass(Class.forName(entity.getBeanClassName()));
            }
        }
        factory = config.buildSessionFactory();
        EntityManager seed = factory.createEntityManager(); seed.getTransaction().begin();
        for (int index = 1; index <= 6; index++) { QuestionType type = new QuestionType(); type.setName("Type " + index); seed.persist(type); }
        seed.getTransaction().commit(); seed.close();
    }
    @AfterClass public static void closeDatabase() { if (factory != null) factory.close(); }
    @Before public void setup() {
        manager = factory.createEntityManager(); manager.getTransaction().begin();
        User owner = user(), other = user();
        Topic lesson = topic(owner), foreign = topic(other); lessonId = lesson.getId(); foreignLessonId = foreign.getId();
        Question alpha = word(owner, "alpha", "nghĩa một", 1, lesson);
        word(owner, "listening", "nghe", 5, lesson); word(owner, "orphan", "chưa vào bài", 1, null);
        word(other, "foreign", "từ người khác", 1, foreign);
        Question nested = word(owner, "nested", "mục con", 1, null); nested.setParent(alpha);
        manager.flush(); manager.clear();
        cards = new QuestionServiceImpl(); ReflectionTestUtils.setField(cards, "manager", manager);
        lessons = new TopicServiceImpl(); ReflectionTestUtils.setField(lessons, "manager", manager);
        TopicRepository repository = mock(TopicRepository.class);
        when(repository.getOne(anyLong())).thenAnswer(call -> manager.find(Topic.class, call.getArguments()[0]));
        doAnswer(call -> { manager.remove(call.getArguments()[0]); return null; }).when(repository).delete(any(Topic.class));
        ReflectionTestUtils.setField(lessons, "topicRepository", repository);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(owner, "",
            Collections.singletonList(new SimpleGrantedAuthority("ROLE_USER"))));
    }
    @After public void cleanup() {
        if (manager != null) { if (manager.getTransaction().isActive()) manager.getTransaction().rollback(); manager.close(); }
        SecurityContextHolder.clearContext();
    }
    private User user() {
        User user = new User(); user.setUsername(UUID.randomUUID().toString()); user.setEmail(user.getUsername() + "@test.local");
        user.setPassword("unused"); manager.persist(user); return user;
    }
    private Topic topic(User owner) { Topic topic = new Topic(); topic.setUser(owner); topic.setName("Vocabulary"); manager.persist(topic); return topic; }
    private Question word(User owner, String text, String meaning, int status, Topic lesson) {
        Question card = new Question(); card.setQuestionType(manager.find(QuestionType.class, 6L)); card.setUser(owner);
        card.setQuestion(text); card.setMotherTongue(meaning); card.setStatus(status); manager.persist(card);
        if (lesson != null) { QuestionTopic link = new QuestionTopic(); link.setQuestion(card); link.setTopic(lesson); manager.persist(link); }
        return card;
    }
    @Test public void lessonAllListeningMeaningAndUnassignedQueriesReturnTheCorrectPersonalCards() {
        QuestionDto search = new QuestionDto(); search.setStatus(0);
        assertEquals(3, cards.getVocabularyPage(search, 1, 8).getTotalElements());
        search.setTopicId(lessonId); assertEquals(2, cards.getVocabularyPage(search, 1, 8).getTotalElements());
        search.setStatus(5); assertEquals("listening", cards.getVocabularyPage(search, 1, 8).getContent().get(0).getQuestion());
        search.setStatus(0); search.setTextSearch("NGHĨA MỘT"); search.setFindExactWord(false);
        assertEquals("alpha", cards.getVocabularyPage(search, 1, 8).getContent().get(0).getQuestion());
        search.setTextSearch(null); search.setTopicId(foreignLessonId);
        assertTrue(cards.getVocabularyPage(search, 1, 8).getContent().isEmpty());
        search.setTopicId(null); search.setWithoutTopics(true);
        assertEquals("orphan", cards.getVocabularyPage(search, 1, 8).getContent().get(0).getQuestion());
    }
    @Test public void exactWordSearchKeepsSameWordVariantsAndExcludesPartialMeaningAndOtherOwners() {
        User owner = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        Topic lesson = manager.find(Topic.class, lessonId);
        word(owner, "Alpha", "another sense", 1, lesson);
        word(owner, "alphabet", "letters", 1, lesson);
        word(owner, "meaning match", "alpha", 1, lesson);
        word(user(), "alpha", "another owner's card", 1, null);
        manager.flush(); manager.clear();
        QuestionDto search = new QuestionDto(); search.setStatus(0); search.setTextSearch("  ALPHA  ");
        assertTrue(search.isFindExactWord());
        org.springframework.data.domain.Page<QuestionDto> exact = cards.getVocabularyPage(search, 1, 8);
        assertEquals(2, exact.getTotalElements());
        for (QuestionDto card : exact.getContent()) { assertEquals("alpha", card.getQuestion().toLowerCase(Locale.ROOT)); }
        search.setFindExactWord(false);
        assertEquals(4, cards.getVocabularyPage(search, 1, 8).getTotalElements());
        search.setTopicId(foreignLessonId);
        assertEquals(0, cards.getVocabularyPage(search, 1, 8).getTotalElements());
    }
    @Test public void vocabularyDetailsIncludeEveryLinkedTopicRegardlessOfCardPageSize() {
        Question alpha = manager.createQuery("select q from Question q where q.id in (select l.question.id from QuestionTopic l where l.topic.id = :lesson) and q.question = 'alpha'", Question.class)
            .setParameter("lesson", lessonId).getSingleResult();
        for (int index = 1; index <= 35; index++) {
            Topic lesson = topic(alpha.getUser()); lesson.setName("Lesson " + index);
            QuestionTopic link = new QuestionTopic(); link.setQuestion(alpha); link.setTopic(lesson); manager.persist(link);
        }
        manager.flush(); manager.clear();
        QuestionDto search = new QuestionDto(); search.setStatus(0); search.setTextSearch("alpha");
        QuestionDto detail = cards.getVocabularyPage(search, 1, 1).getContent().get(0);
        assertEquals(36, detail.getQuestionTopics().size());
        Set<Long> topicIds = new HashSet<Long>();
        for (com.globits.richy.dto.QuestionTopicDto link : detail.getQuestionTopics()) {
            assertNotNull(link.getTopic().getName()); topicIds.add(link.getTopic().getId());
        }
        assertEquals(36, topicIds.size());
    }
    @Test public void deletingLessonUnlinksItsCardsWithoutDeletingVocabulary() {
        Long before = manager.createQuery("select count(q.id) from Question q", Long.class).getSingleResult();
        assertTrue(lessons.deleteObject(lessonId)); manager.flush(); manager.clear();
        assertNull(manager.find(Topic.class, lessonId));
        assertEquals(before, manager.createQuery("select count(q.id) from Question q", Long.class).getSingleResult());
        QuestionDto search = new QuestionDto(); search.setStatus(0); search.setWithoutTopics(true);
        assertEquals(3, cards.getVocabularyPage(search, 1, 8).getTotalElements());
        assertNotNull(manager.find(Topic.class, foreignLessonId));
    }
}
