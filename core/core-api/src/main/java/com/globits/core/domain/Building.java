package com.globits.core.domain;

import javax.persistence.CascadeType;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

@Entity
@Table(name = "tbl_building")
@XmlRootElement
public class Building extends BaseObject {
	private static final long serialVersionUID = 8191591866881769867L;
	@Column(name = "name")
	private String name;
	@Column(name = "code")
	private String code;
	private Location location;
	
	@ManyToOne(fetch = FetchType.EAGER, cascade = CascadeType.ALL)
	@JoinColumn(name = "training_base_id", nullable = true)
	private TrainingBase trainingBase;

	@ManyToOne
	@JoinColumn(name="organization_id")
	private Organization organization;
	
	
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

	public Location getLocation() {
		return location;
	}

	public void setLocation(Location location) {
		this.location = location;
	}



	public TrainingBase getTrainingBase() {
		return trainingBase;
	}

	public void setTrainingBase(TrainingBase trainingBase) {
		this.trainingBase = trainingBase;
	}
	public Organization getOrganization() {
		return organization;
	}
	public void setOrganization(Organization organization) {
		this.organization = organization;
	}
	public Building() {

	}

	public Building(Building building) {
		this.code = building.getCode();
		this.name = building.getName();
		this.location = building.getLocation();
	}

}
