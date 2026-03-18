package com.globits.richy.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.core.dto.OrganizationDto;
import com.globits.core.dto.PersonDto;
import com.globits.richy.dto.AnswerDto;

public interface AnswerService {
	public Page<AnswerDto> getPageObject(AnswerDto searchDto, int pageIndex, int pageSize);
	public List<AnswerDto> getListObject(AnswerDto searchDto, int pageIndex, int pageSize);
	public AnswerDto getObjectById(Long id);
	public boolean saveObject(AnswerDto dto);
	public boolean deleteObject(Long id);
}
