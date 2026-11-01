package com.globits.richy.dto;

import java.io.Serializable;

import com.globits.richy.domain.Answer;
import com.globits.richy.domain.EducationProgram;

public class EducationProgramDto implements Serializable{
	private Long id;
	private String name;
	private String code;
	private String description;
	private String textSearch;
	private Boolean main;
	private String createDate;

	public Boolean getMain() { return main; }
	public void setMain(Boolean main) { this.main = main; }
	public String getCreateDate() { return createDate; }
	public void setCreateDate(String createDate) { this.createDate = createDate; }
	
	public String getDescription() {
		return description;
	}
	public void setDescription(String description) {
		this.description = description;
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
	public String getTextSearch() {
		return textSearch;
	}
	public void setTextSearch(String textSearch) {
		this.textSearch = textSearch;
	}
	public EducationProgramDto() {
		
	}
	public EducationProgramDto(EducationProgram domain) {
		this.id = domain.getId();
		this.name = domain.getName();
		this.code = domain.getCode();
		this.description = domain.getDescription();
		this.main = Boolean.TRUE.equals(domain.getMain());
		this.createDate = domain.getCreateDate() == null ? null : domain.getCreateDate().toString("yyyy-MM-dd'T'HH:mm:ss");
	}
	
}
