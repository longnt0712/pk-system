package com.globits.core.domain;

import javax.persistence.Entity;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

/*
 * Giai tầng xã hội.
 * Sử dụng trong thành phần xuất thân
 */
@Entity
@Table(name = "tbl_social_class")
@XmlRootElement
public class SocialClass extends BaseObject {
	private static final long serialVersionUID = -5970557349377192415L;
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
