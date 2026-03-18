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

public class QuestionOnlyQuestionDto implements Serializable  {
	private Long id;
	private String question;
	
	public Long getId() {
		return id;
	}
	public void setId(Long id) {
		this.id = id;
	}
	public String getQuestion() {
		return question;
	}
	public void setQuestion(String question) {
		this.question = question;
	}
	public QuestionOnlyQuestionDto() {
		super();
	}
	public QuestionOnlyQuestionDto(Question domain) {
		this.id = domain.getId();
		this.question = domain.getQuestion();
		
	}


}
