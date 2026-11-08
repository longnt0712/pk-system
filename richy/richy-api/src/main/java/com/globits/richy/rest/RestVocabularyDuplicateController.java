package com.globits.richy.rest;

import com.globits.richy.dto.VocabularyDuplicateDto;
import com.globits.richy.service.impl.VocabularyDuplicateService;
import java.util.Collections;
import java.util.List;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/question/vocabulary/duplicates")
public class RestVocabularyDuplicateController {
    @Autowired private VocabularyDuplicateService service;

    private ResponseEntity<?> response(Supplier<?> action) {
        try { return ResponseEntity.ok(action.get()); }
        catch (AccessDeniedException exception) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Collections.singletonMap("message", exception.getMessage()));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(Collections.singletonMap("message", exception.getMessage()));
        } catch (IllegalStateException exception) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Collections.singletonMap("message", exception.getMessage()));
        }
    }

    @Secured({"ROLE_ADMIN", "ROLE_USER"})
    @RequestMapping(method = RequestMethod.GET)
    public ResponseEntity<?> groups(@RequestParam(value="includeReviewed",defaultValue="false") boolean includeReviewed) { return response(() -> service.groups(includeReviewed)); }

    @Secured({"ROLE_ADMIN", "ROLE_USER"})
    @RequestMapping(value = "/details", method = RequestMethod.POST)
    public ResponseEntity<?> details(@RequestBody VocabularyDuplicateDto.Group group) {
        return response(() -> service.details(group == null ? null : group.getIds()));
    }

    @Secured({"ROLE_ADMIN", "ROLE_USER"})
    @RequestMapping(value = "/merge", method = RequestMethod.POST)
    public ResponseEntity<?> merge(@RequestBody VocabularyDuplicateDto.Merge request) {
        return response(() -> service.merge(request));
    }

    @Secured({"ROLE_ADMIN", "ROLE_USER"})
    @RequestMapping(value = "/merge_batch", method = RequestMethod.POST)
    public ResponseEntity<?> mergeBatch(@RequestBody List<VocabularyDuplicateDto.Merge> requests) {
        return response(() -> service.mergeBatch(requests));
    }

    @Secured({"ROLE_ADMIN", "ROLE_USER"})
    @RequestMapping(value = "/review", method = RequestMethod.POST)
    public ResponseEntity<?> setReviewed(@RequestBody VocabularyDuplicateDto.Review request) {
        return response(() -> service.setReviewed(request));
    }
}
