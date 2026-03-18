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

import com.globits.richy.dto.BrandDto;
import com.globits.richy.service.BrandService;

@RestController
@RequestMapping("/public/brand")
public class RestBrandControllerForClient {
	@Autowired
	BrandService service;
	
//	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/get_page/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<BrandDto> getPage(@RequestBody BrandDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		return service.getPageObject(searchDto, pageIndex, pageSize);
	}
//	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/get_one/{id}", method = RequestMethod.GET)
	public BrandDto getOne(@PathVariable Long id) {
		return service.getObjectById(id);
	}
	
	@RequestMapping(value = "/get_by_url/{url}", method = RequestMethod.GET)
	public BrandDto getByUrl(@PathVariable String url) {
		return service.getObjectByUrl(url);
	}
	
	@RequestMapping(value = "/get_brand_with_children/{website}", method = RequestMethod.GET)
	public List<BrandDto> listBrandDtoWithChildren(@PathVariable int website) {
		return service.listBrandDtoWithChildren(website);
	}
}
