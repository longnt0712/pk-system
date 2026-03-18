package com.globits.core.dto;

import com.globits.core.domain.Room;

public class RoomDto {

	private Long id;

	private String name;

	private String code;

	private Integer capacity;

	private BuildingDto building;
	
	private boolean isDuplicate;
	private String dupName;
	private String dupCode;

	public RoomDto() {

	}

	public RoomDto(Room entity) {

		if (entity == null) {
			return;
		}

		if (entity.getBuilding() != null) {
			this.building = new BuildingDto(entity.getBuilding());
		}

		this.id = entity.getId();
		this.capacity = entity.getCapacity();
		this.code = entity.getCode();
		this.name = entity.getName();
	}

	public Room toEntity() {
		Room entity = new Room();

		entity.setId(id);
		entity.setName(name);
		entity.setCode(code);
		entity.setCapacity(capacity);

		if (building != null) {
			entity.setBuilding(building.toEntity());
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

	public void setName(String name) {
		this.name = name;
	}

	public String getCode() {
		return code;
	}

	public void setCode(String code) {
		this.code = code;
	}

	public Integer getCapacity() {
		return capacity;
	}

	public void setCapacity(Integer capacity) {
		this.capacity = capacity;
	}

	public BuildingDto getBuilding() {
		return building;
	}

	public void setBuilding(BuildingDto building) {
		this.building = building;
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
