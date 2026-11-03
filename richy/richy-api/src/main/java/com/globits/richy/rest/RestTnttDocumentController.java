package com.globits.richy.rest;

import com.globits.richy.dto.TnttDocumentRequest;
import com.globits.richy.service.impl.TnttDocumentService;
import java.util.*;
import javax.persistence.OptimisticLockException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/tntt-documents")
@Secured({
    "ROLE_ADMIN",
    "ROLE_EDUCATION_MANAGEMENT",
    "ROLE_STUDENT_MANAGEMENT",
    "ROLE_USER",
    "ROLE_VIEWER",
    "ROLE_STUDENT",
    "ROLE_STAFF",
    "ROLE_STAFF_MANAGEMENT",
    "ROLE_PLAY",
    "ROLE_GIFT"
})
public class RestTnttDocumentController {
    @Autowired private TnttDocumentService service;

    @RequestMapping(value = "/capabilities", method = RequestMethod.GET)
    public Map<String, Object> capabilities() {
        return service.capabilities();
    }

    @RequestMapping(value = "/recipients", method = RequestMethod.GET)
    public Object recipients() {
        return service.recipients();
    }

    @RequestMapping(value = "/entries", method = RequestMethod.GET)
    public Object entries(
            @RequestParam(value = "trash", defaultValue = "false") boolean trash,
            @RequestParam(value = "q", required = false) String q) {
        return service.list(trash, q);
    }

    @RequestMapping(value = "/entries", method = RequestMethod.POST)
    public Object create(@RequestBody TnttDocumentRequest r) {
        return service.create(r);
    }

    @RequestMapping(value = "/entries/{id}", method = RequestMethod.GET)
    public Object read(
            @PathVariable Long id,
            @RequestParam(value = "revision", required = false) Long revision) {
        return service.read(id, revision);
    }

    @RequestMapping(value = "/entries/{id}", method = RequestMethod.PUT)
    public Object save(@PathVariable Long id, @RequestBody TnttDocumentRequest r) {
        return service.save(id, r);
    }

    @RequestMapping(value = "/entries/{id}/metadata", method = RequestMethod.PUT)
    public Object metadata(@PathVariable Long id, @RequestBody TnttDocumentRequest r) {
        return service.update(id, r);
    }

    @RequestMapping(value = "/entries/{id}/publish", method = RequestMethod.POST)
    public Object publish(@PathVariable Long id, @RequestBody TnttDocumentRequest r) {
        return service.publish(id, r);
    }

    @RequestMapping(value = "/entries/{id}/sharing", method = RequestMethod.PUT)
    public Object sharing(@PathVariable Long id, @RequestBody TnttDocumentRequest r) {
        return service.sharing(id, r);
    }

    @RequestMapping(value = "/entries/{id}/history", method = RequestMethod.GET)
    public Object history(@PathVariable Long id) {
        return service.history(id);
    }

    @RequestMapping(value = "/entries/{id}/history/{version}", method = RequestMethod.GET)
    public Object version(@PathVariable Long id, @PathVariable Long version) {
        return service.version(id, version);
    }

    @RequestMapping(value = "/entries/{id}/restore", method = RequestMethod.POST)
    public Object restore(@PathVariable Long id, @RequestBody TnttDocumentRequest r) {
        return service.restore(id, r);
    }

    @RequestMapping(value = "/entries/{id}/delivery", method = RequestMethod.GET)
    public Object delivery(@PathVariable Long id) {
        return service.delivery(id);
    }

    @RequestMapping(value = "/entries/{id}/email-test", method = RequestMethod.POST)
    public Object test(@PathVariable Long id) {
        service.testEmail(id);
        return Collections.singletonMap("sent", true);
    }

    @RequestMapping(value = "/notifications", method = RequestMethod.GET)
    public Object notifications(
            @RequestParam(value = "unread", defaultValue = "false") boolean unread) {
        return service.notifications(unread);
    }

    @RequestMapping(value = "/notifications/{id}", method = RequestMethod.GET)
    public Object notification(@PathVariable Long id) {
        return service.notificationDocument(id);
    }

    @RequestMapping(value = "/notifications/{id}/read", method = RequestMethod.POST)
    public Object readNotice(@PathVariable Long id) {
        service.markRead(id);
        return Collections.singletonMap("read", true);
    }

    @ExceptionHandler({IllegalArgumentException.class})
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, Object> invalid(RuntimeException e) {
        return Collections.singletonMap("message", e.getMessage());
    }

    @ExceptionHandler({AccessDeniedException.class})
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public Map<String, Object> denied(RuntimeException e) {
        return Collections.singletonMap("message", e.getMessage());
    }

    @ExceptionHandler({
        TnttDocumentService.Conflict.class,
        OptimisticLockException.class,
        ObjectOptimisticLockingFailureException.class
    })
    @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String, Object> conflict(RuntimeException e) {
        return Collections.singletonMap(
                "message", "Tài liệu đã thay đổi. Bản đang viết được giữ để đối chiếu.");
    }

    @ModelAttribute
    public void noCache(
            org.springframework.web.context.request.WebRequest request,
            javax.servlet.http.HttpServletResponse response) {
        response.setHeader("Cache-Control", "private, no-store");
    }
}
