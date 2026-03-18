package com.globits.richy.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.richy.dto.FolderDto;

public interface FolderService {
	public Page<FolderDto> getPageObject(FolderDto searchDto, int pageIndex, int pageSize);
	public List<FolderDto> getListObject(FolderDto searchDto, int pageIndex, int pageSize);
	public FolderDto getObjectById(Long id);
	public boolean saveObject(FolderDto dto);
	public boolean deleteObject(Long id);
	
	public FolderDto findByUrl(String url);
}
