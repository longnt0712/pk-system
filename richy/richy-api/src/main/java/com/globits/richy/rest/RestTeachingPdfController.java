package com.globits.richy.rest;

import java.io.IOException;
import java.util.Collections;
import java.util.Map;

import javax.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.fasterxml.jackson.databind.JsonNode;
import com.globits.richy.service.EnrolmentClassScheduleException;
import com.globits.richy.service.impl.TeachingPdfService;

@RestController
@Secured({"ROLE_ADMIN", "ROLE_EDUCATION_MANAGEMENT", "ROLE_STUDENT_MANAGEMENT"})
@RequestMapping("/api/class_teaching_pdf/{classId}/{date}")
public class RestTeachingPdfController {
    private final TeachingPdfService pdf;

    @Autowired
    public RestTeachingPdfController(TeachingPdfService pdf) { this.pdf = pdf; }

    @RequestMapping(method = RequestMethod.GET)
    public Map<String, Object> list(@PathVariable Long classId, @PathVariable String date) {
        return pdf.list(classId, date);
    }

    @RequestMapping(value = "/upload", method = RequestMethod.POST)
    public Map<String, String> upload(@PathVariable Long classId, @PathVariable String date,
            @RequestParam("file") MultipartFile file, @RequestParam(value = "folderId", required = false) String folderId) throws IOException {
        return pdf.upload(classId, date, file, folderId);
    }

    @RequestMapping(value = "/folders", method = RequestMethod.POST)
    public Map<String, String> createFolder(@PathVariable Long classId, @PathVariable String date,
            @RequestBody Map<String, String> request) {
        return pdf.saveFolder(classId, date, null, request.get("parentId"), request.get("name"));
    }

    @RequestMapping(value = "/folders/{id}", method = RequestMethod.PUT)
    public Map<String, String> updateFolder(@PathVariable Long classId, @PathVariable String date, @PathVariable String id,
            @RequestBody Map<String, String> request) {
        return pdf.saveFolder(classId, date, id, request.get("parentId"), request.get("name"));
    }

    @RequestMapping(value = "/files/{id}", method = RequestMethod.PUT)
    public Map<String, String> updateFile(@PathVariable Long classId, @PathVariable String date, @PathVariable String id,
            @RequestBody Map<String, String> request) {
        return pdf.updateFile(classId, date, id, request.get("folderId"), request.get("name"));
    }

    @RequestMapping(value = "/attach", method = RequestMethod.POST)
    public Map<String, String> attach(@PathVariable Long classId, @PathVariable String date,
            @RequestBody Map<String, String> request) {
        return pdf.attach(classId, date, request.get("pdfId"), request.get("previousRun"));
    }

    @RequestMapping(value = "/folders/{id}", method = RequestMethod.DELETE)
    public Map<String, String> deleteFolder(@PathVariable Long classId, @PathVariable String date, @PathVariable String id) {
        return pdf.deleteFolder(classId, date, id);
    }

    @RequestMapping(value = "/files/{id}", method = RequestMethod.DELETE)
    public Map<String, String> deleteFile(@PathVariable Long classId, @PathVariable String date, @PathVariable String id) {
        return pdf.deleteFile(classId, date, id);
    }

    @RequestMapping(value = "/run/{runId}", method = RequestMethod.GET)
    public ResponseEntity<Map<String, Object>> open(@PathVariable Long classId, @PathVariable String date, @PathVariable String runId) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(pdf.open(classId, date, runId));
    }

    @RequestMapping(value = "/run/{runId}/changes", method = RequestMethod.GET)
    public ResponseEntity<Map<String, Object>> changes(@PathVariable Long classId, @PathVariable String date,
            @PathVariable String runId, @RequestParam("afterRevision") int afterRevision) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(pdf.changes(classId, date, runId, afterRevision));
    }

    @RequestMapping(value = "/run/{runId}/content", method = RequestMethod.GET)
    public void content(@PathVariable Long classId, @PathVariable String date, @PathVariable String runId,
            HttpServletResponse response) throws IOException {
        byte[] bytes = pdf.content(classId, date, runId);
        // This app's MVC converters only handle strings and JSON.
        response.setContentType("application/pdf");
        response.setContentLength(bytes.length);
        response.setHeader("Cache-Control", "private, no-store");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("Content-Disposition", "attachment; filename=\"lesson.pdf\"");
        response.getOutputStream().write(bytes);
    }

    @RequestMapping(value = "/run/{runId}", method = RequestMethod.PUT)
    public Map<String, Object> save(@PathVariable Long classId, @PathVariable String date, @PathVariable String runId,
            @RequestBody JsonNode request) {
        return pdf.save(classId, date, runId, request);
    }

    @ExceptionHandler(EnrolmentClassScheduleException.class)
    public ResponseEntity<Map<String, String>> handleError(EnrolmentClassScheduleException error) {
        return ResponseEntity.status(error.getStatus()).body(Collections.singletonMap("message", error.getMessage()));
    }
}
