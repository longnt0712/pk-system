package com.globits.core.dto;

import com.globits.core.domain.TrainingBase;

public class TrainingBaseDto {
	private Long id;
	private String code;
	private String name;
	private String description;
	
	private String address;
	
	private boolean isDuplicate;
	private String dupName;
	private String dupCode;
	public Long getId() {
		return id;
	}
	public void setId(Long id) {
		this.id = id;
	}
	public String getCode() {
		return code;
	}
	public void setCode(String code) {
		this.code = code;
	}
	public String getName() {
		return name;
	}
	public void setName(String name) {
		this.name = name;
	}
	public String getDescription() {
		return description;
	}
	public void setDescription(String description) {
		this.description = description;
	}
	
	public String getAddress() {
		return address;
	}
	public void setAddress(String address) {
		this.address = address;
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
	public TrainingBaseDto() {
		
	}
	public TrainingBaseDto(TrainingBase base) {
		this.code=base.getCode();
		this.description=base.getDescription();
		this.id = base.getId();
		this.name=base.getName();
		this.address=base.getAddress();
	}
}
