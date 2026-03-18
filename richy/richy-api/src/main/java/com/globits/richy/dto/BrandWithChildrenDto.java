package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

import com.globits.richy.domain.Brand;
import com.globits.richy.domain.Folder;

public class BrandWithChildrenDto implements Serializable{
	private Long id;
	
	private BrandDto brand;

	private List<BrandDto> children = new ArrayList<BrandDto>();
	
	
	public BrandDto getBrand() {
		return brand;
	}
	public void setBrand(BrandDto brand) {
		this.brand = brand;
	}
	public Long getId() {
		return id;
	}
	public void setId(Long id) {
		this.id = id;
	}
	public List<BrandDto> getChildren() {
		return children;
	}
	public void setChildren(List<BrandDto> children) {
		this.children = children;
	}
	public BrandWithChildrenDto() {
		
	}
	public BrandWithChildrenDto(Brand domain) {
		
		
	}
	
}
