package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Set;

import org.joda.time.LocalDateTime;

import com.globits.richy.domain.Answer;
import com.globits.richy.domain.QuestionAnswer;
import com.globits.richy.domain.QuestionAnswerTestResult;
import com.globits.richy.domain.TestResult;
import com.globits.richy.dto.QuestionDto.sortByOrdinalNumberQuestionAnswer;
import com.globits.security.domain.User;
import com.globits.security.dto.UserDto;

public class TestResultDto implements Serializable{
	private Long id;
	
	private List<QuestionAnswerTestResultDto> questionAnswerTestResult;
	
	private UserDto user;
	
	private Date testDate;
	private LocalDateTime startDate;
	private LocalDateTime endDate;
	private String textSearch;
	private String grade; // tạm thời
	private int correctAnswer = 0;
	private double bandScore = 0;
	private String testTime;
	private String testTakerName;
	private String userDisplayName;
	private String testName;
	private String testTakerPerformance;
	private Integer testType = 0; //1: daily vocab 2: test reading 3:listening daily 4: test lisning
	private Integer times = 0;
	private Integer numberOfWords = 0;
	private Integer numberOfRanking = 10;
	
	
	//CHECK CHEATING
	private Integer totalWord = 0;
	private Integer incorrect = 0;
	private Integer totalTime = 0;
	private Integer timeLeft = 0;
	private Integer messageCode = 0; // code 0: chúc mừng thành công; code 1: sai nhiều quá, không thành công
	
	public Integer getTotalWord() {
		return totalWord;
	}
	public void setTotalWord(Integer totalWord) {
		this.totalWord = totalWord;
	}
	public Integer getIncorrect() {
		return incorrect;
	}
	public void setIncorrect(Integer incorrect) {
		this.incorrect = incorrect;
	}
	public Integer getTotalTime() {
		return totalTime;
	}
	public void setTotalTime(Integer totalTime) {
		this.totalTime = totalTime;
	}
	public Integer getTimeLeft() {
		return timeLeft;
	}
	public void setTimeLeft(Integer timeLeft) {
		this.timeLeft = timeLeft;
	}
	
	public Integer getMessageCode() {
		return messageCode;
	}
	public void setMessageCode(Integer messageCode) {
		this.messageCode = messageCode;
	}
	public String getGrade() {
		return grade;
	}
	public void setGrade(String grade) {
		this.grade = grade;
	}
	public Integer getNumberOfRanking() {
		return numberOfRanking;
	}
	public void setNumberOfRanking(Integer numberOfRanking) {
		this.numberOfRanking = numberOfRanking;
	}
	public Integer getNumberOfWords() {
		return numberOfWords;
	}
	public void setNumberOfWords(Integer numberOfWords) {
		this.numberOfWords = numberOfWords;
	}
	
