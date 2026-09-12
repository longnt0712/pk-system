package com.globits.richy.rest;
import java.util.List;
import java.util.Map;
import java.util.Collections;
import javax.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.*;
import com.globits.richy.dto.StudentMarkShareDto;
import com.globits.richy.dto.StudentMarkShareRequestDto;
import com.globits.richy.service.StudentMarkShareService;

@RestController
@RequestMapping("/api/student_mark/share")
@Secured({"ROLE_ADMIN","ROLE_EDUCATION_MANAGERMENT","ROLE_STUDENT_MANAGERMENT"})
public class RestStudentMarkShareController {
    @Autowired StudentMarkShareService service;
    @RequestMapping(method=RequestMethod.POST)
    public StudentMarkShareDto create(@RequestBody StudentMarkShareRequestDto dto,HttpServletRequest request){return service.create(dto,request);}
    @RequestMapping(method=RequestMethod.GET)
    public List<StudentMarkShareDto> list(@RequestParam("classId") Integer classId,@RequestParam("programId") Long programId,HttpServletRequest request){return service.list(classId,programId,request);}
    @RequestMapping(value="/{id}/revoke",method=RequestMethod.POST)
    public StudentMarkShareDto revoke(@PathVariable("id") Long id,HttpServletRequest request){return service.revoke(id,request);}
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String,String>> invalid(IllegalArgumentException error){return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Collections.singletonMap("message",error.getMessage()));}
}
