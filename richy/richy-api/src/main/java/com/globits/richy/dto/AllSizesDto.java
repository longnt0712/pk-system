package com.globits.richy.dto;

import java.io.Serializable;

import javax.persistence.Column;

import com.globits.richy.domain.AllSizes;
import com.globits.richy.domain.Folder;

public class AllSizesDto implements Serializable{
	private Long id;

	private String sizeVn;	
	private Integer website;//1: church; 1: richy; 2: shop crocs; 5: clothes
	private Integer important;
	
	
	
	public Integer getImportant() {
		return important;
	}
	public void setImportant(Integer important) {
		this.important = important;
	}
	public Integer getWebsite() {
		return website;
	}
	public void setWebsite(Integer website) {
		this.website = website;
	}
	public Long getId() {
		return id;
	}
	public void setId(Long id) {
		this.id = id;
	}
	public String getSizeVn() {
		return sizeVn;
	}
	public void setSizeVn(String sizeVn) {
		this.sizeVn = sizeVn;
	}
	public AllSizesDto() {
		
	}
	public AllSizesDto(AllSizes domain) {
		this.id = domain.getId();
		this.sizeVn = domain.getSizeVn();
		this.website = domain.getWebsite();
		this.important = domain.getImportant();
	}
	
}
