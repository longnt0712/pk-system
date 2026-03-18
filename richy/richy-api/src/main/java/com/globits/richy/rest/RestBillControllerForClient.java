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
import com.globits.richy.domain.Bill;
import com.globits.richy.dto.BillDto;
import com.globits.richy.repository.BillRepository;
import com.globits.richy.service.BillService;

@RestController
@RequestMapping("/public/bill")
public class RestBillControllerForClient {
	@Autowired
	BillService service;
	
//	@Secured({"ROLE_ADMIN","ROLE_USER"})
//	@RequestMapping(value = "/get_page/{pageIndex}/{pageSize}", method = RequestMethod.POST)
//	public Page<BillDto> getPage(@RequestBody BillDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
//		return service.getPageObject(searchDto, pageIndex, pageSize);
//	}
//	@Secured({"ROLE_ADMIN","ROLE_USER"})
//	@RequestMapping(value = "/get_one/{id}", method = RequestMethod.GET)
//	public BillDto getOne(@PathVariable Long id) {
//		return service.getObjectById(id);
//	}
	
//	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/save", method = RequestMethod.POST)
	public boolean saveOne(@RequestBody BillDto searchDto) {
		return service.saveObject(searchDto);
	}
	
//	@Secured({"ROLE_ADMIN","ROLE_USER"})
//	@RequestMapping(value = "/delete/{id}", method = RequestMethod.DELETE)
//	public boolean saveOne(@PathVariable Long id) {
//		return service.deleteObject(id);
//	}

}
