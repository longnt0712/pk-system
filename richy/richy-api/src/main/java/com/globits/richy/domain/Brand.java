package com.globits.richy.domain;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.JoinColumn;
import javax.persistence.Lob;
import javax.persistence.ManyToOne;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import com.globits.core.domain.BaseObject;
import com.globits.core.domain.Organization;

@Entity
@Table(name = "tbl_brand")
@XmlRootElement
public class Brand extends BaseObject{
	@Lob
	@Column(name="name")
	private String name;
	
	@Lob
	@Column(name="code")
	private String code;
	
	@Lob
	@Column(name="url")
	private String url;
	
	@ManyToOne(fetch=FetchType.EAGER)
	@JoinColumn(name="parent_id")
	private Brand parent;
	
	@Lob
	@Column(name="description")
	private String description;
	
	@Column(name="website")
	private Integer website;//1: church; 1: richy; 2: shop crocs; 5: clothes

	public Integer getWebsite() {
		return website;
	}

	public void setWebsite(Integer website) {
		this.website = website;
	}

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
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

	public Brand getParent() {
		return parent;
	}

	public void setParent(Brand parent) {
		this.parent = parent;
	}

	public String getUrl() {
		return url;
	}

	public void setUrl(String url) {
		this.url = url;
	}
	
	
}
