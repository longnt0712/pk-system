package com.globits.richy.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.richy.dto.EducationProgramDto;

public interface EducationProgramService {
	public Page<EducationProgramDto> getPageObject(EducationProgramDto searchDto, int pageIndex, int pageSize);
	public List<EducationProgramDto> getListObject(EducationProgramDto searchDto, int pageIndex, int pageSize);
	public EducationProgramDto getObjectById(Long id);
	public boolean saveObject(EducationProgramDto dto);
	public boolean deleteObject(Long id);
}
