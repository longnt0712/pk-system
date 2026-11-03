package com.globits.richy.rest;

import com.globits.richy.service.impl.TnttDocumentService;
import java.util.Map;
import javax.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/public/tntt-documents")
public class RestPublicTnttDocumentController {
    @Autowired private TnttDocumentService service;

    @RequestMapping(value = "/{token}", method = RequestMethod.GET)
    public ResponseEntity<Map<String, Object>> read(@PathVariable("token") String token, HttpServletResponse response) {
        response.setHeader("Cache-Control", "private, no-store");
        response.setHeader("Referrer-Policy", "no-referrer");
        response.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
        Map<String, Object> document = service.readPublicLink(token);
        return document == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(document);
    }
}
