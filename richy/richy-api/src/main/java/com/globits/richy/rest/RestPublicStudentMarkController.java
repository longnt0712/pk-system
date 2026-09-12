package com.globits.richy.rest;
import javax.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.globits.richy.dto.PublicStudentMarkTableDto;
import com.globits.richy.service.StudentMarkShareService;

@RestController
@RequestMapping("/public/student-marks")
public class RestPublicStudentMarkController {
    @Autowired StudentMarkShareService service;
    @RequestMapping(value="/{token}",method=RequestMethod.GET)
    public ResponseEntity<PublicStudentMarkTableDto> read(@PathVariable("token") String token,HttpServletRequest request) {
        return ResponseEntity.ok().header("Cache-Control","no-store, max-age=0").header("Pragma","no-cache")
                .header("Referrer-Policy","no-referrer").header("X-Robots-Tag","noindex, nofollow, noarchive")
                .body(service.read(token,request));
    }
}
