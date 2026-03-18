package com.globits.core.dto;

import com.globits.core.domain.Ethnics;

public class EthnicsDto {

	private Long id;
	
	private String name;
	
	private String code;
	
	private String description;
	
	private boolean isDuplicate;
	private String dupName;
	private String dupCode;

	public EthnicsDto() {

	}

	public EthnicsDto(Ethnics eth) {
		this.id = eth.getId();
		this.code = eth.getCode();
		this.name = eth.getName();
		this.description = eth.getDescription();
	}

	public Ethnics toEntity() {
		Ethnics entity = new Ethnics();

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
