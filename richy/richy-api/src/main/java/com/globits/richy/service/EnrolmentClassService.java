package com.globits.richy.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.core.dto.OrganizationDto;
import com.globits.core.dto.PersonDto;
import com.globits.richy.dto.EnrolmentClassDto;

public interface EnrolmentClassService {
	public Page<EnrolmentClassDto> getPageObject(EnrolmentClassDto searchDto, int pageIndex, int pageSize);
	public List<EnrolmentClassDto> getListObject(EnrolmentClassDto searchDto, int pageIndex, int pageSize);
	public EnrolmentClassDto getObjectById(Long id);
	public boolean saveObject(EnrolmentClassDto dto);
	public boolean deleteObject(Long id);
}
