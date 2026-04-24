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

public class QuestionForGamesDto implements Serializable  {
	private Long id;
	private String question;
	private Integer ordinalNumber;
	
	private boolean result;
	private String pronounce;
	
	private String motherTongue;
	private Long numberOfWords;
	private List<QuestionForGamesDto> questions = new ArrayList<QuestionForGamesDto>(); 
	private List<QuestionAnswerDto> questionAnswers;
	
	public List<QuestionAnswerDto> getQuestionAnswers() {
	    return questionAnswers;
	}

	public void setQuestionAnswers(List<QuestionAnswerDto> questionAnswers) {
	    this.questionAnswers = questionAnswers;
	}

	
	
	public List<QuestionForGamesDto> getQuestions() {
		return questions;
	}
	public void setQuestions(List<QuestionForGamesDto> questions) {
		this.questions = questions;
	}
	public Long getNumberOfWords() {
		return numberOfWords;
	}
	public void setNumberOfWords(Long numberOfWords) {
		this.numberOfWords = numberOfWords;
	}
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
	public Integer getOrdinalNumber() {
		return ordinalNumber;
	}
	public void setOrdinalNumber(Integer ordinalNumber) {
		this.ordinalNumber = ordinalNumber;
	}
	public boolean isResult() {
		return result;
	}
	public void setResult(boolean result) {
		this.result = result;
	}
	public String getPronounce() {
		return pronounce;
	}
	public void setPronounce(String pronounce) {
		this.pronounce = pronounce;
	}
	public String getMotherTongue() {
		return motherTongue;
	}
	public void setMotherTongue(String motherTongue) {
		this.motherTongue = motherTongue;
	}
	
	public QuestionForGamesDto() {
		super();
	}
	public QuestionForGamesDto(Question domain) {
		this.id = domain.getId();
		this.question = domain.getQuestion();
		this.ordinalNumber = domain.getOrdinalNumber();
		this.pronounce = domain.getPronounce();
		this.motherTongue = domain.getMotherTongue();	
		
		if (domain.getQuestionAnswers() != null && domain.getQuestionAnswers().size() > 0) {
		    this.questionAnswers = new ArrayList<QuestionAnswerDto>();

		    for (QuestionAnswer qa : domain.getQuestionAnswers()) {
		        if (qa != null && qa.getAnswer() != null) {
		            this.questionAnswers.add(new QuestionAnswerDto(qa));
		        }
		    }

		    Collections.sort(this.questionAnswers, new QuestionAnswerDto().new sortByOrdinalNumberQuestionAnswer());
		}
	}	
		
		

	
	
}
