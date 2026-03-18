package com.globits.richy.dto;

import java.io.Serializable;

import com.globits.richy.domain.CategoryQuestion;

public class CategoryQuestionDto implements Serializable{
	private Long id;
	private CategoryDto category;
	private QuestionDto question;
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
	public CategoryDto getCategory() {
		return category;
	}
	public void setCategory(CategoryDto category) {
		this.category = category;
	}
	public QuestionDto getQuestion() {
		return question;
	}
	public void setQuestion(QuestionDto question) {
		this.question = question;
	}
	public CategoryQuestionDto() {
		
	}
	public CategoryQuestionDto(CategoryQuestion domain) {
		this.id = domain.getId();
		if(domain.getCategory() != null) {
			this.category = new CategoryDto(domain.getCategory());
		}
		if(domain.getQuestion() != null) {
			this.question = new QuestionDto(domain.getQuestion());
		}
	}
	
}
