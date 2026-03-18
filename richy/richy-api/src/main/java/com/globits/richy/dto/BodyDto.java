package com.globits.richy.dto;

import java.io.Serializable;

import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;

import com.globits.richy.domain.Answer;
import com.globits.richy.domain.Body;

public class BodyDto implements Serializable{
	private Long id;
	private String text;
	private String rawText;
	private CategoryDto category;
	private String textSearch;
	
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
	public String getRawText() {
		return rawText;
	}
	public void setRawText(String rawText) {
		this.rawText = rawText;
	}
	public String getText() {
		return text;
	}
	public void setText(String text) {
		this.text = text;
	}
	public CategoryDto getCategory() {
		return category;
	}
	public void setCategory(CategoryDto category) {
		this.category = category;
	}
	public BodyDto() {
		
	}
	public BodyDto(Body domain) {
		this.id = domain.getId();
		this.text = domain.getText();
		this.rawText = domain.getRawText();
		if(domain.getCategory() != null) {
			this.category = new CategoryDto(domain.getCategory());
		}
	}
	
}
