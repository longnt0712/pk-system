package com.globits.richy.domain;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import com.globits.core.domain.BaseObject;
import com.globits.core.domain.Organization;

@Entity
@Table(name = "tbl_body")
@XmlRootElement
public class Body extends BaseObject{
	@Column(name="text")
	private String text;
	@Column(name="raw_text")
	private String rawText;
	@ManyToOne
	@JoinColumn(name="category")
	private Category category;
	public String getText() {
		return text;
	}
	public void setText(String text) {
		this.text = text;
	}
	public String getRawText() {
		return rawText;
	}
	public void setRawText(String rawText) {
		this.rawText = rawText;
	}
	public Category getCategory() {
		return category;
	}
	public void setCategory(Category category) {
		this.category = category;
	}
}
