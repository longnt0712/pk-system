package com.globits.core.dto;

import com.globits.core.domain.Discipline;

public class DisciplineDto {

	private Long id;

	private String name;

	private String code;

	private String description;
	private Integer level;
	
	private boolean isDuplicate;
	private String dupName;
	private String dupCode;


	public DisciplineDto() {

	}

	public DisciplineDto(Discipline entity) {
		
		if (entity == null) {
			return;
		}
		
		this.id = entity.getId();
		this.code = entity.getCode();
		this.name = entity.getName();
		this.description = entity.getDescription();
		this.level=entity.getLevel();
	}
	
	public Discipline toEntity() {
		Discipline entity = new Discipline();
		
		entity.setId(id);
		entity.setCode(code);
		entity.setName(name);
		entity.setDescription(description);
		entity.setLevel(level);
		
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
	

	public Integer getLevel() {
		return level;
	}

	public void setLevel(Integer level) {
		this.level = level;
	}

	public String getDupCode() {
		return dupCode;
	}

	public void setDupCode(String dupCode) {
		this.dupCode = dupCode;
	}
}
