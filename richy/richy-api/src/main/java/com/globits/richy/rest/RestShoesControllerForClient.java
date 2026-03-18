package com.globits.richy.rest;

import java.io.IOException;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.globits.richy.test;
import com.globits.richy.domain.Shoes;
import com.globits.richy.domain.ShoesImageUrls;
import com.globits.richy.dto.ShoesDisplayDto;
import com.globits.richy.dto.ShoesDto;
import com.globits.richy.repository.ShoesImageUrlsRepository;
import com.globits.richy.repository.ShoesRepository;
import com.globits.richy.service.ShoesService;

@RestController
@RequestMapping("/public/shoes")
public class RestShoesControllerForClient {
	@Autowired
	ShoesService service;
	@Autowired
	ShoesImageUrlsRepository shoesImageUrlsRepository;
	@Autowired
	ShoesRepository shoesRepository;
	
//	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/get_page/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<ShoesDto> getPage(@RequestBody ShoesDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		return service.getPageObject(searchDto, pageIndex, pageSize);
	}
	@RequestMapping(value = "/get_page_display/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<ShoesDisplayDto> getPageDisplay(@RequestBody ShoesDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		return service.getPageObjectDisplay(searchDto, pageIndex, pageSize);
	}
	
	@RequestMapping(value = "/get_page_architecture_display/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<ShoesDisplayDto> getPageArchitectureDisplay(@RequestBody ShoesDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		return service.getPageArchitectureDisplay(searchDto, pageIndex, pageSize);
	}
	
//	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/get_one/{id}", method = RequestMethod.GET)
	public ShoesDto getOne(@PathVariable Long id) {
		return service.getObjectById(id);
	}
	
	
}
