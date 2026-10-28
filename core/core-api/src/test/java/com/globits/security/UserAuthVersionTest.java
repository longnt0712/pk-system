package com.globits.security;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.globits.core.domain.Person;
import com.globits.security.domain.Role;
import com.globits.security.domain.User;
import org.junit.Test;
import static org.junit.Assert.*;

public class UserAuthVersionTest {
    @Test public void existingNullVersionSurvivesNoOpAssignmentsAndOrdinaryProfileUpdates() {
        User user = new User(); user.setUsername("student"); user.setPassword("hash");
        user.replaceRoles(Arrays.asList(role("ROLE_STUDENT"))); user.setAuthVersion(null);
        user.setUsername("student"); user.setPassword("hash"); user.setActive(true);
        user.setAccountNonExpired(true); user.setAccountNonLocked(true); user.setCredentialsNonExpired(true);
        user.replaceRoles(Arrays.asList(role("ROLE_STUDENT")));
        user.setEmail("new-email"); user.setPerson(new Person()); user.setSelectedLearningPet("MAM_HOC");
        user.setVocabularyLevel("B1"); user.addDailyVocabularyWords(10);
        user.setEnrollmentClassIds(new HashSet<Long>(Arrays.asList(1L, 2L)));
        assertNull(user.getAuthVersion());
    }

    @Test public void disablingAndRestoringAccountCannotRestoreOldGeneration() {
        User user = new User(); user.setAuthVersion("original");
        user.setActive(false); String disabled = user.getAuthVersion();
        assertNotEquals("original", disabled);
        user.setActive(true); assertNotEquals("original", user.getAuthVersion()); assertNotEquals(disabled, user.getAuthVersion());
        for (int kind = 0; kind < 3; kind++) {
            user.setAuthVersion("original");
            if (kind == 0) { user.setAccountNonLocked(false); user.setAccountNonLocked(true); }
            if (kind == 1) { user.setAccountNonExpired(false); user.setAccountNonExpired(true); }
            if (kind == 2) { user.setCredentialsNonExpired(false); user.setCredentialsNonExpired(true); }
            assertNotEquals("original", user.getAuthVersion());
        }
    }

    @Test public void removingAndRestoringRolesRotatesGenerationAndPreservesManagedSet() {
        User user = new User(); user.replaceRoles(Arrays.asList(role("ROLE_STUDENT")));
        user.setAuthVersion("original"); Set<Role> managedSet = user.getRoles();
        user.replaceRoles(Collections.<Role>emptySet()); String removed = user.getAuthVersion();
        user.replaceRoles(Arrays.asList(role("ROLE_STUDENT")));
        assertNotEquals("original", removed); assertNotEquals("original", user.getAuthVersion());
        assertNotEquals(removed, user.getAuthVersion()); assertSame(managedSet, user.getRoles());
        String current = user.getAuthVersion(); user.setRoles(new HashSet<Role>(Arrays.asList(role("ROLE_STUDENT"))));
        assertEquals(current, user.getAuthVersion());
    }

    @Test public void usernameAndPasswordChangesRotateButNoOpAssignmentsDoNot() {
        User user = new User(); user.setUsername("student"); user.setPassword("hash"); user.setAuthVersion("original");
        user.setUsername("renamed"); assertNotEquals("original", user.getAuthVersion());
        String renamed = user.getAuthVersion(); user.setUsername("renamed"); assertEquals(renamed, user.getAuthVersion());
        user.setPassword("new-hash"); assertNotEquals(renamed, user.getAuthVersion());
        String changed = user.getAuthVersion(); user.setPassword("new-hash"); assertEquals(changed, user.getAuthVersion());
    }

    @Test public void authenticationGenerationIsNeitherJsonOutputNorRequestControlled() throws Exception {
        ObjectMapper mapper = new ObjectMapper(); User user = new User(); user.setAuthVersion("internal-generation");
        assertFalse(mapper.valueToTree(user).has("authVersion"));
        User input = mapper.readValue("{\"authVersion\":\"attacker-selected\"}", User.class);
        assertNull(input.getAuthVersion());
        User copy = new User(user, false); assertEquals(user.getAuthVersion(), copy.getAuthVersion());
    }

    private static Role role(String name) { Role role = new Role(); role.setName(name); return role; }
}
