package com.globits.core.domain;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

@Entity
@Table(name = "tbl_discipline")
@XmlRootElement
public class Discipline extends BaseObject {

	private static final long serialVersionUID = -2208752009903206352L;
	@Column(name = "name")
	private String name;
	@Column(name = "code")
	private String code;
	@Column(name = "description")
	private String description;
	@Column(name = "level")
	private Integer level;

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
	
	public Integer getLevel() {
		return level;
	}

	public void setLevel(Integer level) {
		this.level = level;
	}

	public Discipline() {

	}

	public Discipline(Discipline room) {
		super(room);
		this.name = room.getName();
		this.code = room.getCode();
		this.description = room.getDescription();
		this.level=room.getLevel();
	}
}
