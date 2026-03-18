package com.globits.richy.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.richy.dto.MarkDto;

public interface MarkService {
	public Page<MarkDto> getPageObject(MarkDto searchDto, int pageIndex, int pageSize);
	public List<MarkDto> getListObject(MarkDto searchDto, int pageIndex, int pageSize);
	public MarkDto getObjectById(Long id);
	public MarkDto saveObject(MarkDto dto);
	public boolean deleteObject(Long id);
}
