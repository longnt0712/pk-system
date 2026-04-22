package com.globits.richy.dto;

import java.io.Serializable;

import javax.persistence.Column;

import com.globits.richy.domain.Topic;
import com.globits.richy.domain.TopicCategory;

public class TopicDto implements Serializable{
	private Long id;
	private String name;
	private String content;
	private String contentHtml;
	private String textSearch;
	private String contentSearch;
	private String username;
	private String message;
	private TopicCategoryDto topicCategory;

	
	public TopicCategoryDto getTopicCategory() {
		return topicCategory;
	}
	public void setTopicCategory(TopicCategoryDto topicCategory) {
		this.topicCategory = topicCategory;
	}
	public String getContentHtml() {
		return contentHtml;
	}
	public void setContentHtml(String contentHtml) {
		this.contentHtml = contentHtml;
	}
	public String getContentSearch() {
		return contentSearch;
	}
	public void setContentSearch(String contentSearch) {
		this.contentSearch = contentSearch;
	}
	public String getContent() {
		return content;
	}
	public void setContent(String content) {
		this.content = content;
	}
	public String getMessage() {
		return message;
	}
	public void setMessage(String message) {
		this.message = message;
	}
	private Long userId; 
	
	public Long getUserId() {
		return userId;
	}
	public void setUserId(Long userId) {
		this.userId = userId;
	}
	public String getUsername() {
		return username;
	}
	public void setUsername(String username) {
		this.username = username;
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
	public String getTextSearch() {
		return textSearch;
	}
	public void setTextSearch(String textSearch) {
		this.textSearch = textSearch;
	}
	public TopicDto() {
		
	}
	public TopicDto(Topic item) {
		super();
		this.id = item.getId();
		this.name = item.getName();
		if(item.getTopicCategory() != null) {
			this.topicCategory = new TopicCategoryDto(item.getTopicCategory());
		}
	}
	
	public TopicDto(Topic item, boolean showContent) {
		this.id = item.getId();
		this.name = item.getName();	
		if(showContent) {
			this.contentHtml = item.getContentHtml();
			this.content = item.getContent();
		}
		if(item.getTopicCategory() != null) {
			this.topicCategory = new TopicCategoryDto(item.getTopicCategory());
		}
	}
	
}
