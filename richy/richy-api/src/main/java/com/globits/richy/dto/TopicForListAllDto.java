package com.globits.richy.dto;

import java.io.Serializable;

import javax.persistence.Column;

import com.globits.richy.domain.Topic;

public class TopicForListAllDto implements Serializable{
	private Long id;
	private String name;
	private Long categoryId;
	private String categoryName;
	public Long getCategoryId() { return categoryId; }
	public void setCategoryId(Long value) { categoryId = value; }
	public String getCategoryName() { return categoryName; }
	public void setCategoryName(String value) { categoryName = value; }
		
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
	public TopicForListAllDto() {
		
	}
	public TopicForListAllDto(Topic item) {
		this.id = item.getId();
		this.name = item.getName();
		if (item.getTopicCategory() != null) {
			categoryId = item.getTopicCategory().getId();
			categoryName = item.getTopicCategory().getName();
		}
	}
	
}
