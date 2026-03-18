package com.globits.richy.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.richy.dto.QuestionTypeDto;

public interface QuestionTypeService {
	public Page<QuestionTypeDto> getPageObject(QuestionTypeDto searchDto, int pageIndex, int pageSize);
	public List<QuestionTypeDto> getListObject(QuestionTypeDto searchDto, int pageIndex, int pageSize);
	public QuestionTypeDto getObjectById(Long id);
	public boolean saveObject(QuestionTypeDto dto);
	public boolean deleteObject(Long id);
}
