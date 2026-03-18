package com.globits.richy.dto;

import java.io.Serializable;

import com.globits.richy.domain.Answer;

public class AnswerDto implements Serializable{
	private Long id;
	private String answer;
	private String text;
	private String textSearch;
	public Long getId() {
		return id;
	}
	public void setId(Long id) {
		this.id = id;
	}
	public String getAnswer() {
		return answer;
	}
	public void setAnswer(String answer) {
		this.answer = answer;
	}
	public String getText() {
		return text;
	}
	public void setText(String text) {
		this.text = text;
	}
	public String getTextSearch() {
		return textSearch;
	}
	public void setTextSearch(String textSearch) {
		this.textSearch = textSearch;
	}
	public AnswerDto() {
		
	}
	public AnswerDto(Answer domain) {
		this.id = domain.getId();
		this.answer = domain.getAnswer();
		this.text = domain.getText();
	}
	
}
