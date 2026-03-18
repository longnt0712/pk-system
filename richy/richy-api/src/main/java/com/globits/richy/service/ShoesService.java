package com.globits.richy.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.richy.dto.ShoesDisplayDto;
import com.globits.richy.dto.ShoesDto;

public interface ShoesService {
	public Page<ShoesDto> getPageObject(ShoesDto searchDto, int pageIndex, int pageSize);
	public Page<ShoesDisplayDto> getPageObjectDisplay(ShoesDto searchDto, int pageIndex, int pageSize);
	public Page<ShoesDisplayDto> getPageArchitectureDisplay(ShoesDto searchDto, int pageIndex, int pageSize);
	public List<ShoesDto> getListObject(ShoesDto searchDto, int pageIndex, int pageSize);
	public ShoesDto getObjectById(Long id);
	public ShoesDto saveObject(ShoesDto dto);
	public boolean deleteObject(Long id);
}
