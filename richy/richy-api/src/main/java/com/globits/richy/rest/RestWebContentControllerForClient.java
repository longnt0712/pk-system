package com.globits.richy.rest;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import com.globits.richy.dto.WebContentDto;
import com.globits.richy.service.WebContentService;

@RestController
@RequestMapping("/public/web_content")
public class RestWebContentControllerForClient {
	@Autowired
	WebContentService service;
	
//	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/get_page/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<WebContentDto> getPage(@RequestBody WebContentDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		return service.getPageObject(searchDto, pageIndex, pageSize);
	}
//	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/get_one/{id}", method = RequestMethod.GET)
	public WebContentDto getOne(@PathVariable Long id) {
		return service.getObjectById(id);
	}
	
//	@Secured("ROLE_ADMIN")
//	@RequestMapping(value = "/get_by_url/{url}", method = RequestMethod.GET)
//	public WebContentDto getOne(@PathVariable String url) {
//		return service.findByUrl(url);
//	}
	
}
