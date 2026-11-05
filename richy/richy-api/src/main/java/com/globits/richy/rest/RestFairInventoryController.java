package com.globits.richy.rest;

import com.globits.richy.domain.FairItemOption;
import com.globits.richy.dto.FairItemRow;
import com.globits.richy.service.impl.FairInventoryService;
import com.globits.richy.service.impl.FairService;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import javax.persistence.OptimisticLockException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/fairs")
public class RestFairInventoryController {
    private final FairInventoryService inventory;

    public RestFairInventoryController(FairInventoryService inventory) {
        this.inventory = inventory;
    }

    @GetMapping("/{event}/items")
    public List<FairItemRow> items(@PathVariable("event") Long event) {
        return inventory.items(event);
    }

    @GetMapping("/{event}/items/{id}/photo")
    public ResponseEntity<byte[]> photo(@PathVariable("event") Long event, @PathVariable("id") Long id) {
        return ResponseEntity.ok().contentType(MediaType.IMAGE_JPEG).cacheControl(CacheControl.noStore())
                .header("X-Content-Type-Options", "nosniff").body(inventory.photo(event, id));
    }

    @PostMapping(value = {"/{event}/items", "/{event}/items/{id}"}, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public FairItemRow saveItem(@PathVariable("event") Long event,
            @PathVariable(value = "id", required = false) Long id,
            @RequestParam(value = "revision", required = false) Long revision,
            @RequestParam("name") String name, @RequestParam("unitPrice") long unitPrice,
            @RequestParam("quantity") int quantity, @RequestParam("categoryId") Long categoryId,
            @RequestParam("difficultyId") Long difficultyId,
            @RequestParam(value = "removePhoto", defaultValue = "false") boolean removePhoto,
            @RequestParam(value = "photo", required = false) MultipartFile photo) {
        return inventory.saveItem(event, id, revision, name, unitPrice, quantity, categoryId, difficultyId, removePhoto, photo);
    }

    @DeleteMapping("/{event}/items/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteItem(@PathVariable("event") Long event, @PathVariable("id") Long id,
            @RequestParam("revision") Long revision) {
        inventory.deleteItem(event, id, revision);
    }

    @GetMapping("/item-options")
    public List<FairItemOption> options() {
        return inventory.options();
    }

    public static class OptionRequest {
        public String kind;
        public String name;
    }

    @PostMapping("/item-options")
    public FairItemOption createOption(@RequestBody OptionRequest request) {
        return inventory.saveOption(null, request.kind, request.name);
    }

    @PutMapping("/item-options/{id}")
    public FairItemOption updateOption(@PathVariable("id") Long id, @RequestBody OptionRequest request) {
        return inventory.saveOption(id, request.kind, request.name);
    }

    @DeleteMapping("/item-options/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteOption(@PathVariable("id") Long id, @RequestParam("kind") String kind) {
        inventory.deleteOption(id, kind);
    }

    @ExceptionHandler(FairService.Invalid.class)
    public ResponseEntity<Map<String, String>> invalid(FairService.Invalid error) {
        return ResponseEntity.badRequest().body(Collections.singletonMap("message", error.getMessage()));
    }

    @ExceptionHandler(FairService.Missing.class)
    public ResponseEntity<Map<String, String>> missing(FairService.Missing error) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Collections.singletonMap("message", error.getMessage()));
    }

    @ExceptionHandler({FairInventoryService.Conflict.class, OptimisticLockException.class,
            ObjectOptimisticLockingFailureException.class, DataIntegrityViolationException.class})
    public ResponseEntity<Map<String, String>> conflict() {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Collections.singletonMap(
                "message", "Dữ liệu đã thay đổi. Hãy tải lại bảng trước khi thử lại."));
    }
}
