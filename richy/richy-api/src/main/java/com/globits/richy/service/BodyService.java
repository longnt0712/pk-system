package com.globits.richy.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.richy.dto.BodyDto;

public interface BodyService {
	public Page<BodyDto> getPageObject(BodyDto searchDto, int pageIndex, int pageSize);
	public List<BodyDto> getListObject(BodyDto searchDto, int pageIndex, int pageSize);
	public BodyDto getObjectById(Long id);
	public boolean saveObject(BodyDto dto);
	public boolean deleteObject(Long id);
	public boolean saveListObject(BodyDto dto);
	
	public List<BodyDto> getRandomAllObject();
}
