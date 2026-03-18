package com.globits.richy.dto;

import java.io.Serializable;

import com.globits.richy.domain.Article;
import com.globits.richy.domain.Folder;
import com.globits.richy.domain.Passage;

public class PassageDto implements Serializable{
	private Long id;

	private String heading;
	private String content;
	private byte[] photo;
	private String description;
	private ArticleDto article;
	Integer ordinalNumber;

	
	public Long getId() {
		return id;
	}
	public void setId(Long id) {
		this.id = id;
	}
	
	public String getHeading() {
		return heading;
	}
	public void setHeading(String heading) {
		this.heading = heading;
	}
	public String getContent() {
		return content;
	}
	public void setContent(String content) {
		this.content = content;
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
	
	public ArticleDto getArticle() {
		return article;
	}
	public void setArticle(ArticleDto article) {
		this.article = article;
	}
	public Integer getOrdinalNumber() {
		return ordinalNumber;
	}
	public void setOrdinalNumber(Integer ordinalNumber) {
		this.ordinalNumber = ordinalNumber;
	}
	public PassageDto() {
//		private String heading;
//		private String content;
//		private byte[] photo;
//		private String description;
//		private ArticleDto article;
//		private Integer ordinalNumber;

	}
	public PassageDto(Passage domain) {
		this.id = domain.getId();
		this.heading = domain.getHeading();
		this.content = domain.getContent();
		this.photo = domain.getPhoto();
		this.description = domain.getDescription();
		if(domain.getArticle() != null) {
			this.article = new ArticleDto(domain.getArticle());
		}
		
		
	}
	
}
