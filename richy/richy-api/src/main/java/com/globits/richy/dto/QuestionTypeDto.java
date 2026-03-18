package com.globits.richy.dto;

import java.io.Serializable;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import com.globits.core.domain.BaseObject;
import com.globits.richy.domain.QuestionType;

public class QuestionTypeDto implements Serializable{
	private Long id;
	private String name;
	private String code;
	private String textSearch;
	
	public String getTextSearch() {
		return textSearch;
	}
	public void setTextSearch(String textSearch) {
		this.textSearch = textSearch;
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
	public Long getId() {
		return id;
	}
	public void setId(Long id) {
		this.id = id;
	}
	public QuestionTypeDto() {
	}	
	public QuestionTypeDto(QuestionType domain) {
		this.id = domain.getId();
		this.name = domain.getName();
		this.code = domain.getCode();
	}
}
