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

public class QuizDto implements Serializable  {
	private Long id;
	private String question;
	private Integer ordinalNumber;
	private QuestionTypeDto questionType;
	private List<QuestionAnswerDto> questionAnswers;
	private List<QuestionTopicDto> questionTopics;
	private String textSearch;
	
	private String answerText;
	private boolean result;
	private String wrongText;
	private String correctText;
	private String description;
	private int type = 1;//1: flash_card
	private String pronounce;
	private int status = 1;//1: chưa thuộc; 2: đã thuộc
	private String examples;
	
	private int timeReviewd = 0;
	
	private int correctAnswer = 0;
	
	private int wrongAnswer = 0;
	
	private int upper = 0;
	private int lower = 3;
	
	private LocalDateTime createDate;
	private LocalDateTime modifiedDate;
	
	private int flashCardMode = 0;
	private String author;
	private int countWords = 0;
	private String title;
	private QuizDto parent;
	private boolean showChildren = false;
	
	private List<QuizDto> subQuestions;
	
	private boolean isAnswered = false;
	private boolean isNeedReview = false;
	
	private String motherTongue;
	private String username;
	private boolean showDetail = false;
	
	private UserDto user;
	
	private Long userId; 
	
	//for quiz
	private List<QuestionDto> questions = new ArrayList<QuestionDto>(); 
	private int numberOfAnswers = 4;
	private String note;
	
	public List<QuestionDto> getQuestions() {
		return questions;
	}
	public void setQuestions(List<QuestionDto> questions) {
		this.questions = questions;
	}
	public int getNumberOfAnswers() {
		return numberOfAnswers;
	}
	public void setNumberOfAnswers(int numberOfAnswers) {
		this.numberOfAnswers = numberOfAnswers;
	}
	public String getNote() {
		return note;
	}
	public void setNote(String note) {
		this.note = note;
	}
	public Long getUserId() {
		return userId;
	}
	public void setUserId(Long userId) {
		this.userId = userId;
	}
	public UserDto getUser() {
		return user;
	}
	public void setUser(UserDto user) {
		this.user = user;
	}
	public boolean isShowDetail() {
		return showDetail;
	}
	public void setShowDetail(boolean showDetail) {
		this.showDetail = showDetail;
	}
	public String getUsername() {
		return username;
	}
	public void setUsername(String username) {
		this.username = username;
	}
	public String getMotherTongue() {
		return motherTongue;
	}
	public void setMotherTongue(String motherTongue) {
		this.motherTongue = motherTongue;
	}
	public boolean isAnswered() {
		return isAnswered;
	}
	public void setAnswered(boolean isAnswered) {
		this.isAnswered = isAnswered;
	}
	public boolean isNeedReview() {
		return isNeedReview;
	}
	public void setNeedReview(boolean isNeedReview) {
		this.isNeedReview = isNeedReview;
	}
	public boolean isShowChildren() {
		return showChildren;
	}
	public void setShowChildren(boolean showChildren) {
		this.showChildren = showChildren;
	}
	public List<QuizDto> getSubQuestions() {
		return subQuestions;
	}
	public void setSubQuestions(List<QuizDto> subQuestions) {
		this.subQuestions = subQuestions;
	}
	
