package com.globits.richy.question;

import com.globits.richy.domain.TestFolder;
import com.globits.richy.domain.Question;
import com.globits.richy.domain.QuestionType;
import com.globits.richy.dto.QuestionForTestsDto;
import com.globits.richy.dto.TestFolderDto;
import com.globits.richy.repository.TestFolderRepository;
import com.globits.richy.repository.QuestionRepository;
import com.globits.richy.service.impl.TestFolderServiceImpl;
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

public class TestFolderServiceTest {
    private TestFolderServiceImpl service;
    private Map<Long, TestFolder> folders;
    private User teacher, other;
    private Question test;
    private QuestionRepository questions;
    @Before public void setup() {
        folders = new LinkedHashMap<>();
        teacher = new User(); teacher.setId(7L); teacher.setUsername("teacher");
        other = new User(); other.setId(8L); other.setUsername("other");
        login(teacher);
        TestFolderRepository repository = mock(TestFolderRepository.class);
        when(repository.findAll()).thenAnswer(call -> new ArrayList<>(folders.values()));
        when(repository.findOne(anyLong())).thenAnswer(call -> folders.get(call.getArguments()[0]));
        when(repository.save(any(TestFolder.class))).thenAnswer(call -> {
            TestFolder folder = (TestFolder) call.getArguments()[0];
            if (folder.getId() == null) { folder.setId(100L + folders.size()); }
            folders.put(folder.getId(), folder); return folder;
        });
        service = new TestFolderServiceImpl(); ReflectionTestUtils.setField(service, "repository", repository);
        test = new Question(); test.setId(20L); test.setTitle("Listening lesson"); test.setUser(teacher); test.setStatus(7);
        test.setQuestion("Transcript stays unchanged"); test.setTestFormat("COMPREHENSIVE");
        QuestionType kind = new QuestionType(); kind.setId(11L); test.setQuestionType(kind);
        questions = mock(QuestionRepository.class); when(questions.findOne(20L)).thenReturn(test);
        when(questions.save(any(Question.class))).thenAnswer(call -> call.getArguments()[0]);
        ReflectionTestUtils.setField(service, "questionRepository", questions);
    }
    private void login(User user) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, "unused",
                Collections.singletonList(new SimpleGrantedAuthority("ROLE_USER"))));
    }
    @After public void logout() { SecurityContextHolder.clearContext(); }
    private TestFolderDto save(String name, Long parent) {
        TestFolderDto dto = new TestFolderDto(); dto.setName(name); dto.setParentId(parent); return service.save(dto);
    }
    private TestFolderDto saveMode(String mode, String name, Long parent) {
        TestFolderDto dto = new TestFolderDto(); dto.setTestMode(mode); dto.setName(name); dto.setParentId(parent); return service.save(dto);
    }
    @Test public void eachTestModeHasItsOwnTreeAndSiblingNames() {
        for (String mode : Arrays.asList("COMPREHENSIVE", "READING", "LISTENING", "WRITING", "DAILY_LISTENING")) {
            TestFolderDto root = saveMode(mode, "Practice", null), child = saveMode(mode, "Week 1", root.getId());
            assertEquals(mode, child.getTestMode()); assertEquals(2, service.list(false, mode).size());
            assertEquals(Arrays.asList(root.getId(), child.getId()), service.descendantIds(root.getId(), true));
        }
        assertEquals(2, service.list(false).size());
    }
    @Test public void folderParentAndRenameCannotChangeTestMode() {
        TestFolderDto root = saveMode("READING", "Practice", null);
        try { saveMode("LISTENING", "Week 1", root.getId()); fail("Expected mode mismatch"); } catch (IllegalArgumentException expected) {}
        root.setTestMode("WRITING");
        try { service.save(root); fail("Expected mode mismatch"); } catch (IllegalArgumentException expected) {}
        root.setTestMode(null); root.setName("Renamed"); assertEquals("READING", service.save(root).getTestMode());
    }
    @Test public void ieltsMovesPersistOnlyToMatchingFoldersAndSupportUnfiledRoot() {
        TestFolderDto comprehensive = save("Comprehensive", null);
        for (String mode : Arrays.asList("READING", "LISTENING", "WRITING")) {
            TestFolderDto root = saveMode(mode, "Practice", null), child = saveMode(mode, "Week 1", root.getId());
            test.setTestFormat("WRITING".equals(mode) ? "WRITING" : null);
            test.setPronounce("LISTENING".equals(mode) ? " audio.mp3 " : " ");
            assertEquals(child.getId(), service.moveTest(20L, child.getId()).getTestFolder().getId());
            try { service.moveTest(20L, comprehensive.getId()); fail("Expected mode mismatch"); } catch (IllegalArgumentException expected) {}
            assertEquals(child.getId(), test.getTestFolder().getId());
            assertEquals("Transcript stays unchanged", test.getQuestion());
            service.moveTest(20L, null); assertNull(test.getTestFolder());
        }
    }
    @Test public void listeningDraftCanMoveBeforeAudioIsAdded() {
        TestFolderDto folder = saveMode("LISTENING", "Practice", null);
        test.setTestFormat("LISTENING"); test.setPronounce(null);
        assertEquals(folder.getId(), service.moveTest(20L, folder.getId()).getTestFolder().getId());
        assertNull(test.getPronounce());
    }
    @Test public void sharedDailyListeningCanMoveToOwnNestedFoldersWithoutChangingTranscriptOrOwner() {
        TestFolderDto root = saveMode("DAILY_LISTENING", "Daily", null), child = saveMode("DAILY_LISTENING", "Week 1", root.getId());
        test.setTestFormat("DAILY_LISTENING"); test.setUser(other); test.setMotherTongue("Original listening transcript");
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(teacher, "", Collections.singletonList(new SimpleGrantedAuthority("ROLE_ADMIN"))));
        assertEquals(child.getId(), service.moveTest(20L, child.getId()).getTestFolder().getId());
        assertSame(other, test.getUser()); assertEquals("Original listening transcript", test.getMotherTongue());
        TestFolderDto reading = saveMode("READING", "Reading", null);
        try { service.moveTest(20L, reading.getId()); fail(); } catch (IllegalArgumentException expected) {}
        assertEquals(child.getId(), test.getTestFolder().getId()); service.moveTest(20L, null); assertNull(test.getTestFolder());
    }
    @Test public void ownTreeSupportsNestedFoldersAndSameNamesForOtherTeachers() {
        TestFolderDto root = save("  Listening  ", null), child = save("Week 1", root.getId());
        assertEquals("Listening", root.getName()); assertEquals(teacher.getId(), child.getOwnerId());
        assertEquals(Arrays.asList(root.getId(), child.getId()), service.descendantIds(root.getId(), true));
        assertEquals(Collections.singletonList(root.getId()), service.descendantIds(root.getId(), false));
        login(other); save("Listening", null);
        assertEquals(1, service.list(false).size()); assertEquals(3, service.list(true).size());
        assertFalse(service.list(true).get(0).isCanManage()); assertTrue(service.list(false).get(0).isCanManage());
    }
    @Test(expected = IllegalArgumentException.class) public void duplicateSiblingNamesAreRejected() {
        save("Listening", null); save("listening", null);
    }
    @Test(expected = IllegalArgumentException.class) public void parentMustBelongToSameTeacher() {
        TestFolderDto root = save("Listening", null); login(other); save("Week 1", root.getId());
    }
    @Test(expected = AccessDeniedException.class) public void anotherTeacherCannotRenameFolder() {
        TestFolderDto root = save("Listening", null); login(other); root.setName("Changed"); service.save(root);
    }
    @Test(expected = IllegalArgumentException.class) public void folderCannotBeMovedInsideItsDescendant() {
        TestFolderDto root = save("Listening", null), child = save("Week 1", root.getId());
        root.setParentId(child.getId()); service.save(root);
    }
    @Test(expected = IllegalArgumentException.class) public void deletedParentIsRejected() { save("Week 1", 999L); }
    @Test public void renameRetainsOwnerAndFolderId() {
        TestFolderDto folder = save("Listening", null); folder.setName("Practice");
        TestFolderDto renamed = service.save(folder);
        assertEquals(folder.getId(), renamed.getId()); assertEquals(teacher.getId(), renamed.getOwnerId());
        assertEquals("Practice", renamed.getName()); assertEquals(1, folders.size());
    }
    @Test public void movesToChildAndRootWhilePreservingTestContentAndStatus() {
        TestFolderDto root = save("Practice", null), child = save("Week 1", root.getId());
        Question question = new Question(); question.setQuestion("Existing question");
        test.setSubQuestions(Collections.singleton(question));
        QuestionForTestsDto moved = service.moveTest(20L, child.getId());
        assertEquals(child.getId(), moved.getTestFolder().getId()); assertEquals("Week 1", moved.getTestFolder().getName());
        assertEquals("Transcript stays unchanged", test.getQuestion()); assertEquals("Listening lesson", test.getTitle());
        assertEquals(7, test.getStatus()); assertSame(teacher, test.getUser()); assertSame(question, test.getSubQuestions().iterator().next());
        assertNotNull(test.getModifyDate()); assertEquals("teacher", test.getModifiedBy());
        service.moveTest(20L, null); assertNull(test.getTestFolder()); verify(questions, times(2)).save(test);
    }
    @Test public void droppingIntoCurrentFolderIsANoOp() {
        TestFolderDto folder = save("Practice", null); test.setTestFolder(folders.get(folder.getId()));
        assertEquals(folder.getId(), service.moveTest(20L, folder.getId()).getTestFolder().getId());
        verify(questions, never()).save(any(Question.class)); assertNull(test.getModifyDate());
    }
    @Test public void cannotMoveAnotherTeachersTestOrMoveAcrossTeachersTrees() {
        TestFolderDto own = save("Practice", null); login(other); TestFolderDto theirs = save("Other", null);
        try { service.moveTest(20L, theirs.getId()); fail("Expected access denied"); } catch (AccessDeniedException expected) {}
        login(teacher);
        try { service.moveTest(20L, theirs.getId()); fail("Expected access denied"); } catch (AccessDeniedException expected) {}
        assertNull(test.getTestFolder()); verify(questions, never()).save(any(Question.class));
        assertNotNull(service.moveTest(20L, own.getId()).getTestFolder());
    }
    @Test public void adminCanOrganizeLegacyTestsWithAnotherOrMissingOwnerInAllModes() {
        login(other);
        Map<String, TestFolderDto> destinations = new LinkedHashMap<>();
        for (String mode : Arrays.asList("READING", "LISTENING", "WRITING", "COMPREHENSIVE")) {
            destinations.put(mode, saveMode(mode, "Practice", null));
        }
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(other, "unused",
                Collections.singletonList(new SimpleGrantedAuthority("ROLE_ADMIN"))));
        Question question = new Question(); question.setQuestion("Original answers stay here");
        test.setSubQuestions(Collections.singleton(question));
        for (String mode : destinations.keySet()) {
            test.setTestFormat("READING".equals(mode) || "LISTENING".equals(mode) ? null : mode);
            test.setPronounce("LISTENING".equals(mode) ? "audio.mp3" : null);
            for (User legacyOwner : Arrays.asList(teacher, null)) {
                test.setUser(legacyOwner);
                assertEquals(destinations.get(mode).getId(), service.moveTest(20L, destinations.get(mode).getId()).getTestFolder().getId());
                assertSame(legacyOwner, test.getUser()); assertEquals(7, test.getStatus());
                assertEquals("Transcript stays unchanged", test.getQuestion());
                assertSame(question, test.getSubQuestions().iterator().next());
                service.moveTest(20L, null); assertNull(test.getTestFolder());
            }
        }
    }
    @Test public void invalidDestinationAndNonComprehensiveTestsNeverSaveChanges() {
        TestFolderDto folder = save("Practice", null);
        try { service.moveTest(20L, 999L); fail("Expected invalid destination"); } catch (IllegalArgumentException expected) {}
        test.setTestFormat(null);
        try { service.moveTest(20L, folder.getId()); fail("Expected invalid test type"); } catch (IllegalArgumentException expected) {}
        verify(questions, never()).save(any(Question.class)); assertNull(test.getTestFolder());
    }
}
