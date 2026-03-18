package com.globits.richy.rest;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import com.globits.richy.dto.TopicDto;
import com.globits.richy.service.TopicService;

@RestController
@RequestMapping("/public/topic")
public class RestTopicControllerForClient {
	@Autowired
	TopicService service;
	
//	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/get_page/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<TopicDto> getPage(@RequestBody TopicDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		return service.getPageObject(searchDto, pageIndex, pageSize);
	}
//	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/get_one/{id}", method = RequestMethod.GET)
	public TopicDto getOne(@PathVariable Long id) {
		return service.getObjectById(id);
	}
	
//	@Secured({"ROLE_ADMIN","ROLE_USER"})
//	@RequestMapping(value = "/save", method = RequestMethod.POST)
//	public TopicDto saveOne(@RequestBody TopicDto searchDto) {
//		return service.saveObject(searchDto);
//	}
//	
//	@Secured({"ROLE_ADMIN","ROLE_USER"})
//	@RequestMapping(value = "/delete/{id}", method = RequestMethod.DELETE)
//	public boolean saveOne(@PathVariable Long id) {
//		return service.deleteObject(id);
//	}
	
}
