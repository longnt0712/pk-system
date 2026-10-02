package com.globits.richy.rest;
import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import com.globits.richy.dto.CampaignFlowerDto;
import com.globits.richy.service.impl.*;

@RestController
@RequestMapping("/public/campaign-flower")
public class RestPublicCampaignFlowerController {
    @Autowired private CampaignFlowerService service;
    private static <T> ResponseEntity<T> response(T dto) {
        return ResponseEntity.ok().header("Cache-Control", "no-store, max-age=0").header("Pragma", "no-cache")
                .header("Referrer-Policy", "no-referrer").header("X-Robots-Tag", "noindex, nofollow, noarchive").body(dto);
    }
    @RequestMapping(value = "/scan", method = RequestMethod.POST)
    public ResponseEntity<CampaignFlowerDto.Access> scan(@RequestBody CampaignFlowerDto.AccessRequest request) {
        return response(service.scan(request.studentCode));
    }
    @RequestMapping(value = "/{token}", method = RequestMethod.GET)
    public ResponseEntity<CampaignFlowerDto.Landing> landing(@PathVariable("token") String token) { return response(service.landing(token)); }
    @RequestMapping(value = "/{token}/campaigns/{id}", method = RequestMethod.GET)
    public ResponseEntity<CampaignFlowerDto.Sheet> sheet(@PathVariable("token") String token, @PathVariable("id") Long id,
            @RequestParam(value = "week", defaultValue = "0") int week) { return response(service.sheet(token, id, week)); }
    @RequestMapping(value = "/{token}/campaigns/{id}/entries/{date}/{itemKey}", method = RequestMethod.PUT)
    public ResponseEntity<CampaignFlowerDto.Entry> check(@PathVariable("token") String token, @PathVariable("id") Long id,
            @PathVariable("date") String date, @PathVariable("itemKey") String itemKey, @RequestBody CampaignFlowerDto.CheckRequest request) {
        return response(service.check(token, id, date, itemKey, request.completed));
    }
    @ExceptionHandler(CampaignService.InvalidCampaignException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> invalid(CampaignService.InvalidCampaignException error) { return Collections.singletonMap("message", error.getMessage()); }
    @RequestMapping(value = "/{token}/campaigns/{id}/garden", method = RequestMethod.GET)
    public ResponseEntity<CampaignFlowerDto.Garden> garden(@PathVariable("token") String token, @PathVariable("id") Long id) {
        return response(service.garden(token, id));
    }
    @RequestMapping(value = "/{token}/campaigns/{id}/garden/{date}/{itemKey}", method = RequestMethod.PUT)
    public ResponseEntity<CampaignFlowerDto.Garden> paint(@PathVariable("token") String token, @PathVariable("id") Long id,
            @PathVariable("date") String date, @PathVariable("itemKey") String itemKey, @RequestBody CampaignFlowerDto.PaintRequest request) {
        return response(service.paint(token, id, date, itemKey, request.color));
    }
    @RequestMapping(value = "/{token}/campaigns/{id}/garden/reset", method = RequestMethod.POST)
    public ResponseEntity<CampaignFlowerDto.Garden> resetPaint(@PathVariable("token") String token, @PathVariable("id") Long id) {
        return response(service.resetPaint(token, id));
    }
}
