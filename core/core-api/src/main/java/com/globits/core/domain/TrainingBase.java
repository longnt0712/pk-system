package com.globits.core.domain;

import javax.persistence.Entity;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import org.hibernate.annotations.Type;
import org.joda.time.LocalDateTime;

import com.globits.core.domain.BaseObject;

@Entity
@Table(name = "tbl_training_base")
@XmlRootElement
public class TrainingBase  extends BaseObject {
	private static final long serialVersionUID = 4439651831766342207L;
	private String code;
	private String name;
	private String description;
	
//	@Type(type = "java.time.LocalDateTime")
//	@DateTimeFormat(iso = ISO.DATE_TIME)
	
	@Type(type="org.jadira.usertype.dateandtime.joda.PersistentLocalDateTime")
	private LocalDateTime testDate;
	
	private String address;
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
	public LocalDateTime getTestDate() {
		return testDate;
	}
	public void setTestDate(LocalDateTime testDate) {
		this.testDate = testDate;
	}

	
}
