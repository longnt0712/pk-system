package com.globits.richy.users;

import java.util.Arrays;
import java.util.HashSet;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.globits.core.domain.Person;
import com.globits.security.domain.User;
import com.globits.security.dto.UserDto;
import org.junit.Test;

import static org.junit.Assert.*;

public class UserDtoNameTest {
    @Test public void slimDtoKeepsCompoundNamePartsAndExistingDisplayNameOrder() {
        String[][] names = {
            {"Hoàng Nguyễn", "Phương Vy"},
            {"Nguyễn Hoàng", "Đăng Khoa"},
            {"Nguyễn Hoàng", "Đình Đức"}
        };
        for (String[] name : names) {
            User user = userWithName(name[0], name[1]);
            UserDto dto = new UserDto(user, true);
            assertEquals(name[0], dto.getLastName());
            assertEquals(name[1], dto.getFirstName());
            assertEquals(name[0] + " " + name[1], dto.getLastName() + " " + dto.getFirstName());
            assertEquals(name[1] + " " + name[0], dto.getDisplayName());
            assertEquals(name[0], user.getPerson().getLastName());
            assertEquals(name[1], user.getPerson().getFirstName());
        }
    }

    @Test public void slimDtoSerializesNamePartsWithoutPopulatingPasswordOrPerson() throws Exception {
        User user = userWithName("Nguyễn Hoàng", "Đăng Khoa");
        user.setPassword("private-password-must-not-be-returned");
        user.setEmail("private-profile@example.invalid");
        user.getPerson().setAddressString("private-address-must-not-be-returned");
        user.getPerson().setEnrollmentClassId(12);
        user.setEnrollmentClassIds(new HashSet<Long>(Arrays.asList(20L, 30L)));

        UserDto dto = new UserDto(user, true);
        JsonNode json = new ObjectMapper().readTree(new ObjectMapper().writeValueAsString(dto));
        assertEquals(7L, json.path("id").asLong());
        assertEquals("student007", json.path("username").asText());
        assertEquals("Nguyễn Hoàng", json.path("lastName").asText());
        assertEquals("Đăng Khoa", json.path("firstName").asText());
        assertEquals("Đăng Khoa Nguyễn Hoàng", json.path("displayName").asText());
        assertTrue(json.path("password").isMissingNode() || json.path("password").isNull());
        assertTrue(json.path("person").isMissingNode() || json.path("person").isNull());
        assertTrue(json.path("email").isMissingNode() || json.path("email").isNull());
        assertFalse(json.toString().contains("private-"));
        assertEquals(new HashSet<Long>(Arrays.asList(12L, 20L, 30L)), dto.getEnrollmentClassIds());
        assertEquals(0, dto.getRoles().size());
        assertEquals(0, dto.getGroups().size());
    }

    @Test public void slimDtoWithoutPersonRetainsIdentityAndEnrollmentIds() {
        User user = new User();
        user.setId(7L);
        user.setUsername("student007");
        user.setEnrollmentClassIds(new HashSet<Long>(Arrays.asList(20L)));
        UserDto dto = new UserDto(user, true);
        assertEquals(Long.valueOf(7), dto.getId());
        assertEquals("student007", dto.getUsername());
        assertNull(dto.getLastName());
        assertNull(dto.getFirstName());
        assertNull(dto.getDisplayName());
        assertNull(dto.getPerson());
        assertNull(dto.getPassword());
        assertEquals(new HashSet<Long>(Arrays.asList(20L)), dto.getEnrollmentClassIds());
    }

    @Test public void slimDtoRetainsPartialNamesWithoutInventingOrReorderingTokens() {
        UserDto dto = new UserDto(userWithName("Hoàng Nguyễn", null), true);
        assertEquals("Hoàng Nguyễn", dto.getLastName());
        assertNull(dto.getFirstName());
        assertEquals("null Hoàng Nguyễn", dto.getDisplayName());

        UserDto empty = new UserDto(null, true);
        assertNull(empty.getId());
        assertNull(empty.getFirstName());
        assertNull(empty.getLastName());
        assertTrue(empty.getEnrollmentClassIds().isEmpty());
    }

    private static User userWithName(String lastName, String firstName) {
        Person person = new Person();
        person.setLastName(lastName);
        person.setFirstName(firstName);
        User user = new User();
        user.setId(7L);
        user.setUsername("student007");
        user.setPerson(person);
        return user;
    }
}
