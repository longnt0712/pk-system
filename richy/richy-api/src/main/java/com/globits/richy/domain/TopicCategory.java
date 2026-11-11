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

@Entity
@Table(name = "tbl_topic_category")
@XmlRootElement
public class TopicCategory extends BaseObject{
	@Lob
	@Column(name="name")
	private String name;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "parent_id")
	private TopicCategory parent;

	@Column(name = "owner_id")
	private Long ownerId;

	public TopicCategory getParent() { return parent; }
	public void setParent(TopicCategory parent) { this.parent = parent; }
	public Long getOwnerId() { return ownerId; }
	public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}
	
	
}
