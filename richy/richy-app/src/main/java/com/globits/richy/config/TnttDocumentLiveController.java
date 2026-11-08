package com.globits.richy.config;

import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/tntt-documents/entries/{id}/live-ticket")
@Secured({"ROLE_ADMIN", "ROLE_EDUCATION_MANAGEMENT"})
public class TnttDocumentLiveController {
    @Autowired private TnttDocumentLiveGateway gateway;

    @RequestMapping(method = RequestMethod.POST)
    public Map<String, Object> ticket(@PathVariable Long id, @RequestHeader(value = "Authorization", required = false) String authorization, @RequestBody Map<String, String> request) {
        if (authorization == null || !authorization.regionMatches(true, 0, "Bearer ", 0, 7)) throw new AccessDeniedException("Cần đăng nhập.");
        if (request == null) throw new IllegalArgumentException("Thiếu phiên soạn tài liệu.");
        return gateway.issue(id, request.get("clientId"), authorization.substring(7).trim());
    }
    @ExceptionHandler(AccessDeniedException.class) @ResponseStatus(HttpStatus.FORBIDDEN)
    public Map<String, String> denied() { return java.util.Collections.singletonMap("message", "Không có quyền cùng soạn tài liệu."); }
    @ExceptionHandler(org.springframework.security.oauth2.common.exceptions.OAuth2Exception.class) @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public Map<String, String> expired() { return java.util.Collections.singletonMap("message", "Cần đăng nhập lại."); }
    @ExceptionHandler(IllegalArgumentException.class) @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> invalid(IllegalArgumentException error) { return java.util.Collections.singletonMap("message", error.getMessage()); }
}
