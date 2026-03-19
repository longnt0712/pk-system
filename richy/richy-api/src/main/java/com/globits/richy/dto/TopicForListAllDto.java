package com.globits.richy.dto;

import java.io.Serializable;

import javax.persistence.Column;

import com.globits.richy.domain.Topic;

public class TopicForListAllDto implements Serializable{
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
	public TopicForListAllDto() {
		
	}
	public TopicForListAllDto(Topic item) {
		this.id = item.getId();
		this.name = item.getName();
	}
	
}
