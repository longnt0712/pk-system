package com.globits.richy.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.richy.dto.CategoryDto;

public interface CategoryService {
	public Page<CategoryDto> getPageObject(CategoryDto searchDto, int pageIndex, int pageSize);
	public List<CategoryDto> getListObject(CategoryDto searchDto, int pageIndex, int pageSize);
	public CategoryDto getObjectById(Long id);
	public boolean saveObject(CategoryDto dto);
	public boolean deleteObject(Long id);
}
