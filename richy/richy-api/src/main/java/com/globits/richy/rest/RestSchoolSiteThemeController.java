package com.globits.richy.rest;

import com.globits.richy.dto.SchoolSiteThemeDto;
import com.globits.richy.service.impl.SchoolSiteThemeService;
import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.*;

@RestController
public class RestSchoolSiteThemeController {
    @Autowired private SchoolSiteThemeService service;
    public static class Selection { public String theme; public List<Long> schoolIds; }
    private <T> ResponseEntity<T> response(T value) {
        HttpHeaders headers = new HttpHeaders();
        headers.setCacheControl("no-store, no-cache, must-revalidate"); headers.setPragma("no-cache");
        headers.setExpires(0); headers.set("X-Site-Theme-Options", "NORMAL,HALLOWEEN,CHRISTMAS");
        return new ResponseEntity<>(value, headers, HttpStatus.OK);
    }
    @RequestMapping(value="/public/site-theme", method=RequestMethod.GET)
    public ResponseEntity<SchoolSiteThemeDto> current(@RequestParam("domain") String domain) { return response(service.forDomain(domain)); }
    @Secured("ROLE_ADMIN")
    @RequestMapping(value="/api/site-theme/schools", method=RequestMethod.GET)
    public ResponseEntity<List<SchoolSiteThemeDto>> schools() { return response(service.list()); }
    @Secured("ROLE_ADMIN")
    @RequestMapping(value="/api/site-theme/schools", method=RequestMethod.PUT)
    public ResponseEntity<List<SchoolSiteThemeDto>> save(@RequestBody Selection selection) {
        if (selection == null) { throw new IllegalArgumentException("Chọn trường và giao diện."); }
        return response(service.save(selection.theme, selection.schoolIds));
    }
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String,String>> invalid(IllegalArgumentException error) {
        return ResponseEntity.badRequest().body(Collections.singletonMap("message",error.getMessage()));
    }
    @ExceptionHandler(org.springframework.dao.OptimisticLockingFailureException.class)
    public ResponseEntity<Map<String,String>> conflict() {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Collections.singletonMap("message","Cấu hình vừa thay đổi. Vui lòng tải lại."));
    }
}
