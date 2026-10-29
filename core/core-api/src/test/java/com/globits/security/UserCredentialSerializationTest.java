package com.globits.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.globits.security.domain.User;
import com.globits.security.dto.UserDto;
import org.junit.Test;
import static org.junit.Assert.*;

public class UserCredentialSerializationTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test public void dtoAcceptsCredentialsButNeverSerializesThem() throws Exception {
        UserDto dto = mapper.readValue("{\"password\":\"new-secret\",\"currentPassword\":\"old-secret\",\"confirmPassword\":\"confirmation-secret\",\"logoutAllDevices\":false}", UserDto.class);
        assertEquals("new-secret", dto.getPassword());
        assertEquals("old-secret", dto.getCurrentPassword());
        assertEquals("confirmation-secret", dto.getConfirmPassword());
        assertEquals(Boolean.FALSE, dto.getLogoutAllDevices());
        assertHidden(mapper.valueToTree(dto));
    }

    @Test public void omittedOrNullLogoutOptionDefaultsToInvalidatingAllDevices() throws Exception {
        assertEquals(Boolean.TRUE, new UserDto().getLogoutAllDevices());
        assertEquals(Boolean.TRUE, mapper.readValue("{}", UserDto.class).getLogoutAllDevices());
        assertEquals(Boolean.TRUE, mapper.readValue("{\"logoutAllDevices\":null}", UserDto.class).getLogoutAllDevices());
        assertEquals(Boolean.TRUE, mapper.readValue("{\"logoutAllDevices\":true}", UserDto.class).getLogoutAllDevices());
    }

    @Test public void userAndLookupDtoHideHashesWithoutChangingInternalPasswordReads() throws Exception {
        User user = mapper.readValue("{\"username\":\"student\",\"password\":\"stored-bcrypt-hash\",\"confirmPassword\":\"input-secret\"}", User.class);
        assertEquals("stored-bcrypt-hash", user.getPassword());
        assertEquals("input-secret", user.getConfirmPassword());
        assertHidden(mapper.valueToTree(user));
        UserDto dto = new UserDto(user);
        assertEquals("stored-bcrypt-hash", dto.getPassword());
        assertHidden(mapper.valueToTree(dto));
    }

    private static void assertHidden(JsonNode json) {
        assertFalse(json.has("password")); assertFalse(json.has("confirmPassword")); assertFalse(json.has("currentPassword"));
        assertFalse(json.has("logoutAllDevices"));
    }
}
