package com.globits.richy.service;

import java.util.List;

import org.springframework.data.domain.Page;
import com.globits.core.service.GenericService;
import com.globits.richy.domain.PersonDate;
import com.globits.richy.dto.PersonDateDto;

public interface PersonDateService extends GenericService<PersonDate, Long> {

	public Page<PersonDateDto> getPageObject(PersonDateDto searchDto, int pageIndex, int pageSize);
	public PersonDateDto getObjectById(Long id);
	public PersonDateDto saveObject(PersonDateDto dto);
	public boolean deleteObject(Long id);
	public boolean saveListByEnrollmentClass(int enrollmentClass);
	
}
