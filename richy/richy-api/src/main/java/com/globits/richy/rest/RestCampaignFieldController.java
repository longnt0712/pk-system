package com.globits.richy.rest;

import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import com.globits.richy.dto.CampaignFieldDto;
import com.globits.richy.service.impl.*;

@RestController
public class RestCampaignFieldController {
    @Autowired private CampaignFieldService service;
    private static <T> ResponseEntity<T> response(T data) {
        // Private responses must never survive logout in a browser/proxy cache.
        return ResponseEntity.ok().header("Cache-Control","no-store, max-age=0").header("Vary","Authorization")
                .header("X-Robots-Tag","noindex, nofollow").body(data);
    }
    @RequestMapping(value="/public/campaigns/{id}/field",method=RequestMethod.GET)
    public ResponseEntity<CampaignFieldDto> students(@PathVariable("id") Long id,
            @RequestParam(value="classId",required=false) Long classId,@RequestParam(value="q",defaultValue="") String q,
            @RequestParam(value="cursor",defaultValue="") String cursor,@RequestParam(value="size",defaultValue="6") int size) {
        return response(service.students(id,classId,q,cursor,size));
    }
    @RequestMapping(value="/api/campaigns/{id}/field",method=RequestMethod.GET)
    public ResponseEntity<CampaignFieldDto> managed(@PathVariable("id") Long id,
            @RequestParam(value="classId",required=false) Long classId,@RequestParam(value="q",defaultValue="") String q,
            @RequestParam(value="cursor",defaultValue="") String cursor,@RequestParam(value="size",defaultValue="6") int size) {
        return response(service.managed(id,classId,q,cursor,size));
    }
    @RequestMapping(value="/public/campaigns/{id}/field/classes",method=RequestMethod.GET)
    public ResponseEntity<List<CampaignFieldDto.ClassOption>> classes(@PathVariable("id") Long id) {return response(service.classes(id));}
    @RequestMapping(value="/api/campaigns/{id}/field/export",method=RequestMethod.GET)
    public ResponseEntity<CampaignFieldDto> exportGardens(@PathVariable("id") Long id,
            @RequestParam("classId") Long classId,@RequestParam(value="cursor",defaultValue="") String cursor,
            @RequestParam(value="size",defaultValue="12") int size) {
        return response(service.exportGardens(id,classId,cursor,size));
    }
    @ExceptionHandler(CampaignService.InvalidCampaignException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String,String> invalid(CampaignService.InvalidCampaignException error){return Collections.singletonMap("message",error.getMessage());}
}
