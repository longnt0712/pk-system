package com.globits.richy.rest;

import java.io.IOException;
import java.nio.file.FileAlreadyExistsException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Collections;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.annotation.Secured;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/system/server-restart")
@Secured("ROLE_ADMIN")
public class RestServerRestartController {
    private static final Logger LOG = LoggerFactory.getLogger(RestServerRestartController.class);
    private final String operator;
    private final Path requestFile;

    @Autowired
    public RestServerRestartController(@Value("${pk.system.restart.operator:}") String operator) {
        this(operator, Paths.get("/run/pk-system-web-restart/request"));
    }

    RestServerRestartController(String operator, Path requestFile) {
        this.operator = operator.trim();
        this.requestFile = requestFile;
    }

    @RequestMapping(method = RequestMethod.GET)
    public ResponseEntity<Map<String, Boolean>> availability(Authentication user) {
        return ResponseEntity.ok().header("Cache-Control", "no-store")
                .body(Collections.singletonMap("available", authorizedOperator(user) && queueAvailable()));
    }

    @RequestMapping(method = RequestMethod.POST, consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, String>> requestRestart(Authentication user, @RequestBody Map<String, Object> request) {
        if (!authorizedOperator(user)) {
            return message(HttpStatus.FORBIDDEN, "Tài khoản này không có quyền khởi động lại server.");
        }
        if (!Boolean.TRUE.equals(request.get("confirmed"))) {
            return message(HttpStatus.BAD_REQUEST, "Cần xác nhận trước khi khởi động lại server.");
        }
        if (!queueAvailable()) {
            return message(HttpStatus.SERVICE_UNAVAILABLE, "Chưa bật nút khởi động lại trên máy chủ.");
        }
        try {
            Files.createFile(requestFile);
            LOG.info("Web restart requested by {}", user.getName());
            return message(HttpStatus.ACCEPTED, "Đã gửi yêu cầu khởi động lại dịch vụ.");
        } catch (FileAlreadyExistsException alreadyQueued) {
            return message(HttpStatus.CONFLICT, "Đã có yêu cầu khởi động lại đang chờ.");
        } catch (IOException failure) {
            LOG.warn("Could not enqueue web restart", failure);
            return message(HttpStatus.SERVICE_UNAVAILABLE, "Chưa gửi được yêu cầu khởi động lại.");
        }
    }

    private boolean authorizedOperator(Authentication user) {
        return !operator.isEmpty() && user != null && user.isAuthenticated()
                && operator.equals(user.getName())
                && user.getAuthorities().stream().anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }

    private boolean queueAvailable() {
        Path directory = requestFile.getParent();
        return Files.isDirectory(directory, LinkOption.NOFOLLOW_LINKS) && Files.isWritable(directory);
    }

    private ResponseEntity<Map<String, String>> message(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Collections.singletonMap("message", message));
    }
}
