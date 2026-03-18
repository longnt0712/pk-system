package com.globits.richy.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.richy.dto.ProductDto;

public interface ProductService {
	public Page<ProductDto> getPageObject(ProductDto searchDto, int pageIndex, int pageSize);
	public List<ProductDto> getListObject(ProductDto searchDto, int pageIndex, int pageSize);
	public ProductDto getObjectById(Long id);
	public boolean saveObject(ProductDto dto);
	public boolean deleteObject(Long id);
}
