package com.globits.richy.domain;

import javax.persistence.Entity;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import com.globits.core.domain.BaseObject;

@Entity
@Table(name = "tbl_question_topic")
@XmlRootElement
public class QuestionTopic extends BaseObject{
	@ManyToOne
	@JoinColumn(name="question")
	private Question question;
	
	@ManyToOne
	@JoinColumn(name="topic")
	private Topic topic;

	public Question getQuestion() {
		return question;
	 }

	public void setQuestion(Question question) {
		this.question = question;
	}

	public Topic getTopic() {
		return topic;
	}

	public void setTopic(Topic topic) {
		this.topic = topic;
	}
	
	
}