	public QuizDto getParent() {
		return parent;
	}
	public void setParent(QuizDto parent) {
		this.parent = parent;
	}
	public LocalDateTime getModifiedDate() {
		return modifiedDate;
	}
	public void setModifiedDate(LocalDateTime modifiedDate) {
		this.modifiedDate = modifiedDate;
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
	public int getFlashCardMode() {
		return flashCardMode;
	}
	public void setFlashCardMode(int flashCardMode) {
		this.flashCardMode = flashCardMode;
	}
	public int getUpper() {
		return upper;
	}
	public void setUpper(int upper) {
		this.upper = upper;
	}
	public int getLower() {
		return lower;
	}
	public void setLower(int lower) {
		this.lower = lower;
	}
	public int getTimeReviewd() {
		return timeReviewd;
	}
	public void setTimeReviewd(int timeReviewd) {
		this.timeReviewd = timeReviewd;
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
	public int getStatus() {
		return status;
	}
	public void setStatus(int status) {
		this.status = status;
	}
	public String getDescription() {
		return description;
	}
	public void setDescription(String description) {
		this.description = description;
	}
	
	public String getPronounce() {
		return pronounce;
	}
	public void setPronounce(String pronounce) {
		this.pronounce = pronounce;
	}
	public int getType() {
		return type;
	}
	public void setType(int type) {
		this.type = type;
	}
	public Long getId() {
		return id;
	}
	public void setId(Long id) {
		this.id = id;
	}
	public String getCorrectText() {
		return correctText;
	}
	public void setCorrectText(String correctText) {
		this.correctText = correctText;
	}
	public String getWrongText() {
		return wrongText;
	}
	public void setWrongText(String wrongText) {
		this.wrongText = wrongText;
	}
	public boolean isResult() {
		return result;
	}
	public void setResult(boolean result) {
		this.result = result;
	}
	public String getAnswerText() {
		return answerText;
	}
	public void setAnswerText(String answerText) {
		this.answerText = answerText;
	}
	public String getTextSearch() {
		return textSearch;
	}
	public void setTextSearch(String textSearch) {
		this.textSearch = textSearch;
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
	public QuestionTypeDto getQuestionType() {
		return questionType;
	}
	public void setQuestionType(QuestionTypeDto questionType) {
		this.questionType = questionType;
	}
	public List<QuestionAnswerDto> getQuestionAnswers() {
		return questionAnswers;
	}
	public void setQuestionAnswers(List<QuestionAnswerDto> questionAnswers) {
		this.questionAnswers = questionAnswers;
	}
	public String getExamples() {
		return examples;
	}
	public void setExamples(String examples) {
		this.examples = examples;
	}
	public List<QuestionTopicDto> getQuestionTopics() {
		return questionTopics;
	}
	public void setQuestionTopics(List<QuestionTopicDto> questionTopics) {
		this.questionTopics = questionTopics;
	}
	
	public LocalDateTime getCreateDate() {
		return createDate;
	}
	public void setCreateDate(LocalDateTime createDate) {
		this.createDate = createDate;
	}
	public QuizDto() {
		super();
	}
	public QuizDto(Question domain) {
		this.id = domain.getId();
		this.question = domain.getQuestion();
		this.ordinalNumber = domain.getOrdinalNumber();
		this.type = domain.getType();
		this.description = domain.getDescription();
		this.pronounce = domain.getPronounce();
		this.status = domain.getStatus();
		this.examples = domain.getExamples();
		this.timeReviewd = domain.getTimeReviewd();
		this.correctAnswer = domain.getCorrectAnswer();
		this.wrongAnswer = domain.getWrongAnswer();
		this.createDate = domain.getCreateDate();
		this.countWords = domain.getCountWords();
		this.author = domain.getAuthor();
		this.title = domain.getTitle();
		this.modifiedDate = domain.getModifyDate();
		this.motherTongue = domain.getMotherTongue();
		if(domain.getUser() != null && domain.getUser().getId() != null) {
			this.user = new UserDto();
			this.user.setId(domain.getUser().getId());
		}
		if(domain.getParent() != null && domain.getParent().getId() != null) {
			this.parent = new QuizDto();
			this.parent.setId(domain.getParent().getId());
			this.parent.setQuestion(domain.getParent().getQuestion());
//			dto.setTitle(domain.getTitle());
//			dto.setAuthor(domain.getAuthor());
//			dto.setDescription(domain.getDescription());
//			dto.setPronounce(domain.getPronounce());
//			dto.setStatus(domain.getStatus());
			this.parent.setType(domain.getParent().getType());
//			dto.setOrdinalNumber(domain.getOrdinalNumber());
			if(domain.getParent().getQuestionType() != null && domain.getParent().getQuestionType().getId() != null) {
				this.parent.setQuestionType(new QuestionTypeDto(domain.getParent().getQuestionType()));
			}
			this.parent.setQuestionType(questionType);
//			this.parent.setParent(dto);
		}
		
		if(domain.getQuestionType() != null) {
			this.questionType = new QuestionTypeDto(domain.getQuestionType());
		}
//		if(domain.getSubQuestions()!=null && domain.getSubQuestions().size()>0) {
//			ArrayList<QuestionDto> subQuestions =new ArrayList<QuestionDto>();
//			for(Question q: domain.getSubQuestions()) {
//				QuestionDto sDto = new QuestionDto();
//				sDto.setDescription(q.getDescription());
//				sDto.setId(q.getId());
//				sDto.setQuestion(q.getQuestion());
//				sDto.setTitle(q.getTitle());
//				sDto.setOrdinalNumber(q.getOrdinalNumber());
//				if(q.getQuestionType() != null && q.getQuestionType().getId() != null) {
//					sDto.setQuestionType(new QuestionTypeDto(q.getQuestionType()));
//				}
//				
//				if(q.getQuestionAnswers() != null && q.getQuestionAnswers().size() > 0) {
//					sDto.setQuestionAnswers(new ArrayList<QuestionAnswerDto>());
//					List<QuestionAnswerDto> ret = new ArrayList<QuestionAnswerDto>();
//					for (QuestionAnswer item : q.getQuestionAnswers()) {
//						ret.add(new QuestionAnswerDto(item));
//					}
//					sDto.getQuestionAnswers().addAll(ret);
//					
//				}
//				subQuestions.add(sDto);
//				Collections.sort(subQuestions, new sortByOrdinalNumber());
//			}
//			this.setSubQuestions(subQuestions);
//		}
		this.setSubQuestions(setListSubQuestions(domain));
		
		
		
		
		if(domain.getQuestionAnswers() != null && domain.getQuestionAnswers().size() > 0) {
			this.questionAnswers = new ArrayList<QuestionAnswerDto>();
			List<QuestionAnswerDto> ret = new ArrayList<QuestionAnswerDto>();
			for (QuestionAnswer item : domain.getQuestionAnswers()) {
				ret.add(new QuestionAnswerDto(item));
			}
			
			QuestionAnswerDto qad = new QuestionAnswerDto();
			
			Collections.sort(ret, new sortByOrdinalNumberQuestionAnswer());
			
			this.questionAnswers.addAll(ret);
		}
		if(domain.getQuestionTopics() != null && domain.getQuestionTopics().size() > 0) {
			this.questionTopics = new ArrayList<QuestionTopicDto>();
			List<QuestionTopicDto> ret = new ArrayList<QuestionTopicDto>();
			for (QuestionTopic item : domain.getQuestionTopics()) {
				ret.add(new QuestionTopicDto(item));
			}
			this.questionTopics.addAll(ret);
		}
		
	}

	public class sortByOrdinalNumber implements Comparator<QuizDto> {
		public int compare(QuizDto a, QuizDto b)
	    {
			if(a.ordinalNumber != null && b.ordinalNumber != null)
	        return a.ordinalNumber - b.ordinalNumber;
			else return 0;
	    }
	}
	
	public class sortByOrdinalNumberQuestionAnswer implements Comparator<QuestionAnswerDto> {
		public int compare(QuestionAnswerDto a, QuestionAnswerDto b)
	    {
	        return a.ordinalNumberQuestionAnswer - b.ordinalNumberQuestionAnswer;
	    }
	}
	
	public ArrayList<QuizDto> setListSubQuestions(Question domain) {
		if(domain.getSubQuestions()!=null && domain.getSubQuestions().size()>0) {
			ArrayList<QuizDto> subQuestions =new ArrayList<QuizDto>();
			for(Question q: domain.getSubQuestions()) {
				QuizDto sDto = new QuizDto();
				sDto.setDescription(q.getDescription());
				sDto.setId(q.getId());
				sDto.setQuestion(q.getQuestion());
				sDto.setTitle(q.getTitle());
				sDto.setOrdinalNumber(q.getOrdinalNumber());
				if(q.getQuestionType() != null && q.getQuestionType().getId() != null) {
					sDto.setQuestionType(new QuestionTypeDto(q.getQuestionType()));
				}
				
				sDto.setType(q.getType());
				
				if(q.getParent() != null) {
					QuizDto d = new QuizDto();
					d.setId(q.getParent().getId());
					d.setQuestion(q.getParent().getQuestion());
					d.setType(q.getParent().getType());
					
					if(q.getParent().getQuestionType() != null && q.getParent().getQuestionType().getId() != null) {
						d.setQuestionType(new QuestionTypeDto(q.getParent().getQuestionType()));
					}
					
					sDto.setParent(d);
				}
				
				if(q.getQuestionAnswers() != null && q.getQuestionAnswers().size() > 0) {
					sDto.setQuestionAnswers(new ArrayList<QuestionAnswerDto>());
					List<QuestionAnswerDto> ret = new ArrayList<QuestionAnswerDto>();
					for (QuestionAnswer item : q.getQuestionAnswers()) {
						ret.add(new QuestionAnswerDto(item));
					}
					sDto.getQuestionAnswers().addAll(ret);
					
				}
				
				
				
				sDto.setSubQuestions(setListSubQuestions(q));
				
				subQuestions.add(sDto);
				Collections.sort(subQuestions, new sortByOrdinalNumber());			
			}
			
			return subQuestions;
		}
		return null;
	}
}
