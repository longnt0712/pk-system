package com.globits.richy.dto;

import java.io.Serializable;

import com.globits.richy.domain.QuestionAnswer;
import com.globits.richy.domain.QuestionTopic;


public class QuestionTopicDto implements Serializable{
	private Long id;
	private QuestionDto question;
	private TopicDto topic;
	private String textSearch;
	public String getTextSearch() {
		return textSearch;
	}
	public void setTextSearch(String textSearch) {
		this.textSearch = textSearch;
	}
	public Long getId() {
		return id;
	}
	public void setId(Long id) {
		this.id = id;
	}
	public QuestionDto getQuestion() {
		return question;
	}
	public void setQuestion(QuestionDto question) {
		this.question = question;
	}

	public TopicDto getTopic() {
		return topic;
	}
	public void setTopic(TopicDto topic) {
		this.topic = topic;
	}
	public QuestionTopicDto() {
		
	}
	
	public QuestionTopicDto(QuestionTopic domain) {
		this.id = domain.getId();
		if(domain.getQuestion() != null) {
			this.question = new QuestionDto();
			this.question.setId(domain.getQuestion().getId());
		}
		if(domain.getTopic() != null) {
			this.topic = new TopicDto(domain.getTopic());
		}
	}
	
}
