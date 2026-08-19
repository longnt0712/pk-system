package com.globits.richy.dto;

import java.io.Serializable;

import com.globits.richy.domain.Answer;
import com.globits.richy.domain.EnrolmentClass;

public class EnrolmentClassDto implements Serializable{
	private Long id;
	private String name;
	private String code;
	private Integer schoolId;

	public Integer getSchoolId() {
		return schoolId;
	}
	public void setSchoolId(Integer schoolId) {
		this.schoolId = schoolId;
	}
	private String textSearch;
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
	public EnrolmentClassDto() {
		
	}
	public EnrolmentClassDto(EnrolmentClass domain) {
		this.id = domain.getId();
		this.name = domain.getName();
		this.code = domain.getCode();
		this.schoolId = domain.getSchoolId();
	}
	
}
