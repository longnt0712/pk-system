package com.globits.richy.dto;

import java.io.Serializable;

import com.globits.richy.domain.Answer;
import com.globits.richy.domain.EducationProgram;
import com.globits.richy.domain.Mark;

public class MarkDto implements Serializable{
	private Long id;
	private String name;
	private String code;
	private Integer coefficient;
	private String description;
	private EducationProgramDto educationProgram;
//	private String markText;
//	private Double markNumber;
	private String message;
	private String textSearch;
	
	public String getMessage() {
		return message;
	}
	public void setMessage(String message) {
		this.message = message;
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
	public String getCode() {
		return code;
	}
	public void setCode(String code) {
		this.code = code;
	}
	public String getDescription() {
		return description;
	}
	public void setDescription(String description) {
		this.description = description;
	}
	public EducationProgramDto getEducationProgram() {
		return educationProgram;
	}
	public Integer getCoefficient() {
		return coefficient;
	}
	public void setCoefficient(Integer coefficient) {
		this.coefficient = coefficient;
	}
	public void setEducationProgram(EducationProgramDto educationProgram) {
		this.educationProgram = educationProgram;
	}
	public String getTextSearch() {
		return textSearch;
	}
	public void setTextSearch(String textSearch) {
		this.textSearch = textSearch;
	}
	public MarkDto() {
		
	}
	public MarkDto(Mark domain) {
		this.id = domain.getId();
		this.code = domain.getCode();
		this.name = domain.getName();
		this.coefficient = domain.getCoefficient();
		this.description = domain.getDescription();
		if(domain != null && domain.getEducationProgram() != null) {
			this.educationProgram = new EducationProgramDto(domain.getEducationProgram());
		}
	}
	
}
