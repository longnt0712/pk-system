package com.globits.richy.domain;

import javax.persistence.CascadeType;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.JoinColumn;
import javax.persistence.Lob;
import javax.persistence.ManyToOne;
import javax.persistence.OrderBy;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import com.globits.core.domain.BaseObject;
import com.globits.core.domain.Organization;
import com.globits.security.domain.User;

@Entity
@Table(name = "tbl_question_answer_test_result")
@XmlRootElement
public class QuestionAnswerTestResult extends BaseObject{
	@Lob
	@Column(name="client_answer")
	private String clientAnswer;
	
	@ManyToOne
	@JoinColumn(name = "question_answer")
	private QuestionAnswer questionAnswer;
	
	@ManyToOne
	@JoinColumn(name="test_result")
	private TestResult testResult;

	@Column(name="ordinal_number")
	@OrderBy("ordinalNumber")
	private Integer ordinalNumber;
	
	public Integer getOrdinalNumber() {
		return ordinalNumber;
	}

	public void setOrdinalNumber(Integer ordinalNumber) {
		this.ordinalNumber = ordinalNumber;
	}

	public String getClientAnswer() {
		return clientAnswer;
	}

	public void setClientAnswer(String clientAnswer) {
		this.clientAnswer = clientAnswer;
	}

	public QuestionAnswer getQuestionAnswer() {
		return questionAnswer;
	}

	public void setQuestionAnswer(QuestionAnswer questionAnswer) {
		this.questionAnswer = questionAnswer;
	}

	public TestResult getTestResult() {
		return testResult;
	}

	public void setTestResult(TestResult testResult) {
		this.testResult = testResult;
	}
	
	
}
