package com.globits.core.rest;

import java.util.List;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import com.globits.core.domain.AdministrativeUnit;
import com.globits.core.dto.AdministrativeUnitDto;
import com.globits.core.service.AdministrativeUnitService;

@RestController
@RequestMapping("/api/administrativeunit")
public class RestAdministrativeUnitController {
	@PersistenceContext
	private EntityManager manager;
	@Autowired
	private AdministrativeUnitService administrativeUnitService;

	@RequestMapping(value = "/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT" })
	public Page<AdministrativeUnit> getList(@PathVariable int pageIndex, @PathVariable int pageSize) {
		Page<AdministrativeUnit> page = administrativeUnitService.getListAdministrativeUnitByTree(pageIndex, pageSize);
		return page;
	}
	@RequestMapping(value = "tree/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT" })
	public ResponseEntity<Page<AdministrativeUnitDto>> getListTree(@PathVariable int pageIndex, @PathVariable int pageSize) {
		Page<AdministrativeUnitDto> page = administrativeUnitService.getListTree(pageIndex, pageSize);
		return new ResponseEntity<Page<AdministrativeUnitDto>>(page, HttpStatus.OK);
	}

	@RequestMapping(value = "/listProvince/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	@Secured({ "ROLE_ADMIN", "ROLE_USER" ,"ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT"})
	public Page<AdministrativeUnit> getListProvince(@PathVariable int pageIndex, @PathVariable int pageSize) {
		Page<AdministrativeUnit> page = administrativeUnitService.getListAdministrativeUnitbyProvince(pageIndex,
				pageSize);
		return page;
	}

	@RequestMapping(value = "/listCity/{parentId}/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT" })
	public Page<AdministrativeUnit> getListCity(@PathVariable("parentId") Long parentId, @PathVariable int pageIndex,
			@PathVariable int pageSize) {
		Page<AdministrativeUnit> page = administrativeUnitService.getListAdministrativeUnitbyCity(parentId, pageIndex,
				pageSize);
		return page;
	}
	
	@RequestMapping(value = "/simple/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT" })
	public Page<AdministrativeUnitDto> findByPageBasicInfo(@PathVariable int pageIndex, @PathVariable int pageSize) {
		Page<AdministrativeUnitDto> page = administrativeUnitService.findByPageBasicInfo(pageIndex, pageSize);
		return page;
	}

	@Secured({ "ROLE_ADMIN", "ROLE_USER" ,"ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT"})
	@RequestMapping(value = "/{administrativeUnitId}", method = RequestMethod.GET)
	public AdministrativeUnit geAdministrativeUnit(@PathVariable("administrativeUnitId") String administrativeUnitId) {
		AdministrativeUnit administrativeUnit = administrativeUnitService.findById(new Long(administrativeUnitId));
		administrativeUnit = new AdministrativeUnit(administrativeUnit, true);
		return administrativeUnit;
	}

	@Secured({ "ROLE_ADMIN"})
	@RequestMapping(method = RequestMethod.POST)
	public AdministrativeUnit saveAdministrativeUnit(@RequestBody AdministrativeUnit AdministrativeUnit) {
		return administrativeUnitService.save(AdministrativeUnit);
	}

	@Secured({ "ROLE_ADMIN"})
	@RequestMapping(value = "/{administrativeUnitId}", method = RequestMethod.PUT)
	public AdministrativeUnit updateAdministrativeUnit(@RequestBody AdministrativeUnit AdministrativeUnit,
			@PathVariable("administrativeUnitId") String administrativeUnitId) {
		return administrativeUnitService.updateAdministrativeUnit(AdministrativeUnit, new Long(administrativeUnitId));
	}

	@Secured({ "ROLE_ADMIN"})
	@RequestMapping(value = "/{administrativeUnitId}", method = RequestMethod.DELETE)
	public AdministrativeUnitDto removeAdministrativeUnit(
			@PathVariable("administrativeUnitId") String administrativeUnitId) {
		AdministrativeUnitDto administrativeUnit = administrativeUnitService.deleteAdministrativeUnit(new Long(administrativeUnitId));
		return administrativeUnit;
	}
	
	@Secured({ "ROLE_ADMIN"})
	@RequestMapping(method = RequestMethod.DELETE)
	public int removeAdministrativeUnits(
			@RequestBody List<AdministrativeUnitDto> dtos) {
		return administrativeUnitService.deleteAdministrativeUnits(dtos);
	}
}
