package com.globits.richy.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.richy.dto.BrandDto;
import com.globits.richy.dto.BrandWithChildrenDto;

public interface BrandService {
	public Page<BrandDto> getPageObject(BrandDto searchDto, int pageIndex, int pageSize);
	public List<BrandDto> getListObject(BrandDto searchDto, int pageIndex, int pageSize);
	public BrandDto getObjectById(Long id);
	
	public BrandDto getObjectByUrl(String url);
	
	public boolean saveObject(BrandDto dto);
	public boolean deleteObject(Long id);
	
	public List<BrandWithChildrenDto> listAllBrandWithChildrens();
	
	public List<BrandDto> listBrandDtoWithChildren(Integer website);
	
}
