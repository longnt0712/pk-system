package com.globits.richy.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.richy.dto.AllSizesDto;

public interface AllSizesService {
	public Page<AllSizesDto> getPageObject(AllSizesDto searchDto, int pageIndex, int pageSize);
	public List<AllSizesDto> getListObject(AllSizesDto searchDto, int pageIndex, int pageSize);
	public AllSizesDto getObjectById(Long id);
	public boolean saveObject(AllSizesDto dto);
	public boolean deleteObject(Long id);
}
