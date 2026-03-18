package com.globits.core.domain;

import javax.persistence.Entity;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

/*
 * Diện ưu tiên
 */
@Entity
@Table(name = "tbl_social_priority")
@XmlRootElement
public class SocialPriority extends BaseObject {
	private String name;
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
}
