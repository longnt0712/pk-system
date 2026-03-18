package com.globits.core.dto;

import com.globits.core.domain.GlobalProperty;

public class GlobalPropertyDto {

	private String property;

	private String propertyName;

	private String propertyValue;

	private String description;

	public GlobalPropertyDto() {

	}

	public GlobalPropertyDto(GlobalProperty entity) {

		if (entity == null) {
			return;
		}

		this.description = entity.getDescription();
		this.property = entity.getProperty();
		this.propertyName = entity.getPropertyName();
		this.propertyValue = entity.getPropertyValue();
	}

	public GlobalProperty toEntity() {
		GlobalProperty entity = new GlobalProperty();

		entity.setProperty(property);
		entity.setPropertyName(propertyName);
		entity.setPropertyValue(propertyValue);
		entity.setDescription(description);

		return entity;
	}

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}

	public String getProperty() {
		return property;
	}

	public void setProperty(String property) {
		this.property = property;
	}

	public String getPropertyName() {
		return propertyName;
	}

	public void setPropertyName(String propertyName) {
		this.propertyName = propertyName;
	}

	public String getPropertyValue() {
		return propertyValue;
	}

	public void setPropertyValue(String propertyValue) {
		this.propertyValue = propertyValue;
	}

}
