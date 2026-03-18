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

import com.globits.core.domain.Location;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.dto.LocationDto;
import com.globits.core.service.LocationService;

@RestController
@RequestMapping("/api/location")
public class RestLocationController {
	@PersistenceContext
	private EntityManager manager;
	@Autowired
	private LocationService locationService;

	@RequestMapping(value = "/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT" })
	public Page<Location> getList(@PathVariable int pageIndex, @PathVariable int pageSize) {
		Page<Location> page = locationService.getList(pageIndex, pageSize);
		return page;
	}

	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT" })
	@RequestMapping(value = "/{locationId}", method = RequestMethod.GET)
	public Location getEthnics(@PathVariable("locationId") String locationId) {
		Location ethnics = locationService.findById(new Long(locationId));
		return ethnics;
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(method = RequestMethod.POST)
	public Location saveLocation(@RequestBody Location location) {
		return locationService.save(location);
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/{locationId}", method = RequestMethod.PUT)
	public Location updateLocation(@RequestBody Location Location, @PathVariable("locationId") Long locationId) {
		return locationService.save(Location);
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/{locationId}", method = RequestMethod.DELETE)
	public Location removeLocation(@PathVariable("locationId") String locationId) {
		Location Location = locationService.delete(new Long(locationId));
		return Location;
	}

	/**
	 * Get a list of all locations
	 * 
	 * @author Tuan Anh for Calendar
	 */
	@Secured({ "ROLE_ADMIN", "ROLE_USER" ,"ROLE_STUDENT_MANAGERMENT"})
	@RequestMapping(value = "/all", method = RequestMethod.GET)
	public ResponseEntity<List<LocationDto>> getAllLocations() {

		List<LocationDto> list = locationService.getAll();

		return new ResponseEntity<List<LocationDto>>(list, HttpStatus.OK);
	}
	
	@Secured({ "ROLE_ADMIN", "ROLE_USER" ,"ROLE_STUDENT_MANAGERMENT"})
	@RequestMapping(value = "/checkCode/{code}",method = RequestMethod.GET)
	public LocationDto checkDuplicateCode(@PathVariable("code") String code) {
		return locationService.checkDuplicateCode(code);
	}
}
