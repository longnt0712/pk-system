package com.globits.core.dto;

import com.globits.core.domain.Country;
import com.globits.core.domain.Status;

public class StatusDto {

	private Long id;

	private String name;

	private String code;
	
	private boolean isDuplicate;
	private String dupName;
	private String dupCode;


	public StatusDto() {

	}

	public StatusDto(Country entity) {

		if (entity == null) {
			return;
		}

		this.code = entity.getCode();
		this.name = entity.getName();
		this.id = entity.getId();
	}

	public Status toEntity() {
		Status entity = new Status();

		entity.setId(id);
		entity.setCode(code);
		entity.setName(name);

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
