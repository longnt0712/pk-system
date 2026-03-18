package com.globits.core.rest;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import com.globits.core.domain.Building;
import com.globits.core.dto.BuildingDto;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.service.BuildingService;

@RestController
@RequestMapping("/api/building")
public class RestBuildingController {
	@PersistenceContext
	private EntityManager manager;
	@Autowired
	private BuildingService buildingService;

	@RequestMapping(value = "/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT"})
	public Page<BuildingDto> getList(@PathVariable int pageIndex, @PathVariable int pageSize) {
		Page<BuildingDto> page = buildingService.getListByPage(pageIndex, pageSize);
		return page;
	}

	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT"})
	@RequestMapping(value = "/{buildingId}", method = RequestMethod.GET)
	public BuildingDto getBuilding(@PathVariable("buildingId") String buildingId) {
		BuildingDto building = buildingService.getBuilding(new Long(buildingId));
		return building;
	}

	@Secured({"ROLE_ADMIN"})
	@RequestMapping(method = RequestMethod.POST)
	public BuildingDto saveBuilding(@RequestBody BuildingDto dto) {
		return buildingService.saveBuilding(dto);
	}

	@Secured({"ROLE_ADMIN"})
	@RequestMapping(value = "/{buildingId}", method = RequestMethod.PUT)
	public BuildingDto updateBuilding(@RequestBody BuildingDto Building, @PathVariable("buildingId") Long buildingId) {
		return buildingService.saveBuilding(Building);
	}

	@Secured({"ROLE_ADMIN"})
	@RequestMapping(value = "/{buildingId}", method = RequestMethod.DELETE)
	public BuildingDto removeBuilding(@PathVariable("buildingId") String buildingId) {
		BuildingDto building = buildingService.deleteBuilding(new Long(buildingId));
		return building;
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT"})
	@RequestMapping(value = "/checkCode/{code}",method = RequestMethod.GET)
	public BuildingDto checkDuplicateCode(@PathVariable("code") String code) {
		return buildingService.checkDuplicateCode(code);
	}
}
