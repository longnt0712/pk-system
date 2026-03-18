package com.globits.richy.domain;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.OrderBy;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import com.globits.core.domain.BaseObject;

@Entity
@Table(name = "tbl_question_answer")
@XmlRootElement
public class QuestionAnswer extends BaseObject{//Sổ văn bản
	@ManyToOne
	@JoinColumn(name="question")
	private Question question;
	
	@ManyToOne
	@JoinColumn(name="answer")
	private Answer answer;
	
	@Column(name="is_correct")
	private boolean isCorrect = true;
	
	@Column(name="ordinal_number")
	@OrderBy("ordinalNumber")
	private Integer ordinalNumber;

	public Integer getOrdinalNumber() {
		return ordinalNumber;
	}

	public void setOrdinalNumber(Integer ordinalNumber) {
		this.ordinalNumber = ordinalNumber;
	}

	public Question getQuestion() {
		return question;
	 }

	public void setQuestion(Question question) {
		this.question = question;
	}

	public Answer getAnswer() {
		return answer;
	}

	public boolean isCorrect() {
		return isCorrect;
	}

	public void setCorrect(boolean isCorrect) {
		this.isCorrect = isCorrect;
	}

	public void setAnswer(Answer answer) {
		this.answer = answer;
	}
	
	
}
