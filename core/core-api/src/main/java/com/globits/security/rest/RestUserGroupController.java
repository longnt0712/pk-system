package com.globits.security.rest;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.globits.security.dto.UserGroupDto;
import com.globits.security.service.UserGroupService;

@RestController
@RequestMapping(path = "/api/usergroup")
public class RestUserGroupController {

	@Autowired
	private UserGroupService service;

	@PreAuthorize("isAuthenticated()")
	@GetMapping(path = "/{id}")
	public ResponseEntity<UserGroupDto> getUserGroup(@PathVariable() Long id) {

		UserGroupDto dto = service.findById(id);

		if (dto == null) {
			return new ResponseEntity<>(new UserGroupDto(), HttpStatus.BAD_REQUEST);
		} else {
			return new ResponseEntity<>(dto, HttpStatus.OK);
		}
	}

	@PreAuthorize("isAuthenticated()")
	@GetMapping(path = "/all")
	public ResponseEntity<List<UserGroupDto>> getUserGroups() {

		List<UserGroupDto> list = service.findAll();

		return new ResponseEntity<>(list, HttpStatus.OK);
	}

	@PreAuthorize("isAuthenticated()")
	@GetMapping(path = "/list/{pageIndex}/{pageSize}")
	public ResponseEntity<Page<UserGroupDto>> getUserGroups(@PathVariable("pageIndex") int pageIndex,
			@PathVariable("pageSize") int pageSize) {

		if (pageIndex <= 0) {
			pageIndex = 0;
		}

		if (pageSize <= 0) {
			pageSize = 25;
		}

		Page<UserGroupDto> page = service.findList(pageIndex, pageSize);

		return new ResponseEntity<>(page, HttpStatus.OK);
	}

	@PreAuthorize("isAuthenticated()")
	@PostMapping()
	public ResponseEntity<UserGroupDto> saveUser(@RequestBody UserGroupDto dto) {

		UserGroupDto _dto = service.save(dto);

		if (_dto == null) {
			return new ResponseEntity<>(new UserGroupDto(), HttpStatus.BAD_REQUEST);
		} else {
			return new ResponseEntity<>(_dto, HttpStatus.OK);
		}
	}

	@PreAuthorize("isAuthenticated()")
	@DeleteMapping()
	public void deleteUser(@RequestBody UserGroupDto[] dtos) {
		service.delete(dtos);
	}
}
