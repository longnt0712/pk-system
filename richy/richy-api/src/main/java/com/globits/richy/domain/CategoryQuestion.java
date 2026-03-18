package com.globits.richy.domain;

import javax.persistence.Entity;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import com.globits.core.domain.BaseObject;

@Entity
@Table(name = "tbl_category")
@XmlRootElement
public class CategoryQuestion extends BaseObject{
	@ManyToOne
	@JoinColumn(name="category")
	private Category category;
	
	@ManyToOne
	@JoinColumn(name="question")
	private Question question;

	public Category getCategory() {
		return category;
	}

	public void setCategory(Category category) {
		this.category = category;
	}

	public Question getQuestion() {
		return question;
	}

	public void setQuestion(Question question) {
		this.question = question;
	}
	
}
