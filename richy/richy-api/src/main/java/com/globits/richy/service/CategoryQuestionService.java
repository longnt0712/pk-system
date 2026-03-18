package com.globits.richy.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.richy.dto.CategoryQuestionDto;

public interface CategoryQuestionService {
	public Page<CategoryQuestionDto> getPageObject(CategoryQuestionDto searchDto, int pageIndex, int pageSize);
	public List<CategoryQuestionDto> getListObject(CategoryQuestionDto searchDto, int pageIndex, int pageSize);
	public CategoryQuestionDto getObjectById(Long id);
	public boolean saveObject(CategoryQuestionDto dto);
	public boolean deleteObject(Long id);
}
