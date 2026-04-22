package com.globits.richy.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.richy.dto.TopicCategoryDto;

public interface TopicCategoryService {
	public Page<TopicCategoryDto> getPageObject(TopicCategoryDto searchDto, int pageIndex, int pageSize);
//	public List<TopicCategoryDto> getListObject(TopicCategoryDto searchDto, int pageIndex, int pageSize);
	public TopicCategoryDto getObjectById(Long id);
	public boolean saveObject(TopicCategoryDto dto);
	public boolean deleteObject(Long id);
}
