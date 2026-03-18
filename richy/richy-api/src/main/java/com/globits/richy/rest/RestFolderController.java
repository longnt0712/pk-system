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

import com.globits.richy.dto.FolderDto;
import com.globits.richy.service.FolderService;

@RestController
@RequestMapping("/api/folder")
public class RestFolderController {
	@Autowired
	FolderService service;
	
//	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/get_page/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<FolderDto> getPage(@RequestBody FolderDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		return service.getPageObject(searchDto, pageIndex, pageSize);
	}
//	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/get_one/{id}", method = RequestMethod.GET)
	public FolderDto getOne(@PathVariable Long id) {
		return service.getObjectById(id);
	}
	
//	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/get_by_url/{url}", method = RequestMethod.GET)
	public FolderDto getOne(@PathVariable String url) {
		return service.findByUrl(url);
	}
	
	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/save", method = RequestMethod.POST)
	public boolean saveOne(@RequestBody FolderDto searchDto) {
		return service.saveObject(searchDto);
	}
	
	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/delete/{id}", method = RequestMethod.DELETE)
	public boolean saveOne(@PathVariable Long id) {
		return service.deleteObject(id);
	}
}
