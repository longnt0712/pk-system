package com.globits.core.dto;

import com.globits.core.domain.Country;

public class CountryDto {

	private Long id;

	private String name;

	private String code;

	private String description;
	
	private boolean isDuplicate;
	private String dupName;
	private String dupCode;

	public CountryDto() {

	}

	public CountryDto(Country c) {
		this.code = c.getCode();
		this.name = c.getName();
		this.description = c.getDescription();
		this.id = c.getId();
	}

	public Country toEntity() {
		Country entity = new Country();

		entity.setId(id);
		entity.setName(name);
		entity.setCode(code);
		entity.setDescription(description);

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

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
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
