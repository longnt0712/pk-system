package com.globits.richy.dto;

import java.io.Serializable;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.List;

import javax.persistence.Basic;
import javax.persistence.Column;
import javax.persistence.FetchType;
import javax.persistence.JoinColumn;
import javax.persistence.Lob;
import javax.persistence.ManyToOne;

import org.joda.time.LocalDateTime;

import com.globits.richy.domain.Article;
import com.globits.richy.domain.Folder;
import com.globits.richy.domain.Passage;
import com.globits.security.domain.User;
import com.globits.security.dto.UserDto;

public class ListArticleForCategoryDto implements Serializable{
	private List<ArticleDto> news = new ArrayList<ArticleDto>();
	private List<ArticleDto> notifications = new ArrayList<ArticleDto>();;
	private List<ArticleDto> bibles = new ArrayList<ArticleDto>();;
	private List<ArticleDto> massSchedules = new ArrayList<ArticleDto>();;
	
	public List<ArticleDto> getNews() {
		return news;
	}
	public void setNews(List<ArticleDto> news) {
		this.news = news;
	}
	public List<ArticleDto> getNotifications() {
		return notifications;
	}
	public void setNotifications(List<ArticleDto> notifications) {
		this.notifications = notifications;
	}
	public List<ArticleDto> getBibles() {
		return bibles;
	}
	public void setBibles(List<ArticleDto> bibles) {
		this.bibles = bibles;
	}
	public List<ArticleDto> getMassSchedules() {
		return massSchedules;
	}
	public void setMassSchedules(List<ArticleDto> massSchedules) {
		this.massSchedules = massSchedules;
	}
	public ListArticleForCategoryDto() {
	}
	public ListArticleForCategoryDto(Article domain) {
		
	}
	
	
}
