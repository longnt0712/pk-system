package com.globits.richy.rest;
import com.globits.richy.service.impl.SpeakingAnswerShareService;
import com.globits.richy.service.impl.SpeakingAnswerShareService.Request;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.annotation.Secured;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/speaking/answer-shares")
@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_VIEWER","ROLE_STUDENT","ROLE_EDUCATION_MANAGEMENT","ROLE_STUDENT_MANAGEMENT"})
public class RestSpeakingAnswerShareController {
    @Autowired private SpeakingAnswerShareService service;
    @RequestMapping(method=RequestMethod.GET) public List<Map<String,Object>> list(@RequestParam("setId")Long setId,@RequestParam(value="studentId",required=false)Long studentId){return service.list(setId,studentId);}
    @RequestMapping(method=RequestMethod.POST) public ResponseEntity<Map<String,Object>> create(@RequestBody Request request){return ResponseEntity.ok().header("Cache-Control","no-store").body(service.create(request));}
    @RequestMapping(value="/{id}/copy",method=RequestMethod.POST)
    public ResponseEntity<Map<String,Object>> copy(@PathVariable("id") Long id) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(service.copy(id));
    }
    @RequestMapping(value="/{id}/revoke",method=RequestMethod.POST) public Map<String,Object> revoke(@PathVariable Long id){return service.revoke(id);}
    @ExceptionHandler(IllegalArgumentException.class) @ResponseStatus(HttpStatus.BAD_REQUEST) public Map<String,String> invalid(IllegalArgumentException e){return Collections.singletonMap("message",e.getMessage());}
    @ExceptionHandler(AccessDeniedException.class) @ResponseStatus(HttpStatus.FORBIDDEN) public Map<String,String> denied(AccessDeniedException e){return Collections.singletonMap("message",e.getMessage());}
}
