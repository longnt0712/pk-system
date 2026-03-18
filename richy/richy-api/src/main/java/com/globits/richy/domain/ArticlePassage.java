package com.globits.richy.domain;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.OrderBy;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import com.globits.core.domain.BaseObject;

@Entity
@Table(name = "tbl_article_passage")
@XmlRootElement
public class ArticlePassage extends BaseObject{
	
//	@ManyToOne
//	@JoinColumn(name="article")
//	private Article article;
//	
//	@ManyToOne
//	@JoinColumn(name="passage")
//	private Passage passage;
	
	@Column(name="ordinal_number")
	@OrderBy("ordinalNumber")
	private Integer ordinalNumber;

//	public Article getArticle() {
//		return article;
//	}
//
//	public void setArticle(Article article) {
//		this.article = article;
//	}
//
//	public Passage getPassage() {
//		return passage;
//	}
//
//	public void setPassage(Passage passage) {
//		this.passage = passage;
//	}

	public Integer getOrdinalNumber() {
		return ordinalNumber;
	}

	public void setOrdinalNumber(Integer ordinalNumber) {
		this.ordinalNumber = ordinalNumber;
	}
	
	
}
