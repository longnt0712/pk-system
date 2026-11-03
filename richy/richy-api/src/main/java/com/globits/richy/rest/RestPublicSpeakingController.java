package com.globits.richy.rest;
import com.globits.richy.service.impl.SpeakingAnswerShareService;
import com.globits.richy.service.impl.SpeakingStudentAnswerService;
import com.globits.richy.dto.SpeakingStudentAnswerDto.*;
import java.util.*;
import javax.persistence.OptimisticLockException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/public/speaking")
public class RestPublicSpeakingController {
    @Autowired private SpeakingAnswerShareService service;
    private ResponseEntity<Map<String,Object>> response(Map<String,Object> value){return ResponseEntity.ok().header("Cache-Control","no-store, max-age=0").header("Referrer-Policy","no-referrer").header("X-Robots-Tag","noindex, nofollow, noarchive").body(value);}
    @RequestMapping(method=RequestMethod.GET) public ResponseEntity<Map<String,Object>> bank(@RequestHeader(value="X-Speaking-Share",required=false)String token){return response(service.bank(token));}
    @RequestMapping(value="/answer",method=RequestMethod.GET) public ResponseEntity<Map<String,Object>> answer(@RequestHeader(value="X-Speaking-Share",required=false)String token,@RequestParam("questionId")Long questionId,@RequestParam(value="revision",required=false)Long revision){return response(service.answer(token,questionId,revision));}
    @RequestMapping(value="/answer",method=RequestMethod.PUT) public ResponseEntity<Map<String,Object>> save(@RequestHeader(value="X-Speaking-Share",required=false)String token,@RequestBody WriteRequest request){return response(service.save(token,request));}
    @RequestMapping(value="/notebook",method=RequestMethod.GET) public ResponseEntity<Map<String,Object>> notebook(@RequestHeader(value="X-Speaking-Share",required=false)String token,@RequestParam("questionId")Long questionId,@RequestParam(value="revision",required=false)Long revision){return response(service.notebook(token,questionId,revision));}
    @RequestMapping(value="/notebook",method=RequestMethod.PUT) public ResponseEntity<Map<String,Object>> saveNotebook(@RequestHeader(value="X-Speaking-Share",required=false)String token,@RequestBody NotebookRequest request){return response(service.saveNotebook(token,request));}
    @ExceptionHandler(AccessDeniedException.class) public ResponseEntity<Map<String,Object>> denied(){return ResponseEntity.status(HttpStatus.FORBIDDEN).header("Cache-Control","no-store").body(Collections.<String,Object>singletonMap("message","Link không còn khả dụng hoặc không cho phép thao tác này."));}
    @ExceptionHandler(IllegalArgumentException.class) public ResponseEntity<Map<String,Object>> invalid(IllegalArgumentException e){return ResponseEntity.badRequest().header("Cache-Control","no-store").body(Collections.<String,Object>singletonMap("message",e.getMessage()));}
    @ExceptionHandler({SpeakingStudentAnswerService.Conflict.class,OptimisticLockException.class,org.springframework.orm.ObjectOptimisticLockingFailureException.class}) public ResponseEntity<Map<String,Object>> conflict(){return ResponseEntity.status(HttpStatus.CONFLICT).header("Cache-Control","no-store").body(Collections.<String,Object>singletonMap("message","Bài vừa được sửa ở nơi khác. Bản đang viết được giữ để đối chiếu."));}
}
