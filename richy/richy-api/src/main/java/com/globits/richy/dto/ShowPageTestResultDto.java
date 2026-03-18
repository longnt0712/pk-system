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

public class ShowPageTestResultDto implements Serializable{
	private Long id;
	
	private List<QuestionAnswerTestResultDto> questionAnswerTestResult;
	
	private UserDto user;
	
	private Date testDate;
	private String textSearch;
	private int correctAnswer = 0;
	private double bandScore = 0;
	private String testTime;
	private String testTakerName;
	private String testName;
	private String testTakerPerformance;
	private Integer testType = 0;
	
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
	public ShowPageTestResultDto() {
		
	}
	
	public class sortByOrdinalNumberQuestionAnswerTestResult implements Comparator<QuestionAnswerTestResultDto> {
		public int compare(QuestionAnswerTestResultDto a, QuestionAnswerTestResultDto b)
	    {
	        return a.ordinalNumber - b.ordinalNumber;
	    }
	}
	
	public ShowPageTestResultDto(TestResult domain) {
		this.id = domain.getId();
		this.testDate = domain.getCreateDate().toDate();
		this.testTime = domain.getTestTime();
		this.testTakerName = domain.getTestTakerName();
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
			
			this.questionAnswerTestResult.addAll(ret);
		}
		
		
		
		BandScoreDto dto = new BandScoreDto(this.correctAnswer,this.testType) ; //1 => reading 2 => listening
		if(dto.getBandScoreReading() != null) {
			this.bandScore = dto.getBandScoreReading();
		}
		
	}
	
	public ShowPageTestResultDto(TestResult domain,boolean isGetOne) {
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
	
}
