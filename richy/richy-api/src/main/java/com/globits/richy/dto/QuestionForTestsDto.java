package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;


import com.globits.richy.domain.Question;
import com.globits.richy.domain.QuestionTopic;

public class QuestionForTestsDto implements Serializable  {
	private Long id;
	private String title;
	private String pronounce;
	private String testFormat;
	private boolean hasWritingTask1;
	private boolean hasWritingTask2;
	private List<TopicDto> topics = new ArrayList<TopicDto>();
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
	public String getTestFormat() {
		return testFormat;
	}
	public void setTestFormat(String testFormat) {
		this.testFormat = testFormat;
	}
	public boolean isHasWritingTask1() { return hasWritingTask1; }
	public void setHasWritingTask1(boolean value) { this.hasWritingTask1 = value; }
	public boolean isHasWritingTask2() { return hasWritingTask2; }
	public void setHasWritingTask2(boolean value) { this.hasWritingTask2 = value; }
	public List<TopicDto> getTopics() {
		return topics;
	}
	public void setTopics(List<TopicDto> topics) {
		this.topics = topics;
	}
	public QuestionForTestsDto() {
		super();
	}
	public QuestionForTestsDto(Question domain) {
		this.id = domain.getId();
		this.title = domain.getTitle();
		this.pronounce = domain.getPronounce();
		this.testFormat = domain.getTestFormat();
		this.status = domain.getStatus();
		if (domain.getSubQuestions() != null) {
			for (Question part : domain.getSubQuestions()) {
				if (part == null || part.getSubQuestions() == null) { continue; }
				for (Question questionPackage : part.getSubQuestions()) {
					if (questionPackage == null) { continue; }
					if (questionPackage.getType() == 16) { this.hasWritingTask1 = true; }
					if (questionPackage.getType() == 17) { this.hasWritingTask2 = true; }
				}
			}
		}
		if (domain.getQuestionTopics() != null) {
			for (QuestionTopic link : domain.getQuestionTopics()) {
				if (link != null && link.getTopic() != null) {
					this.topics.add(new TopicDto(link.getTopic()));
				}
			}
		}
	}
	public QuestionForTestsDto(Long id, String title, String pronounce, int status) {
		this.id = id; this.title = title; this.pronounce = pronounce; this.status = status;
	}
	public QuestionForTestsDto(Long id, String title, String pronounce, int status, String testFormat) {
		this.id = id; this.title = title; this.pronounce = pronounce; this.status = status;
		this.testFormat = testFormat;
	}

}
