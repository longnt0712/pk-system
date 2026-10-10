package com.globits.richy.rest;

import com.globits.richy.dto.TestFolderDto;
import com.globits.richy.dto.TestFolderMoveDto;
import com.globits.richy.service.impl.TestFolderServiceImpl;
import java.util.Collections;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/test_folder")
public class RestTestFolderController {
    @Autowired private TestFolderServiceImpl service;
    @Secured({"ROLE_ADMIN", "ROLE_USER", "ROLE_VIEWER"})
    @RequestMapping(method = RequestMethod.GET)
    public List<TestFolderDto> list(@RequestParam(value = "allTeachers", defaultValue = "false") boolean allTeachers) { return service.list(allTeachers); }
    @Secured({"ROLE_ADMIN", "ROLE_USER"})
    @RequestMapping(value = "/save", method = RequestMethod.POST)
    public ResponseEntity<?> save(@RequestBody TestFolderDto dto) {
        try { return ResponseEntity.ok(service.save(dto)); }
        catch (IllegalArgumentException invalid) { return ResponseEntity.badRequest().body(Collections.singletonMap("message", invalid.getMessage())); }
    }
    @Secured({"ROLE_ADMIN", "ROLE_USER"})
    @RequestMapping(value = "/move_test", method = RequestMethod.POST)
    public ResponseEntity<?> moveTest(@RequestBody TestFolderMoveDto dto) {
        try { return ResponseEntity.ok(service.moveTest(dto == null ? null : dto.getTestId(), dto == null ? null : dto.getFolderId())); }
        catch (IllegalArgumentException invalid) { return ResponseEntity.badRequest().body(Collections.singletonMap("message", invalid.getMessage())); }
    }
}
