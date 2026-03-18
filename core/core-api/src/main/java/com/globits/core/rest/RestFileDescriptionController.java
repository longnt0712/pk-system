package com.globits.core.rest;


import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;


import javax.servlet.http.HttpServletRequest;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;

import com.globits.core.domain.FileDescription;
import com.globits.core.service.FileDescriptionService;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
@RestController
@RequestMapping("/public/file")
public class RestFileDescriptionController {
	 private static final Logger logger = LoggerFactory.getLogger(RestFileDescriptionController.class);
	 
	@Autowired
	FileDescriptionService fileService;
    @RequestMapping(value = "/getbyid/{id}", method = RequestMethod.GET)
	public ResponseEntity<InputStreamResource> downloadFileById(@PathVariable Long id, HttpServletRequest request) throws IOException {
    		FileDescription fileDesc = fileService.findById(id);
    		String filePath = null;
	        String contentType = null;
    		if(fileDesc!=null) {
    			filePath = fileDesc.getFilePath();
    		}
    		//ClassPathResource fileResource = new ClassPathResource(filePath);
    		FileInputStream file = new FileInputStream(new File(filePath));
	        //Resource resource = loadFileAsResource(filePath);
	        // Try to determine file's content type
    		HttpHeaders headers = new HttpHeaders();
    	    headers.add("Cache-Control", "no-cache, no-store, must-revalidate");
    	    headers.add("Pragma", "no-cache");
    	    headers.add("Expires", "0");

    	    return ResponseEntity
    	            .ok()
    	            .headers(headers)
    	            .contentLength(fileDesc.getContentSize())
    	            .contentType(MediaType.parseMediaType(fileDesc.getContentType()))
    	            .body(new InputStreamResource(file));
	}
    
    @RequestMapping(value = "/download/{fileName}", method = RequestMethod.GET, produces = "application/pdf")
    public ResponseEntity<InputStreamResource> download(@PathVariable("fileName") String fileName) throws IOException {
     System.out.println("Calling Download:- " + fileName);
     //ClassPathResource pdfFile = new ClassPathResource("downloads/" + fileName);
     ClassPathResource pdfFile = new ClassPathResource("http://localhost/great/Test.pdf");
     
     HttpHeaders headers = new HttpHeaders();
     headers.setContentType(MediaType.parseMediaType("application/pdf"));
     headers.add("Access-Control-Allow-Origin", "*");
     headers.add("Access-Control-Allow-Methods", "GET, POST, PUT");
     headers.add("Access-Control-Allow-Headers", "Content-Type");
     headers.add("Content-Disposition", "filename=" + fileName);
     headers.add("Cache-Control", "no-cache, no-store, must-revalidate");
     headers.add("Pragma", "no-cache");
     headers.add("Expires", "0");
     String filePath = "C:\\Projects\\Globits\\GREAT-MIS\\Test.pdf";
     File file = new File(filePath);
     FileInputStream inputStream = new FileInputStream(new File(filePath));
     
     headers.setContentLength(file.length());
     ResponseEntity<InputStreamResource> response = new ResponseEntity<InputStreamResource>(
       new InputStreamResource(inputStream), headers, HttpStatus.OK);
     return response;

    }
}