	public Integer getTimes() {
		return times;
	}
	public void setTimes(Integer times) {
		this.times = times;
	}
	public String getUserDisplayName() {
		return userDisplayName;
	}
	public void setUserDisplayName(String userDisplayName) {
		this.userDisplayName = userDisplayName;
	}
	public LocalDateTime getStartDate() {
		return startDate;
	}
	public void setStartDate(LocalDateTime startDate) {
		this.startDate = startDate;
	}
	public LocalDateTime getEndDate() {
		return endDate;
	}
	public void setEndDate(LocalDateTime endDate) {
		this.endDate = endDate;
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
	public double getBandScore() {
		return bandScore;
	}
	public void setBandScore(double bandScore) {
		this.bandScore = bandScore;
	}
	public int getCorrectAnswer() {
		return correctAnswer;
	}
	public void setCorrectAnswer(int correctAnswer) {
		this.correctAnswer = correctAnswer;
	}
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
	public List<QuestionAnswerTestResultDto> getQuestionAnswerTestResult() {
		return questionAnswerTestResult;
	}
	public void setQuestionAnswerTestResult(List<QuestionAnswerTestResultDto> questionAnswerTestResult) {
		this.questionAnswerTestResult = questionAnswerTestResult;
	}
	public UserDto getUser() {
		return user;
	}
	public void setUser(UserDto user) {
		this.user = user;
	}
	public Date getTestDate() {
		return testDate;
	}
	public void setTestDate(Date testDate) {
		this.testDate = testDate;
	}
	public TestResultDto() {
		
	}
	
	public class sortByOrdinalNumberQuestionAnswerTestResult implements Comparator<QuestionAnswerTestResultDto> {
		public int compare(QuestionAnswerTestResultDto a, QuestionAnswerTestResultDto b)
	    {
	        return a.ordinalNumber - b.ordinalNumber;
	    }
	}
	
	public TestResultDto(TestResult domain) {
		this.id = domain.getId();
		this.testDate = domain.getCreateDate().toDate();
		this.testTime = domain.getTestTime();
		this.testTakerName = domain.getTestTakerName();
//		if(domain.getNumberOfWords() == null) {
//			this.numberOfWords = 0;	
//		} else {
		this.numberOfWords = domain.getNumberOfWords();
//		}
		
//		this.testTakerPerformance = domain.getTestTakerPerformance();
		if(domain.getTestType() == null) {
			this.testType = 1;
		}else {
			this.testType = domain.getTestType();
		}
		this.testName = domain.getTestName();
		if(domain.getUser() != null) {
			this.user = new UserDto(domain.getUser());
		}
		if(domain.getQuestionAnswerTestResult() != null && domain.getQuestionAnswerTestResult().size() > 0) {
			this.questionAnswerTestResult = new ArrayList<QuestionAnswerTestResultDto>();
			List<QuestionAnswerTestResultDto> ret = new ArrayList<QuestionAnswerTestResultDto>();
			
			for (QuestionAnswerTestResult item : domain.getQuestionAnswerTestResult()) {
//				if(item.getQuestionAnswer() != null) {
//					if(item.getClientAnswer() == null || item.getClientAnswer().length() > 0) {
//						if(item.getQuestionAnswer().isCorrect()) {
//							correctAnswer += 1;
//						} else if(item.getQuestionAnswer() != null && item.getQuestionAnswer().getAnswer() != null) { //type = 1 or 3 filling gaps
//							
//							String[] parts = (item.getQuestionAnswer().getAnswer().getAnswer()).split("/");
//							
//							if(parts.length > 1) {
//								for(int i = 0; i < parts.length; i++) {
//									if(item.getClientAnswer().toLowerCase().trim().equals(parts[i].toLowerCase().trim())) {
//										correctAnswer += 1;
//										break;
//									}
//								}
//							}else {
//								if(item.getClientAnswer().toLowerCase().trim().equals(item.getQuestionAnswer().getAnswer().getAnswer().toLowerCase().trim())) {
//									correctAnswer += 1;
//								}
//							}
//							
//
//							
//						}
//					} else {
//						if(item.getQuestionAnswer().getAnswer() != null && item.getQuestionAnswer().getAnswer().getAnswer() != null && item.getClientAnswer() != null) {
//							if(item.getQuestionAnswer().getAnswer().getAnswer().equals(item.getClientAnswer()))
//							correctAnswer += 1;
//						}
//					}
//					
//				}
				QuestionAnswerTestResultDto itemDto = new QuestionAnswerTestResultDto(item);
				
				if(itemDto.getIsCorrectTestResultDetail() == true) {
					correctAnswer += 1;
				}
				
				ret.add(new QuestionAnswerTestResultDto(item));
			}
			
			
			Collections.sort(ret, new sortByOrdinalNumberQuestionAnswerTestResult());
			
//			this.questionAnswerTestResult.addAll(ret);
		}
		
		
		
		BandScoreDto dto = new BandScoreDto(this.correctAnswer,this.testType) ; //1 => reading 2 => listening
		if(dto.getBandScoreReading() != null) {
			this.bandScore = dto.getBandScoreReading();
		}
		
	}
	
	public TestResultDto(TestResult domain,boolean isGetOne) {
		this.id = domain.getId();
		this.testDate = domain.getCreateDate().toDate();
		this.testTime = domain.getTestTime();
		this.testTakerName = domain.getTestTakerName();
		if(isGetOne == true) {
			this.testTakerPerformance = domain.getTestTakerPerformance();	
		}
		if(domain.getTestType() == null) {
			this.testType = 1;
		}else {
			this.testType = domain.getTestType();
		}
		this.testName = domain.getTestName();
		if(domain.getUser() != null) {
			this.user = new UserDto(domain.getUser());
			if(domain.getUser().getPerson() != null) {
				this.userDisplayName = domain.getUser().getPerson().getDisplayName();
			}
		}
		if(domain.getQuestionAnswerTestResult() != null && domain.getQuestionAnswerTestResult().size() > 0) {
			this.questionAnswerTestResult = new ArrayList<QuestionAnswerTestResultDto>();
			List<QuestionAnswerTestResultDto> ret = new ArrayList<QuestionAnswerTestResultDto>();
			
			for (QuestionAnswerTestResult item : domain.getQuestionAnswerTestResult()) {
//				if(item.getQuestionAnswer() != null) {
//					if(item.getClientAnswer() == null || item.getClientAnswer().length() > 0) {
//						if(item.getQuestionAnswer().isCorrect()) {
//							correctAnswer += 1;
//						} else if(item.getQuestionAnswer() != null && item.getQuestionAnswer().getAnswer() != null) { //type = 1 or 3 filling gaps
//							
//							String[] parts = (item.getQuestionAnswer().getAnswer().getAnswer()).split("/");
//							
//							if(parts.length > 1) {
//								for(int i = 0; i < parts.length; i++) {
//									if(item.getClientAnswer().toLowerCase().trim().equals(parts[i].toLowerCase().trim())) {
//										correctAnswer += 1;
//										break;
//									}
//								}
//							}else {
//								if(item.getClientAnswer().toLowerCase().trim().equals(item.getQuestionAnswer().getAnswer().getAnswer().toLowerCase().trim())) {
//									correctAnswer += 1;
//								}
//							}
//							
//
//							
//						}
//					} else {
//						if(item.getQuestionAnswer().getAnswer() != null && item.getQuestionAnswer().getAnswer().getAnswer() != null && item.getClientAnswer() != null) {
//							if(item.getQuestionAnswer().getAnswer().getAnswer().equals(item.getClientAnswer()))
//							correctAnswer += 1;
//						}
//					}
//					
//				}
				QuestionAnswerTestResultDto itemDto = new QuestionAnswerTestResultDto(item);
				
				if(itemDto.getIsCorrectTestResultDetail() == true) {
					correctAnswer += 1;
				}
				
				ret.add(new QuestionAnswerTestResultDto(item));
			}
			
			
			Collections.sort(ret, new sortByOrdinalNumberQuestionAnswerTestResult());
			
			this.questionAnswerTestResult.addAll(ret);
		}
		
		
		
		BandScoreDto dto = new BandScoreDto(this.correctAnswer,this.testType) ; //1 => reading 2 => listening
		if(dto.getBandScoreReading() != null) {
			this.bandScore = dto.getBandScoreReading();
		}
		
	}
	
	public boolean checkRestult(TestResultDto dto) {
			
		//sai nhiều hơn 15% => không đạt không lưu result ~ unfinished
		Double a = (double) dto.getNumberOfWords();
		Double b = (double) dto.getTotalWord();
		Double c = (double) (a/b);
		Integer percentIncorrect = (int) (100 - (c)*100);
		if(percentIncorrect > 15) {
//			dto.setMessageCode(1);
			return false;
		}
		
		return true;
	}
	
}
