package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import javax.persistence.CascadeType;
import javax.persistence.Column;
import javax.persistence.FetchType;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.OneToMany;

import com.globits.richy.domain.Answer;
import com.globits.richy.domain.Category;
import com.globits.richy.domain.CategoryQuestion;

public class CategoryDto implements Serializable{
	private Long id;
	private String name;
	private String code;
	private Integer ordinalCategory;//quy tắc
	private CategoryDto parent;
	private List<CategoryQuestionDto> categoryQuestions;
	private String textSearch;
	
	public Long getId() {
		return id;
	}
	public void setId(Long id) {
		this.id = id;
	}
	public String getTextSearch() {
		return textSearch;
	}
	public void setTextSearch(String textSearch) {
		this.textSearch = textSearch;
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
	public Integer getOrdinalCategory() {
		return ordinalCategory;
	}
	public void setOrdinalCategory(Integer ordinalCategory) {
		this.ordinalCategory = ordinalCategory;
	}
	public CategoryDto getParent() {
		return parent;
	}
	public void setParent(CategoryDto parent) {
		this.parent = parent;
	}
	public List<CategoryQuestionDto> getCategoryQuestions() {
		return categoryQuestions;
	}
	public void setCategoryQuestions(List<CategoryQuestionDto> categoryQuestions) {
		this.categoryQuestions = categoryQuestions;
	}
	public CategoryDto() {
		
	}
	public CategoryDto(Category domain) {
		this.id = domain.getId();
		this.name = domain.getName();
		this.code = domain.getCode();
		this.ordinalCategory = domain.getOrdinalCategory();
		
		if(domain.getParent() != null) {
			this.parent = new CategoryDto();
			this.parent.setId(domain.getParent().getId());
			this.parent.setName(domain.getParent().getName());
			this.parent.setCode(domain.getParent().getCode());
			this.parent.setOrdinalCategory(domain.getParent().getOrdinalCategory());
		}
		
		if(domain.getCategoryQuestions() != null && domain.getCategoryQuestions().size() > 0){
			this.categoryQuestions = new ArrayList<CategoryQuestionDto>();
			for (CategoryQuestion item : domain.getCategoryQuestions()) {
				this.categoryQuestions.add(new CategoryQuestionDto(item));
			}
		}
	}
	
}
