package com.globits.richy.domain;

import java.util.Set;

import javax.persistence.CascadeType;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.OneToMany;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import com.globits.core.domain.BaseObject;

@Entity
@Table(name = "tbl_category")
@XmlRootElement
public class Category extends BaseObject{
	@Column(name="name")
	private String name;
	@Column(name="code")
	private String code;
	@Column(name="ordinal_category")
	private Integer ordinalCategory;//quy tắc
	
	@ManyToOne
	@JoinColumn(name="parent")
	private Category parent;
	
	@OneToMany(mappedBy = "category", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval=true)
	private Set<CategoryQuestion> categoryQuestions;
	
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
	public Integer getOrdinalCategory() {
		return ordinalCategory;
	}
	public void setOrdinalCategory(Integer ordinalCategory) {
		this.ordinalCategory = ordinalCategory;
	}
	public Category getParent() {
		return parent;
	}
	public void setParent(Category parent) {
		this.parent = parent;
	}
	public Set<CategoryQuestion> getCategoryQuestions() {
		return categoryQuestions;
	}
	public void setCategoryQuestions(Set<CategoryQuestion> categoryQuestions) {
		this.categoryQuestions = categoryQuestions;
	}
	
}
