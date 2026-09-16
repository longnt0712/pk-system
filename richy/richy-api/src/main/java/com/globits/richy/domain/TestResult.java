package com.globits.richy.domain;

import java.util.Set;
import java.util.LinkedHashSet;
import javax.persistence.ManyToMany;
import javax.persistence.JoinTable;

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
    @Column(name="client_attempt_key",length=32)
    private String clientAttemptKey;
    public String getClientAttemptKey(){return clientAttemptKey;}
    public void setClientAttemptKey(String value){clientAttemptKey=value;}
    @Column(name="result_status",length=20)
    private String resultStatus;
    public String getResultStatus(){return resultStatus;}
    public void setResultStatus(String value){resultStatus=value;}
    @Column(name="source_question_id")
    private Long sourceQuestionId;
    @Column(name="completed_part")
    private Integer completedPart;
    @Column(name="assignment_task_id")
    private Long assignmentTaskId;
    @Column(name="ielts_session_mode", length=20)
    private String ieltsSessionMode;
    @Column(name="active_duration_seconds")
    private Integer activeDurationSeconds;
    @Lob
    @Column(name="ielts_learning_state")
    private String ieltsLearningState;
    public Long getSourceQuestionId(){return sourceQuestionId;}
    public void setSourceQuestionId(Long value){sourceQuestionId=value;}
    public Integer getCompletedPart(){return completedPart;}
    public void setCompletedPart(Integer value){completedPart=value;}
    public Long getAssignmentTaskId(){return assignmentTaskId;}
    public void setAssignmentTaskId(Long value){assignmentTaskId=value;}
    public String getIeltsSessionMode(){return ieltsSessionMode;}
    public void setIeltsSessionMode(String value){ieltsSessionMode=value;}
    public Integer getActiveDurationSeconds(){return activeDurationSeconds;}
    public void setActiveDurationSeconds(Integer value){activeDurationSeconds=value;}
    public String getIeltsLearningState(){return ieltsLearningState;}
    public void setIeltsLearningState(String value){ieltsLearningState=value;}

	@ManyToMany(fetch = FetchType.LAZY)
	@JoinTable(name = "tbl_test_result_topic", joinColumns = @JoinColumn(name = "test_result_id"),
			inverseJoinColumns = @JoinColumn(name = "topic_id"))
	@OrderBy("id ASC")
	private Set<Topic> topics = new LinkedHashSet<Topic>();
	public Set<Topic> getTopics() { return topics; }
	public void setTopics(Set<Topic> value) { topics = value; }
	@ManyToMany(fetch = FetchType.LAZY)
	@JoinTable(name = "tbl_test_result_completed_vocab_topic", joinColumns = @JoinColumn(name = "test_result_id"),
			inverseJoinColumns = @JoinColumn(name = "topic_id"))
	private Set<Topic> completedVocabularyTopics = new LinkedHashSet<Topic>();
	public Set<Topic> getCompletedVocabularyTopics() { return completedVocabularyTopics; }
	public void setCompletedVocabularyTopics(Set<Topic> value) { completedVocabularyTopics = value; }
	
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

	/** Số từ của kết quả này đã được cộng vào kinh nghiệm của học sinh. */
	@Column(name="vocabulary_experience_awarded_words", nullable = false)
	private Integer vocabularyExperienceAwardedWords = 0;
	
	@Lob
	@Column(name="test_taker_performance")
	private String testTakerPerformance;

	public Integer getNumberOfWords() {
		return numberOfWords;
	}

	public void setNumberOfWords(Integer numberOfWords) {
		this.numberOfWords = numberOfWords;
	}

	public Integer getVocabularyExperienceAwardedWords() {
		return vocabularyExperienceAwardedWords == null ? 0 : vocabularyExperienceAwardedWords;
	}

	public void setVocabularyExperienceAwardedWords(Integer vocabularyExperienceAwardedWords) {
		this.vocabularyExperienceAwardedWords = vocabularyExperienceAwardedWords == null
				? 0 : vocabularyExperienceAwardedWords;
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
