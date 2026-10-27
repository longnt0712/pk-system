package com.globits.richy.rest;

import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import com.globits.richy.domain.*;
import com.globits.richy.dto.FairDto;
import com.globits.richy.service.impl.FairService;

@RestController
public class RestFairController {
    @Autowired private FairService service;
    private <T> ResponseEntity<T> response(T value) {
        return ResponseEntity.ok().header("Cache-Control", "no-store, max-age=0")
            .header("Pragma", "no-cache").header("X-Robots-Tag", "noindex, nofollow").body(value);
    }
    @GetMapping("/public/fairs") public ResponseEntity<List<FairEvent>> events() { return response(service.events(false)); }
    @GetMapping("/api/fairs") public ResponseEntity<List<FairEvent>> allEvents() { return response(service.events(true)); }
    @GetMapping("/public/fairs/{id}") public ResponseEntity<FairEvent> event(@PathVariable("id") Long id) { return response(service.event(id)); }
    @GetMapping("/public/fairs/{id}/balance") public ResponseEntity<FairDto.Balance> balance(@PathVariable("id") Long id, @RequestParam("cardCode") String code) { return response(service.balance(id, code)); }
    @PostMapping("/api/fairs") public ResponseEntity<FairEvent> create(@RequestBody FairDto.EventRequest request) { return response(service.saveEvent(null, request)); }
    @PutMapping("/api/fairs/{id}") public ResponseEntity<FairEvent> update(@PathVariable("id") Long id, @RequestBody FairDto.EventRequest request) { return response(service.saveEvent(id, request)); }
    @GetMapping("/api/fairs/{id}/operator") public ResponseEntity<FairDto.Operator> operator(@PathVariable("id") Long id) { return response(service.operator(id)); }
    @GetMapping("/api/fairs/{id}/stations") public ResponseEntity<List<FairStation>> stations(@PathVariable("id") Long id) { return response(service.stations(id)); }
    @PostMapping("/api/fairs/{id}/stations") public ResponseEntity<FairStation> station(@PathVariable("id") Long id, @RequestBody FairDto.StationRequest request) { return response(service.saveStation(id, request)); }
    @GetMapping("/api/fairs/{id}/guests") public ResponseEntity<List<FairWallet>> guests(@PathVariable("id") Long id) { return response(service.guests(id)); }
    @PostMapping("/api/fairs/{id}/guests") public ResponseEntity<List<FairWallet>> generateGuests(@PathVariable("id") Long id, @RequestBody FairDto.GuestRequest request) {
        return response(service.generateGuests(id, request.count == null ? 100 : request.count));
    }
    @PostMapping("/api/fairs/{id}/transactions") public ResponseEntity<FairDto.Receipt> transact(@PathVariable("id") Long id, @RequestBody FairDto.TransactionRequest request) { return response(service.transact(id, request)); }
    @PostMapping("/api/fairs/{id}/transactions/{transactionId}/correct") public ResponseEntity<FairDto.Receipt> correct(@PathVariable("id") Long id, @PathVariable("transactionId") Long transactionId, @RequestBody FairDto.CorrectionRequest request) { return response(service.correct(id, transactionId, request)); }
    @GetMapping("/api/fairs/{id}/transactions") public ResponseEntity<List<FairTransaction>> history(@PathVariable("id") Long id,
            @RequestParam(value = "cardCode", defaultValue = "") String code, @RequestParam(value = "before", defaultValue = "0") long before) {
        return response(service.history(id, code, before));
    }
    @ExceptionHandler(FairService.Invalid.class) public ResponseEntity<Map<String,String>> invalid(FairService.Invalid error) { return ResponseEntity.badRequest().body(Collections.singletonMap("message", error.getMessage())); }
    @ExceptionHandler(FairService.Missing.class) public ResponseEntity<Map<String,String>> missing(FairService.Missing error) { return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Collections.singletonMap("message", error.getMessage())); }
}
