package com.globits.richy.rest;

import com.globits.richy.dto.SchoolDto;
import com.globits.richy.service.impl.SchoolService;
import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/schools")
public class RestSchoolController {
    @Autowired private SchoolService service;
    @org.springframework.security.access.prepost.PreAuthorize("isAuthenticated()")
    @RequestMapping(method = RequestMethod.GET)
    public List<SchoolDto> list() { return service.list(); }
    @org.springframework.security.access.prepost.PreAuthorize("isAuthenticated()")
    @RequestMapping(value = "/current", method = RequestMethod.GET)
    public SchoolDto current(@RequestParam("domain") String domain) { return service.current(domain); }
    @org.springframework.security.access.prepost.PreAuthorize("isAuthenticated()")
    @RequestMapping(value = "/{id}/classes", method = RequestMethod.GET)
    public List<Map<String,Object>> classes(@PathVariable Long id) { return access.classes(id); }
    @Autowired private com.globits.richy.service.impl.SchoolAccess access;
    @org.springframework.security.access.prepost.PreAuthorize("isAuthenticated()")
    @RequestMapping(value = "/access", method = RequestMethod.GET)
    public Map<String,Object> access() {
        Map<String,Object> result = new LinkedHashMap<>();
        result.put("education", access.schoolsFor(com.globits.richy.service.impl.SchoolAccess.EDUCATION));
        result.put("studentMarks", access.schoolsFor(com.globits.richy.service.impl.SchoolAccess.EDUCATION, com.globits.richy.service.impl.SchoolAccess.STUDENTS));
        return result;
    }
    @Secured("ROLE_ADMIN")
    @RequestMapping(value = "/roles", method = RequestMethod.GET)
    public List<Map<String,Object>> roles() { return service.roles(); }
    @Secured("ROLE_ADMIN")
    @RequestMapping(value = "/{id}/roles", method = RequestMethod.GET)
    public Map<String,List<Long>> assignments(@PathVariable Long id) { return service.assignments(id); }
    public static class RoleRequest {
        public String username;
        public List<Long> roles;
    }
    @Secured("ROLE_ADMIN")
    @RequestMapping(value = "/{id}/roles", method = RequestMethod.PUT)
    public Map<String,List<Long>> setRoles(@PathVariable Long id, @RequestBody RoleRequest request) {
        return service.setRoles(id, request.username, request.roles);
    }
    @Secured("ROLE_ADMIN")
    @RequestMapping(value = "/save", method = RequestMethod.POST)
    public SchoolDto save(@RequestBody SchoolDto request) { return service.save(request); }
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String,String>> invalid(IllegalArgumentException error) { return ResponseEntity.badRequest().body(Collections.singletonMap("message", error.getMessage())); }
    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<Map<String,String>> conflict() { return ResponseEntity.status(HttpStatus.CONFLICT).body(Collections.singletonMap("message", "Cấu hình bị trùng hoặc dữ liệu vừa thay đổi. Vui lòng tải lại.")); }
}
