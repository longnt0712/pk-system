package com.globits.richy.dto;

import java.io.Serializable;

import javax.persistence.Column;

import com.globits.richy.domain.Folder;

public class FolderDto implements Serializable{
	private Long id;

	private String name;
	private String code;
	private String url;
	private FolderDto parent;
	private String textSearch;
	private Integer type;// 1: thông báo; 2: tin tức; 3 lịch lễ; 4: Lời Chúa
	private Integer website;//1: church; 1: richy; 2: shop crocs
	
	public Integer getWebsite() {
		return website;
	}
	public void setWebsite(Integer website) {
		this.website = website;
	}
	public Integer getType() {
		return type;
	}
	public void setType(Integer type) {
		this.type = type;
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
	public String getUrl() {
		return url;
	}
	public void setUrl(String url) {
		this.url = url;
	}
	public FolderDto getParent() {
		return parent;
	}
	public void setParent(FolderDto parent) {
		this.parent = parent;
	}
	public FolderDto() {
		
	}
	public FolderDto(Folder domain) {
		this.id = domain.getId();
		this.name = domain.getName();
		this.code = domain.getCode();
		this.url = domain.getUrl();
		this.type = domain.getType();
		this.website = domain.getWebsite();
		
		if(domain.getParent() !=null) {
			this.parent = new FolderDto();
			this.parent.setId(domain.getParent().getId());
			this.parent.setName(domain.getParent().getName());
			this.parent.setCode(domain.getParent().getCode());
			this.parent.setUrl(domain.getParent().getUrl());
			if(domain.getParent().getParent() != null) {
				this.parent.setParent(new FolderDto(domain.getParent()));	
			}
			
//			this.parent.set
			
		}
	}
	
	public FolderDto(Long id, String url, String name, Folder parent) {
		this.id = id;
		this.url = url;
		this.name = name;
		if(parent != null) {
			this.parent = new FolderDto();
			this.parent.setId(parent.getId());
			this.parent.setName(parent.getName());
			this.parent.setUrl(parent.getUrl());
			if(parent.getParent() != null) {
				this.parent.setParent(new FolderDto(parent.getId(),parent.getUrl(),parent.getName(),parent.getParent()));
			}
			
		}
				
	}
	
	
}
