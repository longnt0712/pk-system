package com.globits.richy.rest;
import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import com.globits.richy.dto.CampaignFlowerDto;
import com.globits.richy.service.impl.CampaignFlowerService;

@RestController
@RequestMapping("/api/campaign-flower")
@Secured({"ROLE_ADMIN", "ROLE_EDUCATION_MANAGERMENT", "ROLE_STUDENT_MANAGERMENT"})
public class RestCampaignFlowerAccessController {
    @Autowired private CampaignFlowerService service;
    @RequestMapping(value = "/access", method = RequestMethod.POST)
    public ResponseEntity<CampaignFlowerDto.Access> issue(@RequestBody CampaignFlowerDto.AccessRequest request) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(service.issue(request.studentCode));
    }
    public static class TokenRequest { public String token; }
    @RequestMapping(value = "/resolve", method = RequestMethod.POST)
    public ResponseEntity<Map<String, String>> resolve(@RequestBody TokenRequest request) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(Collections.singletonMap("studentCode", service.resolveForAttendance(request.token)));
    }
}
