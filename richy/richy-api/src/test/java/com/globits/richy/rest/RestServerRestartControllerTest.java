package com.globits.richy.rest;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collections;
import java.util.Map;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.AuthorityUtils;

import static org.junit.Assert.*;

public class RestServerRestartControllerTest {
    @Rule public TemporaryFolder folder = new TemporaryFolder();

    @Test public void onlyTheConfiguredAdminCanQueueAConfirmedRestart() throws Exception {
        Path marker = folder.getRoot().toPath().resolve("request");
        RestServerRestartController controller = new RestServerRestartController("operator", marker);
        Authentication operator = user("operator", "ROLE_ADMIN");
        Map<String, Object> confirm = Collections.singletonMap("confirmed", true);

        assertTrue(controller.availability(operator).getBody().get("available"));
        assertFalse(controller.availability(user("another-admin", "ROLE_ADMIN")).getBody().get("available"));
        assertEquals(HttpStatus.FORBIDDEN, controller.requestRestart(user("another-admin", "ROLE_ADMIN"), confirm).getStatusCode());
        assertEquals(HttpStatus.FORBIDDEN, controller.requestRestart(user("operator", "ROLE_VIEWER"), confirm).getStatusCode());
        assertEquals(HttpStatus.FORBIDDEN, controller.requestRestart(null, confirm).getStatusCode());
        assertEquals(HttpStatus.BAD_REQUEST, controller.requestRestart(operator, Collections.emptyMap()).getStatusCode());
        assertFalse(Files.exists(marker));
        assertEquals(HttpStatus.ACCEPTED, controller.requestRestart(operator, confirm).getStatusCode());
        assertEquals(0L, Files.size(marker));
        assertEquals(HttpStatus.CONFLICT, controller.requestRestart(operator, confirm).getStatusCode());
    }

    @Test public void aMissingQueueLeavesTheCapabilityDisabled() {
        Path marker = folder.getRoot().toPath().resolve("missing").resolve("request");
        Authentication operator = user("operator", "ROLE_ADMIN");
        RestServerRestartController controller = new RestServerRestartController("operator", marker);
        assertFalse(controller.availability(operator).getBody().get("available"));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE,
                controller.requestRestart(operator, Collections.singletonMap("confirmed", true)).getStatusCode());
        assertFalse(Files.exists(marker.getParent()));
    }

    private Authentication user(String name, String role) {
        return new UsernamePasswordAuthenticationToken(name, "", AuthorityUtils.createAuthorityList(role));
    }
}
