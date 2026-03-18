package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;


import org.joda.time.LocalDateTime;

import com.globits.richy.domain.Question;
import com.globits.richy.domain.QuestionAnswer;
import com.globits.richy.domain.QuestionTopic;
import com.globits.security.domain.User;
import com.globits.security.dto.UserDto;

public class QuestionForTestsDto implements Serializable  {
	private Long id;
	private String title;
	private String pronounce;
	private int status = 3;
	
	public Long getId() {
		return id;
	}
	public int getStatus() {
		return status;
	}
	public void setStatus(int status) {
		this.status = status;
	}
	public void setId(Long id) {
		this.id = id;
	}
	public String getTitle() {
		return title;
	}
	public void setTitle(String title) {
		this.title = title;
	}
	
	public String getPronounce() {
		return pronounce;
	}
	public void setPronounce(String pronounce) {
		this.pronounce = pronounce;
	}
	public QuestionForTestsDto() {
		super();
	}
	public QuestionForTestsDto(Question domain) {
		this.id = domain.getId();
		this.title = domain.getTitle();
		this.pronounce = domain.getPronounce();
		this.status = domain.getStatus();
	}

}
