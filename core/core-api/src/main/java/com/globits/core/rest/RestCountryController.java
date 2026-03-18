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

import com.globits.core.domain.Country;
import com.globits.core.dto.CountryDto;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.service.CountryService;

@RestController
@RequestMapping("/api/country")
public class RestCountryController {
	@PersistenceContext
	private EntityManager manager;
	@Autowired
	private CountryService countryService;

	@RequestMapping(value = "/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	@Secured({ "ROLE_ADMIN", "ROLE_USER" ,"ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT"})
	public Page<Country> getList(@PathVariable int pageIndex, @PathVariable int pageSize) {
		Page<Country> page = countryService.getList(pageIndex, pageSize);
		return page;
	}

	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT" , "ROLE_STUDENT"})
	@RequestMapping(value = "/{countryId}", method = RequestMethod.GET)
	public Country getCountry(@PathVariable("countryId") String countryId) {
		Country country = countryService.findById(new Long(countryId));
		// building = new Building(building);
		return country;
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(method = RequestMethod.POST)
	public Country saveCountry(@RequestBody Country country) {
		return countryService.save(country);
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/{countryId}", method = RequestMethod.PUT)
	public Country updateCountry(@RequestBody Country Country, @PathVariable("countryId") Long CountryId) {
		return countryService.save(Country);
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/{countryId}", method = RequestMethod.DELETE)
	public Country removeCountry(@PathVariable("countryId") String countryId) {
		Country Country = countryService.delete(new Long(countryId));
		return Country;
	}
	
	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/checkCode/{code}",method = RequestMethod.GET)
	public CountryDto checkDuplicateCode(@PathVariable("code") String code) {
		return countryService.checkDuplicateCode(code);
	}
}
