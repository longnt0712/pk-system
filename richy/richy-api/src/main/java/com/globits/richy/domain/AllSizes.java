package com.globits.richy.domain;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Lob;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import com.globits.core.domain.BaseObject;

@Entity
@Table(name = "tbl_all_sizes")
@XmlRootElement
public class AllSizes extends BaseObject{
	@Lob
	@Column(name="size_vn")
	private String sizeVn;
	
	@Column(name="website")
	private Integer website;//1: church; 1: richy; 2: shop crocs; 5: clothes
	
	@Column(name="important")
	private Integer important;//1: church; 1: richy; 2: shop crocs; 5: clothes

	public Integer getImportant() {
		return important;
	}

	public void setImportant(Integer important) {
		this.important = important;
	}

	public Integer getWebsite() {
		return website;
	}

	public void setWebsite(Integer website) {
		this.website = website;
	}

	public String getSizeVn() {
		return sizeVn;
	}

	public void setSizeVn(String sizeVn) {
		this.sizeVn = sizeVn;
	}

	
}
