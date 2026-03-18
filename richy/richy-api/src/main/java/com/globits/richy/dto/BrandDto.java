package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

import javax.persistence.Column;
import javax.persistence.Lob;

import com.globits.richy.domain.Brand;
import com.globits.richy.domain.Folder;

public class BrandDto implements Serializable{
	private Long id;

	private String name;
	private String code;
	private String url;
	private BrandDto parent;
	private String textSearch;
	private List<BrandDto> children = new ArrayList<BrandDto>();
	private String description;
	private Integer website;//1: church; 1: richy; 2: shop crocs; 5: clothes
	
	public Integer getWebsite() {
		return website;
	}
	public void setWebsite(Integer website) {
		this.website = website;
	}
	public String getDescription() {
		return description;
	}
	public void setDescription(String description) {
		this.description = description;
	}
	public List<BrandDto> getChildren() {
		return children;
	}
	public void setChildren(List<BrandDto> children) {
		this.children = children;
	}
	public String getUrl() {
		return url;
	}
	public void setUrl(String url) {
		this.url = url;
	}
	public String getTextSearch() {
		return textSearch;
	}
	public void setTextSearch(String textSearch) {
		this.textSearch = textSearch;
	}
	public Long getId() {
		return id;
	}
	public void setId(Long id) {
		this.id = id;
	}
	public String getName() {
		return name;
	}
	public void setName(String name) {
		this.name = name;
	}
	public String getCode() {
		return code;
	}
	public void setCode(String code) {
		this.code = code;
	}
	public BrandDto getParent() {
		return parent;
	}
	public void setParent(BrandDto parent) {
		this.parent = parent;
	}
	public BrandDto() {
		
	}
	public BrandDto(Brand domain) {
		this.id = domain.getId();
		this.name = domain.getName();
		this.code = domain.getCode();
		this.url = domain.getUrl();
		this.description = domain.getDescription();
		this.website = domain.getWebsite();
		if(domain.getParent() !=null) {
			this.parent = new BrandDto();
			this.parent.setId(domain.getParent().getId());
			this.parent.setName(domain.getParent().getName());
			this.parent.setCode(domain.getParent().getCode());
			if(domain.getParent().getParent() != null) {
				this.parent.setParent(new BrandDto(domain.getParent()));	
			}
		}
	}
	
}
