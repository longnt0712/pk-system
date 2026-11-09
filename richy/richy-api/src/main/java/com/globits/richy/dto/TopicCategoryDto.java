package com.globits.richy.dto;

import java.io.Serializable;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.globits.richy.domain.TopicCategory;

public class TopicCategoryDto implements Serializable{
	private Long id;
	private String name;
	private Long parentId;
	private boolean parentSpecified;

	public Long getParentId() { return parentId; }
	public void setParentId(Long parentId) { this.parentId = parentId; this.parentSpecified = true; }
	@JsonIgnore
	public boolean isParentSpecified() { return parentSpecified; }
	
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
	public TopicCategoryDto() {
		
	}
	public TopicCategoryDto(TopicCategory domain) {
		this.id = domain.getId();
		this.name = domain.getName();
		this.parentId = domain.getParent() == null ? null : domain.getParent().getId();
	}
	
}
