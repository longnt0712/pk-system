package com.globits.core.dto;

import com.globits.core.domain.Location;

public class LocationDto {

	private Long id;

	private String name;

	private String code;

	private double longitude;

	private double latitude;
	
	private boolean isDuplicate;
	private String dupName;
	private String dupCode;

	public LocationDto() {

	}

	public LocationDto(Location entity) {

		if (entity == null) {
			return;
		}

		this.id = entity.getId();
		this.code = entity.getCode();
		this.name = entity.getName();
		this.latitude = entity.getLatitude();
		this.longitude = entity.getLongitude();
	}

	public Location toEntity() {
		Location entity = new Location();

		entity.setId(id);
		entity.setCode(code);
		entity.setName(name);
		entity.setLatitude(latitude);
		entity.setLongitude(longitude);

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

	public double getLongitude() {
		return longitude;
	}

	public void setLongitude(double longitude) {
		this.longitude = longitude;
	}

	public double getLatitude() {
		return latitude;
	}

	public void setLatitude(double latitude) {
		this.latitude = latitude;
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
