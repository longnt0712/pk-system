package com.globits.richy.rest;

import com.globits.richy.dto.QuestionDto;
import com.globits.richy.service.impl.DailyListeningServiceImpl;
import java.util.Collections;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/daily_listening")
public class RestDailyListeningController {
    @Autowired private DailyListeningServiceImpl service;

    @Secured({"ROLE_ADMIN", "ROLE_USER", "ROLE_VIEWER"})
    @RequestMapping(value = "/get_page/{pageIndex}/{pageSize}", method = RequestMethod.POST)
    public Page<QuestionDto> list(@RequestBody QuestionDto search, @PathVariable int pageIndex, @PathVariable int pageSize) {
        return service.list(search, pageIndex, pageSize, false);
    }
    @Secured("ROLE_ADMIN")
    @RequestMapping(value = "/legacy/{pageIndex}/{pageSize}", method = RequestMethod.POST)
    public Page<QuestionDto> legacy(@RequestBody QuestionDto search, @PathVariable int pageIndex, @PathVariable int pageSize) {
        return service.list(search, pageIndex, pageSize, true);
    }
    @Secured("ROLE_ADMIN")
    @RequestMapping(value = "/save", method = RequestMethod.POST)
    public ResponseEntity<?> save(@RequestBody QuestionDto dto) {
        try { return ResponseEntity.ok(service.save(dto)); }
        catch (AccessDeniedException denied) { return error(HttpStatus.FORBIDDEN, denied); }
        catch (IllegalArgumentException invalid) { return error(HttpStatus.BAD_REQUEST, invalid); }
    }
    @Secured("ROLE_ADMIN")
    @RequestMapping(value = "/migrate/{id}", method = RequestMethod.POST)
    public ResponseEntity<?> migrate(@PathVariable Long id) {
        try { return ResponseEntity.ok(service.migrate(id)); }
        catch (AccessDeniedException denied) { return error(HttpStatus.FORBIDDEN, denied); }
        catch (IllegalArgumentException invalid) { return error(HttpStatus.BAD_REQUEST, invalid); }
    }
    private ResponseEntity<?> error(HttpStatus status, RuntimeException failure) {
        return ResponseEntity.status(status).body(Collections.singletonMap("message", failure.getMessage()));
    }
}
