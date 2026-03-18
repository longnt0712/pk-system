package com.globits.richy.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.richy.dto.WebContentDto;

public interface WebContentService {
	public Page<WebContentDto> getPageObject(WebContentDto searchDto, int pageIndex, int pageSize);
	public List<WebContentDto> getListObject(WebContentDto searchDto, int pageIndex, int pageSize);
	public WebContentDto getObjectById(Long id);
	public WebContentDto saveObject(WebContentDto dto);
	public boolean deleteObject(Long id);
	
}
