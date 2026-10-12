package com.globits.richy.question;

import com.globits.richy.domain.*;
import com.globits.richy.dto.QuestionDto;
import com.globits.richy.repository.*;
import com.globits.richy.service.impl.DailyListeningServiceImpl;
import com.globits.security.domain.User;
import java.util.*;
import org.junit.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.mockito.Matchers.*;

public class DailyListeningServiceTest {
    private DailyListeningServiceImpl service;
    private QuestionRepository repository;
    private TestFolderRepository folders;
    private Question legacy;
    private User teacher, originalOwner;
    @Before public void setup() {
        teacher = new User(); teacher.setId(7L); teacher.setUsername("teacher");
        originalOwner = new User(); originalOwner.setId(26L);
        login("ROLE_ADMIN");
        repository = mock(QuestionRepository.class); folders = mock(TestFolderRepository.class);
        QuestionTypeRepository types = mock(QuestionTypeRepository.class);
        QuestionType test = new QuestionType(); test.setId(11L); when(types.findOne(11L)).thenReturn(test);
        QuestionType card = new QuestionType(); card.setId(6L);
        legacy = new Question(); legacy.setId(21L); legacy.setQuestionType(card); legacy.setStatus(5); legacy.setUser(originalOwner);
        legacy.setQuestion("Old lesson"); legacy.setPronounce("https://school.test/audio.mp3"); legacy.setMotherTongue("<p>We listen every day.</p>");
        legacy.setTimeReviewd(142); legacy.setCorrectAnswer(3); legacy.setWrongAnswer(1);
        legacy.setQuestionTopics(new HashSet<QuestionTopic>(Arrays.asList(new QuestionTopic())));
        legacy.setQuestionAnswers(new HashSet<QuestionAnswer>(Arrays.asList(new QuestionAnswer())));
        when(repository.findOne(21L)).thenReturn(legacy);
        when(repository.save(any(Question.class))).thenAnswer(call -> { Question value = (Question) call.getArguments()[0]; if (value.getId() == null) value.setId(30L); return value; });
        service = new DailyListeningServiceImpl(); ReflectionTestUtils.setField(service, "questions", repository);
        ReflectionTestUtils.setField(service, "questionTypes", types); ReflectionTestUtils.setField(service, "folders", folders);
    }
    private void login(String role) { SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(teacher, "", Collections.singletonList(new SimpleGrantedAuthority(role)))); }
    @After public void logout() { SecurityContextHolder.clearContext(); }
    @Test public void migrationReclassifiesInPlaceAndRetainsHistoryAndRelationships() {
        Set<QuestionTopic> topics = legacy.getQuestionTopics(); Set<QuestionAnswer> answers = legacy.getQuestionAnswers();
        QuestionDto moved = service.migrate(21L);
        assertEquals(Long.valueOf(21), moved.getId()); assertEquals(Long.valueOf(11), moved.getQuestionType().getId());
        assertEquals("DAILY_LISTENING", moved.getTestFormat()); assertEquals(7, moved.getStatus());
        assertSame(originalOwner, legacy.getUser()); assertSame(topics, legacy.getQuestionTopics()); assertSame(answers, legacy.getQuestionAnswers());
        assertEquals("<p>We listen every day.</p>", moved.getMotherTongue()); assertEquals(142, moved.getTimeReviewd()); assertEquals(3, moved.getCorrectAnswer());
        assertEquals("Old lesson", legacy.getTitle()); assertEquals("teacher", legacy.getModifiedBy());
        service.migrate(21L); verify(repository, times(1)).save(legacy);
    }
    @Test public void unmarkedListeningCanAlsoMigrateAndInvalidContentIsUntouched() {
        legacy.setStatus(1); service.migrate(21L); assertTrue(DailyListeningServiceImpl.isDailyTest(legacy));
        QuestionType card = new QuestionType(); card.setId(6L); legacy.setQuestionType(card); legacy.setTestFormat(null); legacy.setStatus(5);
        legacy.setPronounce("javascript:bad");
        try { service.migrate(21L); fail(); } catch (IllegalArgumentException expected) {}
        assertEquals(Long.valueOf(6), legacy.getQuestionType().getId()); assertEquals(5, legacy.getStatus());
    }
    @Test public void migrationUsesTranscriptAsTitleIfAnOldListeningCardHasNoName() {
        legacy.setQuestion(null); QuestionDto saved = service.migrate(21L);
        assertEquals("We listen every day.", saved.getTitle()); assertNull(legacy.getQuestion());
    }
    @Test public void saveCreatesARealSharedTestAndIgnoresClientOwnershipAndCounters() {
        QuestionDto input = content(); input.setUserId(99L); input.setTimeReviewd(999);
        QuestionDto saved = service.save(input);
        assertEquals(Long.valueOf(30), saved.getId()); assertEquals(Long.valueOf(7), saved.getUser().getId());
        assertEquals(Long.valueOf(11), saved.getQuestionType().getId()); assertEquals("DAILY_LISTENING", saved.getTestFormat()); assertEquals(7, saved.getStatus());
        assertEquals(0, saved.getTimeReviewd()); assertEquals("New listening", saved.getTitle());
    }
    @Test public void editingDoesNotReassignOrResetAnImportedLesson() {
        service.migrate(21L); QuestionDto input = content(); input.setId(21L); input.setUserId(99L); input.setTimeReviewd(0);
        service.save(input); assertSame(originalOwner, legacy.getUser()); assertEquals(142, legacy.getTimeReviewd());
        assertEquals(1, legacy.getQuestionAnswers().size()); assertEquals("A new transcript.", legacy.getMotherTongue());
    }
    @Test public void onlyDailyFoldersCanBeUsedAndAnOrdinaryFlashcardCannotBeOverwritten() {
        QuestionDto input = content(); input.setId(21L);
        try { service.save(input); fail(); } catch (IllegalArgumentException expected) {}
        input.setId(null); input.setTestFolderId(5L); TestFolder folder = new TestFolder(); folder.setId(5L); folder.setTestMode("READING");
        when(folders.findOne(5L)).thenReturn(folder);
        try { service.save(input); fail(); } catch (IllegalArgumentException expected) {}
        folder.setTestMode("DAILY_LISTENING"); assertEquals(Long.valueOf(5), service.save(input).getTestFolderId());
    }
    @Test public void invalidTranscriptAndUnsupportedMediaAreRejectedBeforeSaving() {
        QuestionDto input = content(); input.setMotherTongue("<p>&nbsp;</p>");
        try { service.save(input); fail(); } catch (IllegalArgumentException expected) {}
        input = content(); input.setPronounce("https://www.tiktok.com/video/1");
        try { service.save(input); fail(); } catch (IllegalArgumentException expected) {}
        verify(repository, never()).save(any(Question.class));
    }
    @Test(expected = AccessDeniedException.class) public void studentsCannotMigrateSharedResources() { login("ROLE_VIEWER"); service.migrate(21L); }
    private QuestionDto content() {
        QuestionDto input = new QuestionDto(); input.setQuestion("New listening"); input.setPronounce("https://school.test/new.mp3"); input.setMotherTongue("A new transcript."); return input;
    }
}
