package com.globits.core.domain;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

@Entity
@Table(name = "tbl_status")
@XmlRootElement
public class Status extends BaseObject {

	private static final long serialVersionUID = -2208752009903206352L;
	@Column(name = "name")
	private String name;
	@Column(name = "code")
	private String code;

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

	public Status() {

	}

	public Status(Status status) {
		super(status);
		this.name = status.getName();
		this.code = status.getCode();
	}
}
