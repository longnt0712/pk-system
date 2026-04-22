package com.globits.richy.dto;

import java.io.Serializable;

import com.globits.richy.domain.Answer;
import com.globits.richy.domain.TopicCategory;

public class TopicCategoryDto implements Serializable{
	private Long id;
	private String name;
	
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
	}
	
}
