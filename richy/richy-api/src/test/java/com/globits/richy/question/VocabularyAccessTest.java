package com.globits.richy.question;

import com.globits.richy.domain.*;
import com.globits.richy.dto.*;
import com.globits.richy.repository.*;
import com.globits.richy.service.impl.QuestionServiceImpl;
import com.globits.richy.service.impl.TopicServiceImpl;
import com.globits.richy.service.impl.TopicCategoryVisibilityService;
import com.globits.richy.rest.RestQuestionController;
import com.globits.richy.rest.RestTopicController;
import com.globits.security.domain.User;
import com.globits.security.repository.UserRepository;
import java.util.*;
import javax.persistence.EntityManager;
import javax.persistence.LockModeType;
import javax.persistence.TypedQuery;
import org.junit.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.annotation.Secured;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class VocabularyAccessTest {
    private QuestionServiceImpl cards;
    private TopicServiceImpl lessons;
    private QuestionRepository questions;
    private TopicRepository topics;
    private UserRepository users;
    private User owner;
    private QuestionType flashcard;

    @Before public void setup() {
        cards = new QuestionServiceImpl(); lessons = new TopicServiceImpl();
        questions = mock(QuestionRepository.class); topics = mock(TopicRepository.class);
        users = mock(UserRepository.class);
        QuestionTypeRepository types = mock(QuestionTypeRepository.class);
        owner = new User(); owner.setId(7L); owner.setUsername("learner");
        flashcard = new QuestionType(); flashcard.setId(6L);
        ReflectionTestUtils.setField(cards, "questionRepository", questions);
        ReflectionTestUtils.setField(cards, "topicRepository", topics);
        ReflectionTestUtils.setField(cards, "userRepository", users);
        ReflectionTestUtils.setField(cards, "questionTypeRepository", types);
        ReflectionTestUtils.setField(lessons, "topicRepository", topics);
        ReflectionTestUtils.setField(lessons, "userRepository", users);
        ReflectionTestUtils.setField(lessons, "manager", mock(EntityManager.class, RETURNS_DEEP_STUBS));
        ReflectionTestUtils.setField(lessons, "topicCategoryRepository", mock(TopicCategoryRepository.class));
        ReflectionTestUtils.setField(lessons, "topicCategoryVisibilityService", mock(TopicCategoryVisibilityService.class));
        when(users.findForVocabularyUpdate(7L)).thenReturn(owner);
        when(types.findOne(6L)).thenReturn(flashcard);
        when(types.getOne(6L)).thenReturn(flashcard);
        when(questions.countFlashCardsByUserId(7L)).thenReturn(0L);
        when(topics.countByUserId(7L)).thenReturn(0L);
        when(questions.save(any(Question.class))).thenAnswer(call -> {
            Question entity = (Question) call.getArguments()[0]; entity.setId(31L); return entity;
        });
        when(topics.save(any(Topic.class))).thenAnswer(call -> {
            Topic entity = (Topic) call.getArguments()[0]; entity.setId(11L); return entity;
        });
        login("ROLE_VIEWER");
    }
    @After public void cleanup() { SecurityContextHolder.clearContext(); }
    private void login(String... roles) {
        List<SimpleGrantedAuthority> authorities = new ArrayList<>();
        for (String role : roles) authorities.add(new SimpleGrantedAuthority(role));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(owner, "", authorities));
    }
    private QuestionDto input() {
        QuestionDto dto = new QuestionDto(); dto.setQuestion("  apple  "); dto.setPronounce("/apple/");
        dto.setMotherTongue("quả táo"); dto.setQuestionType(new QuestionTypeDto(flashcard)); return dto;
    }
    private Question existing() {
        Question entity = new Question(); entity.setId(31L); entity.setUser(owner); entity.setQuestionType(flashcard);
        entity.setQuestion("old"); entity.setDescription("Keep description"); entity.setLevel("C1");
        entity.setStatus(5); entity.setTimeReviewd(42); entity.setCorrectAnswer(20);
        when(questions.findOne(31L)).thenReturn(entity); when(questions.getOne(31L)).thenReturn(entity);
        return entity;
    }
    private static String repeat(int length) { return String.join("", Collections.nCopies(length, "x")); }

    @Test public void limitsPreferUserThenAdminAndMessagesExplainHowToContinue() {
        assertEquals(5000L, VocabularyPolicy.wordLimit(SecurityContextHolder.getContext().getAuthentication()));
        assertEquals(50L, VocabularyPolicy.lessonLimit(SecurityContextHolder.getContext().getAuthentication()));
        login("ROLE_VIEWER", "ROLE_USER");
        assertEquals(10000L, cards.getVocabularyUsage().getWordLimit());
        assertEquals(100L, cards.getVocabularyUsage().getTopicLimit());
        login("ROLE_VIEWER", "ROLE_USER", "ROLE_ADMIN");
        assertEquals(-1L, cards.getVocabularyUsage().getWordLimit());
        assertFalse(cards.getVocabularyUsage().isWordLimitReached());
        String help = VocabularyPolicy.wordLimitMessage(5000, 5000);
        assertTrue(help.contains("5000/5000")); assertTrue(help.contains("sửa và học"));
        assertTrue(help.contains("quản trị viên")); assertTrue(help.contains("nâng hạn mức"));
    }
    @Test public void viewerCreatesOnlyBasicFieldsInOwnLessonWithFreshLinks() {
        Topic lesson = new Topic(); lesson.setId(11L); lesson.setUser(owner); lesson.setName("My words");
        when(topics.findOne(11L)).thenReturn(lesson);
        QuestionDto dto = input(); dto.setDescription("Ignore"); dto.setLevel("C2"); dto.setStatus(5);
        QuestionTopicDto link = new QuestionTopicDto(); link.setId(999L); link.setTopic(new TopicDto(lesson));
        dto.setQuestionTopics(Arrays.asList(link, link));
        QuestionDto saved = cards.saveForCurrentUser(dto);
        assertEquals(Long.valueOf(31), saved.getId()); assertEquals("apple", saved.getQuestion());
        assertNull(saved.getDescription()); assertNull(saved.getLevel()); assertEquals(1, saved.getStatus());
        org.mockito.ArgumentCaptor<Question> capture = org.mockito.ArgumentCaptor.forClass(Question.class);
        verify(questions).save(capture.capture());
        Question entity = capture.getValue(); assertSame(owner, entity.getUser());
        assertEquals(1, entity.getQuestionTopics().size());
        QuestionTopic actualLink = entity.getQuestionTopics().iterator().next();
        assertNull(actualLink.getId()); assertSame(entity, actualLink.getQuestion()); assertSame(lesson, actualLink.getTopic());
    }
    @Test public void reachingWordLimitBlocksNewCardsButKeepsInputAndAllowsEdits() {
        when(questions.countFlashCardsByUserId(7L)).thenReturn(5000L);
        QuestionDto dto = input(); QuestionDto denied = cards.saveForCurrentUser(dto);
        assertNull(denied.getId()); assertTrue(denied.getMessage().contains("5000/5000"));
        assertEquals("  apple  ", dto.getQuestion()); verify(questions, never()).save(any(Question.class));
        assertTrue(cards.getVocabularyUsage().isWordLimitReached());
        Question entity = existing(); dto.setId(31L); dto.setDescription("erase"); dto.setLevel("A1"); dto.setStatus(1);
        assertNotNull(cards.saveForCurrentUser(dto).getId());
        assertEquals("Keep description", entity.getDescription()); assertEquals("C1", entity.getLevel());
        assertEquals(5, entity.getStatus()); assertEquals(42, entity.getTimeReviewd());
    }
    @Test public void userGetsLargerQuotaAndCreationLocksOwnerBeforeCounting() {
        login("ROLE_USER"); when(questions.countFlashCardsByUserId(7L)).thenReturn(9999L);
        assertNotNull(cards.saveForCurrentUser(input()).getId());
        org.mockito.InOrder order = inOrder(users, questions);
        order.verify(users).findForVocabularyUpdate(7L); order.verify(questions).countFlashCardsByUserId(7L);
        order.verify(questions).findByQuestion("apple", 7L); order.verify(questions).save(any(Question.class));
        when(questions.countFlashCardsByUserId(7L)).thenReturn(10000L);
        assertNull(cards.saveForCurrentUser(input()).getId());
    }
    @Test public void foreignCardsOwnersLessonsAndTestPayloadsAreRejected() {
        Question entity = existing(); User other = new User(); other.setId(8L); entity.setUser(other);
        QuestionDto dto = input(); dto.setId(31L); denied(() -> cards.saveForCurrentUser(dto));
        dto.setId(null); dto.setUserId(8L); denied(() -> cards.saveForCurrentUser(dto));
        dto.setUserId(null); dto.setParent(new QuestionDto()); denied(() -> cards.saveForCurrentUser(dto));
        dto.setParent(null); dto.setTestFormat("COMPREHENSIVE"); denied(() -> cards.saveForCurrentUser(dto));
        dto.setTestFormat(null);
        Topic foreign = new Topic(); foreign.setId(11L); foreign.setUser(other); when(topics.findOne(11L)).thenReturn(foreign);
        QuestionTopicDto link = new QuestionTopicDto(); link.setTopic(new TopicDto(foreign));
        dto.setQuestionTopics(Collections.singletonList(link)); denied(() -> cards.saveForCurrentUser(dto));
        verify(questions, never()).save(any(Question.class));
    }
    private void denied(Runnable request) {
        try { request.run(); fail("Expected access denied"); } catch (AccessDeniedException expected) { }
    }
    @Test public void textValidationPreservesLongInputAndAcceptsExactLimits() {
        QuestionDto dto = input(); dto.setQuestion(repeat(201));
        assertNull(cards.saveForCurrentUser(dto).getId()); assertEquals(201, dto.getQuestion().length());
        dto.setQuestion(repeat(200)); dto.setPronounce(repeat(200)); dto.setMotherTongue(repeat(500));
        assertNotNull(cards.saveForCurrentUser(dto).getId());
        dto.setMotherTongue(repeat(501)); assertTrue(cards.saveForCurrentUser(dto).getMessage().contains("500"));
        dto.setMotherTongue("meaning"); dto.setPronounce(repeat(201));
        assertTrue(cards.saveForCurrentUser(dto).getMessage().contains("200"));
        assertNull(VocabularyPolicy.validateText("word", null, null, "<p>" + repeat(1999) + "&amp;</p>", true));
        assertNotNull(VocabularyPolicy.validateText("word", null, null, "<p>" + repeat(2001) + "</p>", true));
    }
    @Test public void adminEditingRootFlashcardPreservesLegacyAnswersAndAcceptsLongerMeaning() {
        login("ROLE_ADMIN"); Question entity = existing();
        QuestionAnswer legacy = new QuestionAnswer(); legacy.setId(19L); legacy.setQuestion(entity);
        Set<QuestionAnswer> answers = new HashSet<>(); answers.add(legacy); entity.setQuestionAnswers(answers);
        QuestionDto dto = input(); dto.setId(31L); dto.setMotherTongue(repeat(500));
        dto.setQuestionAnswers(new ArrayList<QuestionAnswerDto>());
        assertNotNull(cards.saveForCurrentUser(dto).getId());
        assertSame(answers, entity.getQuestionAnswers()); assertTrue(answers.contains(legacy));
    }
    @Test public void lessonQuotaBlocksOnlyCreatesAndCannotChangeOwnerOrAdvancedFields() {
        TopicDto dto = new TopicDto(); dto.setName("My lesson"); dto.setContent("Ignore");
        when(topics.countByUserId(7L)).thenReturn(50L);
        assertNull(lessons.saveObject(dto).getId()); verify(topics, never()).save(any(Topic.class));
        assertTrue(cards.getVocabularyUsage().isTopicLimitReached());
        Topic stored = new Topic(); stored.setId(11L); stored.setUser(owner); stored.setContent("Keep"); stored.setIsShow(false);
        when(topics.findOne(11L)).thenReturn(stored); dto.setId(11L); dto.setIsShow(true);
        assertNotNull(lessons.saveObject(dto).getId()); assertEquals("Keep", stored.getContent()); assertEquals(Boolean.FALSE, stored.getIsShow());
        dto.setUserId(8L); denied(() -> lessons.saveObject(dto));
    }
    @Test public void userAndViewerCreateLessonsAtTheirOwnLimitsWithAccountLock() {
        TopicDto dto = new TopicDto(); dto.setName("New lesson");
        when(topics.countByUserId(7L)).thenReturn(49L); assertNotNull(lessons.saveObject(dto).getId());
        login("ROLE_USER"); when(topics.countByUserId(7L)).thenReturn(99L);
        assertNotNull(lessons.saveObject(dto).getId());
        when(topics.countByUserId(7L)).thenReturn(100L); assertNull(lessons.saveObject(dto).getId());
        org.mockito.InOrder order = inOrder(users, topics);
        order.verify(users).findForVocabularyUpdate(7L); order.verify(topics).countByUserId(7L);
        login("ROLE_ADMIN"); when(topics.countByUserId(7L)).thenReturn(99999L);
        assertNotNull(lessons.saveObject(dto).getId());
    }
    @Test public void learnerExportWithoutLessonIsLimitedToAuthenticatedOwnerEvenWhenSpoofed() {
        EntityManager manager = mock(EntityManager.class); TypedQuery<QuestionLevelDto> query = mock(TypedQuery.class);
        ReflectionTestUtils.setField(cards, "manager", manager);
        when(manager.createQuery(anyString(), eq(QuestionLevelDto.class))).thenReturn(query);
        when(query.getResultList()).thenReturn(Collections.emptyList());
        QuestionDto filter = new QuestionDto(); filter.setUserId(88L);
        cards.getFlashCardLevels(filter);
        org.mockito.ArgumentCaptor<String> hql = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(manager).createQuery(hql.capture(), eq(QuestionLevelDto.class));
        assertTrue(hql.getValue().contains("q.user.id = :userId"));
        assertFalse(hql.getValue().contains(":topicIds"));
        verify(query).setParameter("userId", 7L); verify(query, never()).setParameter("userId", 88L);
    }
    @Test public void httpPermissionsKeepImportAndAdvancedEditingAdminOnly() throws Exception {
        for (java.lang.reflect.Method method : RestQuestionController.class.getDeclaredMethods()) {
            if (Arrays.asList("previewExcelImport", "confirmExcelImport", "updateFlashCardLevel").contains(method.getName())) {
                assertArrayEquals(new String[]{"ROLE_ADMIN"}, method.getAnnotation(Secured.class).value());
            }
        }
        Secured save = RestQuestionController.class.getMethod("saveOne", QuestionDto.class).getAnnotation(Secured.class);
        assertTrue(Arrays.asList(save.value()).contains("ROLE_VIEWER"));
        assertTrue(Arrays.asList(save.value()).contains("ROLE_USER"));
        Secured deleteLesson = RestTopicController.class.getMethod("deleteOne", Long.class).getAnnotation(Secured.class);
        assertArrayEquals(new String[]{"ROLE_ADMIN", "ROLE_USER", "ROLE_VIEWER"}, deleteLesson.value());
        assertNotNull(QuestionServiceImpl.class.getMethod("saveForCurrentUser", QuestionDto.class)
            .getAnnotation(org.springframework.transaction.annotation.Transactional.class));
        assertNotNull(TopicServiceImpl.class.getMethod("saveObject", TopicDto.class)
            .getAnnotation(org.springframework.transaction.annotation.Transactional.class));
        assertEquals(javax.persistence.LockModeType.PESSIMISTIC_WRITE,
            UserRepository.class.getMethod("findForVocabularyUpdate", Long.class)
                .getAnnotation(org.springframework.data.jpa.repository.Lock.class).value());
    }
    @Test public void alternateMaterialSaveUsesTheSameEditorBoundary() {
        QuestionServiceImpl endpoint = spy(cards); QuestionDto dto = input();
        doReturn(false).when(endpoint).checkDuplicate(dto);
        doReturn(new QuestionDto()).when(endpoint).saveForCurrentUser(dto);
        endpoint.saveMaterial(dto);
        verify(endpoint).saveForCurrentUser(dto); verify(endpoint, never()).saveObject(dto);
    }
    @Test public void deletionCannotRemoveAnotherAccountsCardsOrLessons() {
        login("ROLE_USER"); Question card = existing(); User other = new User(); other.setId(99L); card.setUser(other);
        Topic lesson = new Topic(); lesson.setId(11L); lesson.setUser(other);
        EntityManager manager = (EntityManager) ReflectionTestUtils.getField(lessons, "manager");
        when(manager.find(Topic.class, 11L, LockModeType.PESSIMISTIC_WRITE)).thenReturn(lesson);
        denied(() -> cards.deleteObject(31L)); denied(() -> lessons.deleteObject(11L));
        verify(questions, never()).delete(card); verify(topics, never()).delete(lesson);
        card.setUser(owner); lesson.setUser(owner);
        assertTrue(cards.deleteObject(31L)); assertTrue(lessons.deleteObject(11L));
    }
    @Test public void vocabularyWorkspaceReturnsOnlyOwnRootCardsAndSupportsAllStatusesAndUnassigned() {
        EntityManager manager = mock(EntityManager.class); TypedQuery<QuestionDto> rows = mock(TypedQuery.class);
        javax.persistence.Query count = mock(javax.persistence.Query.class);
        ReflectionTestUtils.setField(cards, "manager", manager);
        when(manager.createQuery(anyString(), eq(QuestionDto.class))).thenReturn(rows);
        when(manager.createQuery(anyString())).thenReturn(count);
        when(rows.getResultList()).thenReturn(Collections.emptyList()); when(count.getSingleResult()).thenReturn(0L);
        QuestionDto filter = new QuestionDto(); filter.setUserId(99L); filter.setStatus(0); filter.setWithoutTopics(true);
        assertTrue(cards.getVocabularyPage(filter, 1, 12).getContent().isEmpty());
        org.mockito.ArgumentCaptor<String> hql = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(manager).createQuery(hql.capture(), eq(QuestionDto.class));
        assertTrue(hql.getValue().contains("q.questionType.id = 6 and q.parent is null and q.user.id = :owner"));
        assertTrue(hql.getValue().contains("not exists")); assertFalse(hql.getValue().contains("q.status"));
        verify(rows).setParameter("owner", 7L); verify(count).setParameter("owner", 7L);
        verify(rows, never()).setParameter("owner", 99L);
    }
    @Test public void vocabularyWorkspaceFiltersByLessonListeningAndMeaningAndClampsPageSize() {
        EntityManager manager = mock(EntityManager.class); TypedQuery<QuestionDto> rows = mock(TypedQuery.class);
        javax.persistence.Query count = mock(javax.persistence.Query.class);
        ReflectionTestUtils.setField(cards, "manager", manager);
        when(manager.createQuery(anyString(), eq(QuestionDto.class))).thenReturn(rows);
        when(manager.createQuery(anyString())).thenReturn(count);
        when(rows.getResultList()).thenReturn(Collections.emptyList()); when(count.getSingleResult()).thenReturn(0L);
        QuestionDto filter = new QuestionDto(); filter.setTopicId(11L); filter.setStatus(5); filter.setTextSearch("  APPLE  "); filter.setFindExactWord(false);
        cards.getVocabularyPage(filter, 0, 10000);
        org.mockito.ArgumentCaptor<String> hql = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(manager).createQuery(hql.capture(), eq(QuestionDto.class));
        assertTrue(hql.getValue().contains("link.topic.id = :lesson")); assertTrue(hql.getValue().contains("q.status = 5"));
        assertTrue(hql.getValue().contains("lower(q.motherTongue) like :term"));
        for (javax.persistence.Query query : Arrays.asList(rows, count)) {
            verify(query).setParameter("owner", 7L); verify(query).setParameter("lesson", 11L); verify(query).setParameter("term", "%apple%");
        }
        verify(rows).setFirstResult(0); verify(rows).setMaxResults(500);
    }
}
