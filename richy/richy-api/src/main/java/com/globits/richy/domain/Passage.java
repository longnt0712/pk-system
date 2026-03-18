package com.globits.richy.domain;

import javax.persistence.Basic;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.JoinColumn;
import javax.persistence.Lob;
import javax.persistence.ManyToOne;
import javax.persistence.OrderBy;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import com.globits.core.domain.BaseObject;
import com.globits.core.domain.Organization;

@Entity
@Table(name = "tbl_passage")
@XmlRootElement
public class Passage extends BaseObject{
	
	@Lob
	@Column(name="heading")
	private String heading;
	
	@Lob
	@Column(name="content")
	private String content;
	
	@Basic(fetch = FetchType.LAZY)
	@Column(name = "photo", nullable = true, columnDefinition = "LONGBLOB NULL")
//	@Column(name = "photo", nullable = true,length=5242880)//Kích thước tối đa 5M, có thể để kích thước lớn hơn
	private byte[] photo;
	
	@Lob
	@Column(name="video_url")
	private String videoUrl;
	
	@Lob
	@Column(name="description")
	private String description;
	
	@ManyToOne
	@JoinColumn(name="article")
	private Article article;
	
	@Column(name="ordinal_number")
	@OrderBy("ordinalNumber")
	private Integer ordinalNumber;

	public String getContent() {
		return content;
	}

	public void setContent(String content) {
		this.content = content;
	}

	public String getHeading() {
		return heading;
	}

	public void setHeading(String heading) {
		this.heading = heading;
	}

	public byte[] getPhoto() {
		return photo;
	}

	public void setPhoto(byte[] photo) {
		this.photo = photo;
	}

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}

	public Article getArticle() {
		return article;
	}

	public void setArticle(Article article) {
		this.article = article;
	}

	public Integer getOrdinalNumber() {
		return ordinalNumber;
	}

	public void setOrdinalNumber(Integer ordinalNumber) {
		this.ordinalNumber = ordinalNumber;
	}

	
	
}
