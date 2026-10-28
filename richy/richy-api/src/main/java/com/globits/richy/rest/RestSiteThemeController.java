package com.globits.richy.rest;

import com.globits.richy.dto.SiteThemeDto;
import com.globits.richy.service.SiteThemeService;
import java.util.Collections;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RestSiteThemeController {
    @Autowired
    private SiteThemeService service;

    @RequestMapping(value = "/public/site-theme/ieltsroom", method = RequestMethod.GET)
    public ResponseEntity<SiteThemeDto> getIeltsRoomTheme() {
        return noCache(service.getIeltsRoomTheme());
    }

    @Secured("ROLE_ADMIN")
    @RequestMapping(value = "/api/site-theme/ieltsroom", method = RequestMethod.PUT)
    public ResponseEntity<SiteThemeDto> saveIeltsRoomTheme(@RequestBody SiteThemeDto config) {
        return noCache(service.saveIeltsRoomTheme(config));
    }

    private ResponseEntity<SiteThemeDto> noCache(SiteThemeDto config) {
        HttpHeaders headers = new HttpHeaders();
        headers.setCacheControl("no-store, no-cache, must-revalidate");
        headers.setPragma("no-cache");
        headers.setExpires(0);
        return new ResponseEntity<SiteThemeDto>(config, headers, HttpStatus.OK);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> invalidTheme(IllegalArgumentException error) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Collections.singletonMap("message", error.getMessage()));
    }

    @ExceptionHandler({DataIntegrityViolationException.class, OptimisticLockingFailureException.class})
    public ResponseEntity<Map<String, String>> concurrentThemeChange(RuntimeException error) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Collections.singletonMap("message",
                "Giao diện vừa được thay đổi. Vui lòng tải lại và lưu lại."));
    }
}
