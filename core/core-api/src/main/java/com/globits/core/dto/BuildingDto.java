package com.globits.core.dto;

import com.globits.core.domain.Building;
import com.globits.core.domain.TrainingBase;

public class BuildingDto {

	private Long id;

	private String name;

	private String code;

	private LocationDto location;

	private TrainingBaseDto trainingBase;
	
	private boolean isDuplicate;
	private String dupName;
	private String dupCode;
	
	public BuildingDto() {

	}

	public BuildingDto(Building entity) {

		if (entity == null) {
			return;
		}

		this.id = entity.getId();
		this.code = entity.getCode();
		this.name = entity.getName();

		if (entity.getLocation() != null) {
			this.location = new LocationDto(entity.getLocation());
		}
		if(entity.getTrainingBase()!=null) {
			this.trainingBase =new TrainingBaseDto();
			this.trainingBase.setId(entity.getTrainingBase().getId());
			this.trainingBase.setAddress(entity.getTrainingBase().getAddress());
			this.trainingBase.setCode(entity.getTrainingBase().getCode());
			this.trainingBase.setName(entity.getTrainingBase().getName());
			this.trainingBase.setDescription(entity.getTrainingBase().getDescription());
		}
	}

	public Building toEntity() {
		Building entity = new Building();

		entity.setId(id);
		entity.setCode(code);
		entity.setName(name);

		if (location != null) {
			entity.setLocation(location.toEntity());
		}
		if(this.trainingBase!=null) {
			TrainingBase trainingBase = new TrainingBase();
			
			trainingBase.setId(this.getTrainingBase().getId());
			trainingBase.setAddress(this.getTrainingBase().getAddress());
			trainingBase.setCode(this.getTrainingBase().getCode());
			trainingBase.setName(this.getTrainingBase().getName());
			trainingBase.setDescription(this.getTrainingBase().getDescription());
			
			entity.setTrainingBase(trainingBase);
		}

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

	public LocationDto getLocation() {
		return location;
	}

	public void setLocation(LocationDto location) {
		this.location = location;
	}

	public void setName(String name) {
		this.name = name;
	}

	public TrainingBaseDto getTrainingBase() {
		return trainingBase;
	}

	public void setTrainingBase(TrainingBaseDto trainingBase) {
		this.trainingBase = trainingBase;
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
