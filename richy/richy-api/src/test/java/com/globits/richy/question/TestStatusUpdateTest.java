package com.globits.richy.question;

import com.globits.richy.domain.*;
import com.globits.richy.dto.QuestionForTestsDto;
import com.globits.richy.repository.QuestionRepository;
import com.globits.richy.service.impl.QuestionServiceImpl;
import com.globits.security.domain.User;
import java.util.*;
import org.junit.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.mockito.Matchers.*;

public class TestStatusUpdateTest {
    private QuestionServiceImpl service;
    private QuestionRepository repository;
    private Question record;
    private User owner;
    @Before public void setup() {
        owner = new User(); owner.setId(7L); owner.setUsername("teacher"); login(owner, "ROLE_USER");
        record = new Question(); record.setId(20L); record.setTitle("Saved title"); record.setUser(owner);
        QuestionType type = new QuestionType(); type.setId(11L); record.setQuestionType(type);
        record.setQuestion("Saved questions"); record.setPronounce("https://school.test/audio.mp3");
        record.setMotherTongue("Saved listening transcript."); record.setStatus(7); record.setTimeReviewd(142);
        repository = mock(QuestionRepository.class); when(repository.findOne(20L)).thenReturn(record);
        when(repository.save(any(Question.class))).thenAnswer(call -> call.getArguments()[0]);
        service = new QuestionServiceImpl(); ReflectionTestUtils.setField(service, "questionRepository", repository);
    }
    private void login(User user, String role) { SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, "", Collections.singletonList(new SimpleGrantedAuthority(role)))); }
    @After public void logout() { SecurityContextHolder.clearContext(); }
    @Test public void toggleAllFiveModesOnlyChangesStatusAndAudit() {
        for (String mode : Arrays.asList("READING", "LISTENING", "WRITING", "COMPREHENSIVE", "DAILY_LISTENING")) {
            record.setTestFormat(mode);
            for (int status : new int[]{6, 7}) {
                QuestionForTestsDto saved = service.updateTestStatus(20L, status);
                assertEquals(status, saved.getStatus()); assertEquals(Long.valueOf(20), saved.getId());
                assertSame(owner, record.getUser()); assertEquals(142, record.getTimeReviewd());
                assertEquals("Saved title", record.getTitle()); assertEquals("Saved questions", record.getQuestion());
                assertEquals("https://school.test/audio.mp3", record.getPronounce()); assertEquals("Saved listening transcript.", record.getMotherTongue());
            }
        }
    }
    @Test public void dailyPublishValidatesStoredAudioAndTranscriptBeforeChangingStatus() {
        record.setTestFormat("DAILY_LISTENING"); record.setStatus(6);
        record.setPronounce("javascript:bad");
        try { service.updateTestStatus(20L, 7); fail(); } catch (IllegalArgumentException expected) {}
        record.setPronounce("https://school.test/audio.mp3"); record.setMotherTongue("<p>&nbsp;</p>");
        try { service.updateTestStatus(20L, 7); fail(); } catch (IllegalArgumentException expected) {}
        assertEquals(6, record.getStatus()); verify(repository, never()).save(any(Question.class));
    }
    @Test public void missingChildAndNonTestRowsAreRejected() {
        try { service.updateTestStatus(99L, 7); fail(); } catch (IllegalArgumentException expected) {}
        record.setParent(new Question());
        try { service.updateTestStatus(20L, 6); fail(); } catch (IllegalArgumentException expected) {}
        record.setParent(null); record.getQuestionType().setId(6L);
        try { service.updateTestStatus(20L, 7); fail(); } catch (IllegalArgumentException expected) {}
        verify(repository, never()).save(any(Question.class));
    }
    @Test public void nonOwnerAndAnonymousCannotChangeStatusWhileAdminCan() {
        User other = new User(); other.setId(8L); login(other, "ROLE_VIEWER");
        try { service.updateTestStatus(20L, 6); fail(); } catch (SecurityException expected) {}
        SecurityContextHolder.clearContext();
        try { service.updateTestStatus(20L, 6); fail(); } catch (SecurityException expected) {}
        verify(repository, never()).save(any(Question.class)); login(other, "ROLE_ADMIN");
        assertEquals(6, service.updateTestStatus(20L, 6).getStatus());
    }
}
