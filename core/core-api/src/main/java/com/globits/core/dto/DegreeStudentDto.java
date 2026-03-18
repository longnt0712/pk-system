package com.globits.core.dto;

import com.globits.core.domain.DegreeStudent;

public class DegreeStudentDto {

	private Long id;

	private String name;

	private String code;

	private Double minMark;

	private Double maxMark;
	
	private boolean isDuplicate;
	private String dupName;
	private String dupCode;

	public DegreeStudentDto() {

	}

	public DegreeStudentDto(DegreeStudent entity) {

		if (entity == null) {
			return;
		}

		this.id = entity.getId();
		this.code = entity.getCode();
		this.name = entity.getName();
		this.maxMark = entity.getMaxMark();
		this.minMark = entity.getMinMark();
	}

	public DegreeStudent toEntity() {
		DegreeStudent entity = new DegreeStudent();

		entity.setId(id);
		entity.setCode(code);
		entity.setName(name);
		entity.setMinMark(minMark);
		entity.setMaxMark(maxMark);

		return entity;
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

	public String getCode() {
		return code;
	}

	public void setCode(String code) {
		this.code = code;
	}

	public Double getMinMark() {
		return minMark;
	}

	public void setMinMark(Double minMark) {
		this.minMark = minMark;
	}

	public Double getMaxMark() {
		return maxMark;
	}

	public void setMaxMark(Double maxMark) {
		this.maxMark = maxMark;
	}

	public void setName(String name) {
		this.name = name;
	}

	public boolean isDuplicate() {
		return isDuplicate;
	}

	public void setDuplicate(boolean isDuplicate) {
		this.isDuplicate = isDuplicate;
	}

	public String getDupName() {
		return dupName;
	}

	public void setDupName(String dupName) {
		this.dupName = dupName;
	}

	public String getDupCode() {
		return dupCode;
	}

	public void setDupCode(String dupCode) {
		this.dupCode = dupCode;
	}

}
