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

import com.globits.core.domain.BaseObject;
import com.globits.security.domain.User;

@Entity
@Table(name = "tbl_question")
@XmlRootElement
public class Question extends BaseObject{
	@Lob
	@Column(name="question")
	private String question;
	
	@Column(name="ordinal_number")
	@OrderBy("ordinalNumber")
	private Integer ordinalNumber;
	
	@ManyToOne(fetch = FetchType.EAGER)
	@JoinColumn(name="question_type")
	private QuestionType questionType; //actually this is topic
	
	@Lob
	@Column(name="description")
	private String description;
	
	@Lob
	@Column(name="mother_tongue")
	private String motherTongue;
	
	@Column(name="type")
	private int type; //specific types of question such as multiple choices, filling gaps... (used for classifying packages)
	//1: multiple choice question, 2: filling gaps
	
	@Column(name="pronounce")
	private String pronounce;
	
	@Column(name="status")
	private int status;//1:chưa; 2:thuộc; 3: tất cả (no lis); 4: đánh dấu 5: lis//  6: không show test 7: show test
	
	@Column(name="time_reviewed")
	private int timeReviewd;
	
	@Column(name="correct_answer")
	private int correctAnswer;
	
	@Column(name="wrong_answer")
	private int wrongAnswer;
	
	@Column(name="count_words")
	private int countWords;

	@Lob
	@Column(name="examples")
	private String examples;
	
	@Lob
	@Column(name="author")
	private String author;
	
	@Lob
	@Column(name="title")
	private String title;
	
	@OneToMany(mappedBy = "question", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval=true)
	@OrderBy("ordinalNumber")
	private Set<QuestionAnswer> questionAnswers;
	
	@OneToMany(mappedBy = "question", cascade = CascadeType.ALL, fetch = FetchType.EAGER, orphanRemoval=true)
	private Set<QuestionTopic> questionTopics;
	
	@ManyToOne(fetch=FetchType.EAGER)
	@JoinColumn(name="parent_id")
	private Question parent;
	
	@OneToMany(mappedBy = "parent", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval=true)
	private Set<Question> subQuestions;
	
	@ManyToOne(fetch=FetchType.EAGER)
	@JoinColumn(name="user_id")
	private User user;
	
	@Column(name="website")
	private Integer website;//1: church; 1: richy; 2: shop crocs; 5: clothes
	
	public Integer getWebsite() {
		return website;
	}
	public void setWebsite(Integer website) {
		this.website = website;
	}
	public User getUser() {
		return user;
	}
	public void setUser(User user) {
		this.user = user;
	}
	public Set<Question> getSubQuestions() {
		return subQuestions;
	}
	public void setSubQuestions(Set<Question> subQuestions) {
		this.subQuestions = subQuestions;
	}
	public Question getParent() {
		return parent;
	}
	public void setParent(Question parent) {
		this.parent = parent;
	}
	public String getTitle() {
		return title;
	}
	public void setTitle(String title) {
		this.title = title;
	}
	public int getCountWords() {
		return countWords;
	}
	public void setCountWords(int countWords) {
		this.countWords = countWords;
	}
	public String getAuthor() {
		return author;
	}
	public void setAuthor(String author) {
		this.author = author;
	}
	public Set<QuestionTopic> getQuestionTopics() {
		return questionTopics;
	}
	public void setQuestionTopics(Set<QuestionTopic> questionTopics) {
		this.questionTopics = questionTopics;
	}
	public int getTimeReviewd() {
		return timeReviewd;
	}
	public void setTimeReviewd(int timeReviewd) {
		this.timeReviewd = timeReviewd;
	}
	public String getMotherTongue() {
		return motherTongue;
	}
	public void setMotherTongue(String motherTongue) {
		this.motherTongue = motherTongue;
	}
	public int getCorrectAnswer() {
		return correctAnswer;
	}
	public void setCorrectAnswer(int correctAnswer) {
		this.correctAnswer = correctAnswer;
	}
	public int getWrongAnswer() {
		return wrongAnswer;
	}
	public void setWrongAnswer(int wrongAnswer) {
		this.wrongAnswer = wrongAnswer;
	}
	public String getExamples() {
		return examples;
	}
	public void setExamples(String examples) {
		this.examples = examples;
	}
	public int getType() {
		return type;
	}
	public void setType(int type) {
		this.type = type;
	}
	
	public int getStatus() {
		return status;
	}
	public void setStatus(int status) {
		this.status = status;
	}
	
	public String getPronounce() {
		return pronounce;
	}
	public void setPronounce(String pronounce) {
		this.pronounce = pronounce;
	}
	public String getDescription() {
		return description;
	}
	public void setDescription(String description) {
		this.description = description;
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
	public QuestionType getQuestionType() {
		return questionType;
	}
	public void setQuestionType(QuestionType questionType) {
		this.questionType = questionType;
	}
	public Set<QuestionAnswer> getQuestionAnswers() {
		return questionAnswers;
	}
	public void setQuestionAnswers(Set<QuestionAnswer> questionAnswers) {
		this.questionAnswers = questionAnswers;
	}
	
}
