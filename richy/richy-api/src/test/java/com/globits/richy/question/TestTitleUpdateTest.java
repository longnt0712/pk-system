package com.globits.richy.question;

import com.globits.richy.domain.Question;
import com.globits.richy.domain.QuestionType;
import com.globits.richy.domain.TestFolder;
import com.globits.richy.dto.QuestionForTestsDto;
import com.globits.richy.repository.QuestionRepository;
import com.globits.richy.service.impl.QuestionServiceImpl;
import com.globits.security.domain.User;
import java.util.Collections;
import org.junit.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.mockito.Matchers.*;

public class TestTitleUpdateTest {
    private QuestionServiceImpl service;
    private QuestionRepository repository;
    private Question test;
    private User owner;
    @Before public void setup() {
        owner = new User(); owner.setId(7L); owner.setUsername("teacher");
        login(owner, "ROLE_USER");
        test = new Question(); test.setId(20L); test.setTitle("Original title"); test.setUser(owner);
        QuestionType type = new QuestionType(); type.setId(11L); test.setQuestionType(type);
        test.setQuestion("Existing passage"); test.setPronounce("audio.mp3"); test.setStatus(7);
        test.setTestFolder(new TestFolder()); test.setSubQuestions(Collections.singleton(new Question()));
        repository = mock(QuestionRepository.class);
        when(repository.findOne(20L)).thenReturn(test);
        when(repository.save(any(Question.class))).thenAnswer(call -> call.getArguments()[0]);
        service = new QuestionServiceImpl(); ReflectionTestUtils.setField(service, "questionRepository", repository);
    }
    private void login(User user, String role) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, "unused",
                Collections.singletonList(new SimpleGrantedAuthority(role))));
    }
    @After public void logout() { SecurityContextHolder.clearContext(); }
    @Test public void onlyTitleAndAuditFieldsChangeForAllFourTestModes() {
        Object folder = test.getTestFolder(), children = test.getSubQuestions();
        for (String mode : new String[]{"READING", "LISTENING", "WRITING", "COMPREHENSIVE"}) {
            test.setTestFormat(mode);
            QuestionForTestsDto saved = service.updateTestTitle(20L, "  New " + mode + " title  ");
            assertEquals("New " + mode + " title", saved.getTitle()); assertEquals(Long.valueOf(20L), saved.getId());
            assertEquals("Existing passage", test.getQuestion()); assertEquals("audio.mp3", test.getPronounce());
            assertEquals(7, test.getStatus()); assertSame(owner, test.getUser()); assertEquals(mode, test.getTestFormat());
            assertSame(folder, test.getTestFolder()); assertSame(children, test.getSubQuestions());
            assertEquals("teacher", test.getModifiedBy()); assertNotNull(test.getModifyDate());
        }
    }
    @Test public void adminCanRenameLegacyTestsWithOtherOrMissingOwners() {
        User admin = new User(); admin.setId(8L); admin.setUsername("admin"); login(admin, "ROLE_ADMIN");
        service.updateTestTitle(20L, "Old manual test"); test.setUser(null);
        assertEquals("Legacy title", service.updateTestTitle(20L, "Legacy title").getTitle());
    }
    @Test public void blankOrOverlongTitlesAreRejectedWithoutSaving() {
        for (String title : new String[]{null, "", "  ", String.join("", Collections.nCopies(256, "x"))}) {
            try { service.updateTestTitle(20L, title); fail("Expected invalid title"); } catch (IllegalArgumentException expected) {}
        }
        assertEquals("Original title", test.getTitle()); verify(repository, never()).save(any(Question.class));
    }
    @Test public void missingTestAndChildQuestionsCannotBeRenamed() {
        try { service.updateTestTitle(99L, "New title"); fail(); } catch (IllegalArgumentException expected) {}
        test.setParent(new Question());
        try { service.updateTestTitle(20L, "New title"); fail(); } catch (IllegalArgumentException expected) {}
        test.setParent(null); test.getQuestionType().setId(19L);
        try { service.updateTestTitle(20L, "New title"); fail(); } catch (IllegalArgumentException expected) {}
        verify(repository, never()).save(any(Question.class));
    }
    @Test public void nonOwnerAndUnauthenticatedRequestsAreRejectedWithoutSaving() {
        User other = new User(); other.setId(8L); login(other, "ROLE_USER");
        try { service.updateTestTitle(20L, "New title"); fail(); } catch (SecurityException expected) {}
        SecurityContextHolder.clearContext();
        try { service.updateTestTitle(20L, "New title"); fail(); } catch (SecurityException expected) {}
        assertEquals("Original title", test.getTitle()); verify(repository, never()).save(any(Question.class));
    }
}
