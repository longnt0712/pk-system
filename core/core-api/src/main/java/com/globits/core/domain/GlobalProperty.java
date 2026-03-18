package com.globits.core.domain;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import com.globits.core.auditing.AuditableEntity;

@Entity
@Table(name = "tbl_global_property")
@XmlRootElement

public class GlobalProperty extends AuditableEntity {
	private static final long serialVersionUID = 8191591866881769867L;

	@Id
	@Column(name = "property", nullable = false)
	private String property;

	@Column(name = "property_name")
	private String propertyName;
	@Column(name = "property_value")
	private String propertyValue;
	@Column(name = "description")
	private String description;
	
	@Column(name = "data_type_name")
	private String dataTypeName;
	
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

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}

	public String getDataTypeName() {
		return dataTypeName;
	}

	public void setDataTypeName(String dataTypeName) {
		this.dataTypeName = dataTypeName;
	}

	public GlobalProperty() {

	}

	public GlobalProperty(GlobalProperty globalProperty) {
		this.property = globalProperty.getProperty();
		this.propertyName = globalProperty.getPropertyName();
		this.propertyValue = globalProperty.getPropertyValue();
		this.description = globalProperty.getDescription();
	}
}
