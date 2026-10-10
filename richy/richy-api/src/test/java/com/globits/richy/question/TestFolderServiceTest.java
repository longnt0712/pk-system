package com.globits.richy.question;

import com.globits.richy.domain.TestFolder;
import com.globits.richy.dto.TestFolderDto;
import com.globits.richy.repository.TestFolderRepository;
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
    }
    private void login(User user) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, "unused",
                Collections.singletonList(new SimpleGrantedAuthority("ROLE_USER"))));
    }
    @After public void logout() { SecurityContextHolder.clearContext(); }
    private TestFolderDto save(String name, Long parent) {
        TestFolderDto dto = new TestFolderDto(); dto.setName(name); dto.setParentId(parent); return service.save(dto);
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
}
