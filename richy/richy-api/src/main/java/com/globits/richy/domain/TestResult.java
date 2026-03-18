package com.globits.richy.domain;

import java.util.Set;

import javax.persistence.CascadeType;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.JoinColumn;
import javax.persistence.Lob;
import javax.persistence.ManyToOne;
import javax.persistence.OneToMany;
import javax.persistence.OrderBy;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import org.hibernate.annotations.Type;
import org.joda.time.LocalDateTime;

import com.globits.core.domain.BaseObject;
import com.globits.core.domain.Organization;
import com.globits.security.domain.User;

@Entity
@Table(name = "tbl_test_result")
@XmlRootElement
public class TestResult extends BaseObject{
	
	@OneToMany(mappedBy = "testResult", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval=true)
	@OrderBy("ordinalNumber")
	private Set<QuestionAnswerTestResult> questionAnswerTestResult;
	
	@ManyToOne(cascade = CascadeType.ALL, optional = true, fetch = FetchType.LAZY)
	@JoinColumn(name = "user_id", unique = false)
	protected User user;
	
	@Lob
	@Column(name="test_time")
	private String testTime;
	
	@Lob
	@Column(name="test_taker_name")
	private String testTakerName;
	
	@Lob
	@Column(name="test_name")
	private String testName;
	
	@Column(name="test_type")
	private Integer testType;
	
	@Column(name="number_of_words")
	private Integer numberOfWords;
	
	@Lob
	@Column(name="test_taker_performance")
	private String testTakerPerformance;

	public Integer getNumberOfWords() {
		return numberOfWords;
	}

	public void setNumberOfWords(Integer numberOfWords) {
		this.numberOfWords = numberOfWords;
	}

	public String getTestName() {
		return testName;
	}

	public void setTestName(String testName) {
		this.testName = testName;
	}

	public Integer getTestType() {
		return testType;
	}

	public void setTestType(Integer testType) {
		this.testType = testType;
	}

	public String getTestTakerPerformance() {
		return testTakerPerformance;
	}

	public void setTestTakerPerformance(String testTakerPerformance) {
		this.testTakerPerformance = testTakerPerformance;
	}

	public String getTestTakerName() {
		return testTakerName;
	}

	public void setTestTakerName(String testTakerName) {
		this.testTakerName = testTakerName;
	}

	public String getTestTime() {
		return testTime;
	}

	public void setTestTime(String testTime) {
		this.testTime = testTime;
	}

	public Set<QuestionAnswerTestResult> getQuestionAnswerTestResult() {
		return questionAnswerTestResult;
	}

	public void setQuestionAnswerTestResult(Set<QuestionAnswerTestResult> questionAnswerTestResult) {
		this.questionAnswerTestResult = questionAnswerTestResult;
	}

	public User getUser() {
		return user;
	}

	public void setUser(User user) {
		this.user = user;
	}

	
}
