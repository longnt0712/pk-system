package com.globits.richy.domain;

import java.util.Date;
import java.util.Set;

import javax.persistence.CascadeType;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.JoinColumn;
import javax.persistence.Lob;
import javax.persistence.ManyToOne;
import javax.persistence.OneToMany;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import com.globits.core.domain.BaseObject;
import com.globits.core.domain.Organization;
import com.globits.security.domain.User;

@Entity
@Table(name = "tbl_topic")
@XmlRootElement
public class Topic extends BaseObject{
	@Column(name="name")
	private String name;
	
	@ManyToOne(fetch = FetchType.EAGER, optional = true)
	@JoinColumn(name = "user_id")
	private User user;
	
	@Lob
	@Column(name="content")
	private String content;
	
	@Lob
	@Column(name="content_html")
	private String contentHtml;
	
	@Column(name="website")
	private Integer website;//1: church; 1: richy; 2: shop crocs; 5: clothes
	
	public String getContentHtml() {
		return contentHtml;
	}

	public void setContentHtml(String contentHtml) {
		this.contentHtml = contentHtml;
	}

	public Integer getWebsite() {
		return website;
	}

	public String getContent() {
		return content;
	}

	public void setContent(String content) {
		this.content = content;
	}

	public void setWebsite(Integer website) {
		this.website = website;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public User getUser() {
		return user;
	}

	public void setUser(User user) {
		this.user = user;
	}

}
