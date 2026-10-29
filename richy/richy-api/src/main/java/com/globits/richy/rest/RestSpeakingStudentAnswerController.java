package com.globits.richy.rest;

import com.globits.richy.dto.SpeakingStudentAnswerDto.*;
import com.globits.richy.service.impl.SpeakingStudentAnswerService;
import com.globits.richy.service.impl.SpeakingServiceImpl;
import java.io.IOException;
import java.util.Map;
import javax.persistence.OptimisticLockException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/speaking/student-answers")
@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_VIEWER","ROLE_STUDENT","ROLE_EDUCATION_MANAGERMENT","ROLE_STUDENT_MANAGERMENT"})
public class RestSpeakingStudentAnswerController {
    @Autowired private SpeakingStudentAnswerService service;
    private ResponseEntity<Map<String,Object>> response(Map<String,Object> body,HttpStatus status){HttpHeaders headers=new HttpHeaders();headers.set("Cache-Control","private, no-store");return new ResponseEntity<Map<String,Object>>(body,headers,status);}
    @RequestMapping(method=RequestMethod.GET)
    public ResponseEntity<Map<String,Object>> list(@RequestParam("setId")Long setId,@RequestParam(value="studentId",required=false)Long studentId,@RequestParam(value="questionId",required=false)Long questionId){return response(service.list(setId,studentId,questionId),HttpStatus.OK);}
    @RequestMapping(method=RequestMethod.PUT)
    public ResponseEntity<Map<String,Object>> save(@RequestBody WriteRequest request){return response(service.save(request),HttpStatus.OK);}
    @RequestMapping(value="/template",method=RequestMethod.GET)
    public ResponseEntity<byte[]> template(@RequestParam("setId")Long setId,@RequestParam(value="studentId",required=false)Long studentId)throws IOException{
        byte[] bytes=service.template(setId,studentId);HttpHeaders headers=new HttpHeaders();headers.set("Cache-Control","private, no-store");headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));headers.set("Content-Disposition","attachment; filename=\"speaking-student-answers.xlsx\"");return new ResponseEntity<byte[]>(bytes,headers,HttpStatus.OK);
    }
    @RequestMapping(value="/preview",method=RequestMethod.POST)
    public ResponseEntity<Map<String,Object>> preview(@RequestParam("setId")Long setId,@RequestParam(value="studentId",required=false)Long studentId,@RequestParam("file")MultipartFile file)throws IOException{
        if(file==null||file.isEmpty()||file.getSize()>8L*1024*1024)throw new IllegalArgumentException("Chọn file .xlsx nhỏ hơn 8 MB.");return response(service.preview(setId,studentId,file.getBytes()),HttpStatus.OK);
    }
    @RequestMapping(value="/confirm",method=RequestMethod.POST)
    public ResponseEntity<Map<String,Object>> confirm(@RequestBody ImportRequest request){return response(service.confirm(request),HttpStatus.OK);}
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String,Object>> invalid(IllegalArgumentException error){return response(SpeakingServiceImpl.map("message",error.getMessage()),HttpStatus.BAD_REQUEST);}
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String,Object>> denied(AccessDeniedException error){return response(SpeakingServiceImpl.map("message",error.getMessage()),HttpStatus.FORBIDDEN);}
    @ExceptionHandler({SpeakingStudentAnswerService.Conflict.class,OptimisticLockException.class,ObjectOptimisticLockingFailureException.class,DataIntegrityViolationException.class})
    public ResponseEntity<Map<String,Object>> conflict(Exception error){return response(SpeakingServiceImpl.map("message",new SpeakingStudentAnswerService.Conflict().getMessage(),"conflict",true),HttpStatus.CONFLICT);}
    @ExceptionHandler(IOException.class)
    public ResponseEntity<Map<String,Object>> fileError(IOException error){org.slf4j.LoggerFactory.getLogger(getClass()).warn("Speaking student answer workbook operation failed",error);return response(SpeakingServiceImpl.map("message","Chưa đọc được file câu trả lời. Hãy dùng mẫu Excel Speaking và thử lại."),HttpStatus.BAD_REQUEST);}
}
