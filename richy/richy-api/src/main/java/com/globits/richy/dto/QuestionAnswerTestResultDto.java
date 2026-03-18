package com.globits.richy.dto;

import java.io.Serializable;
import java.util.Comparator;

import com.globits.richy.domain.Question;
import com.globits.richy.domain.QuestionAnswer;
import com.globits.richy.domain.QuestionAnswerTestResult;

public class QuestionAnswerTestResultDto implements Serializable{
	private Long id;
	
	private String clientAnswer;
	
	private QuestionAnswerDto questionAnswer;
	
	private TestResultDto testResult;

	Integer ordinalNumber;
	
	private Boolean isCorrectTestResultDetail = false;
	
	private String correctAnswerForMultipleAnswer = "";
	
	
	
	public String getCorrectAnswerForMultipleAnswer() {
		return correctAnswerForMultipleAnswer;
	}
	public void setCorrectAnswerForMultipleAnswer(String correctAnswerForMultipleAnswer) {
		this.correctAnswerForMultipleAnswer = correctAnswerForMultipleAnswer;
	}
	public Boolean getIsCorrectTestResultDetail() {
		return isCorrectTestResultDetail;
	}
	public void setIsCorrectTestResultDetail(Boolean isCorrectTestResultDetail) {
		this.isCorrectTestResultDetail = isCorrectTestResultDetail;
	}
	public Long getId() {
		return id;
	}
	public void setId(Long id) {
		this.id = id;
	}
	
	public String getClientAnswer() {
		return clientAnswer;
	}
	public void setClientAnswer(String clientAnswer) {
		this.clientAnswer = clientAnswer;
	}
	public QuestionAnswerDto getQuestionAnswer() {
		return questionAnswer;
	}
	public void setQuestionAnswer(QuestionAnswerDto questionAnswer) {
		this.questionAnswer = questionAnswer;
	}
	public TestResultDto getTestResult() {
		return testResult;
	}
	public void setTestResult(TestResultDto testResult) {
		this.testResult = testResult;
	}
	public Integer getOrdinalNumber() {
		return ordinalNumber;
	}
	public void setOrdinalNumber(Integer ordinalNumber) {
		this.ordinalNumber = ordinalNumber;
	}
	public QuestionAnswerTestResultDto() {
		
	}
	public QuestionAnswerTestResultDto(QuestionAnswerTestResult domain) {
		this.id = domain.getId();
		this.clientAnswer = domain.getClientAnswer();
		this.ordinalNumber = domain.getOrdinalNumber();
		if(domain.getQuestionAnswer() != null) {
			this.questionAnswer = new QuestionAnswerDto(domain.getQuestionAnswer());
		}
		
		if(domain.getQuestionAnswer() != null) {
			if(domain.getClientAnswer() == null || domain.getClientAnswer().length() > 0) {
				if(domain.getQuestionAnswer().isCorrect() 
						&& domain.getQuestionAnswer().getQuestion() != null 
						&& domain.getQuestionAnswer().getQuestion().getParent() != null
						&& (domain.getQuestionAnswer().getQuestion().getParent().getType() == 1
							|| domain.getQuestionAnswer().getQuestion().getParent().getType() == 6
							|| domain.getQuestionAnswer().getQuestion().getParent().getType() == 9//type = 1 multiple choice type = 9 maps type = 10 gần như map
							|| domain.getQuestionAnswer().getQuestion().getParent().getType() == 10)) { 
					this.isCorrectTestResultDetail = true;
				} else if(domain.getQuestionAnswer() != null 
						&& domain.getQuestionAnswer().getAnswer() != null
						&& domain.getQuestionAnswer().getQuestion() != null 
						&& domain.getQuestionAnswer().getQuestion().getParent() != null
						&& (domain.getQuestionAnswer().getQuestion().getParent().getType() == 2 
							|| domain.getQuestionAnswer().getQuestion().getParent().getType() == 3)) { //type = 2 or 3 filling gaps
					
					String[] parts = (domain.getQuestionAnswer().getAnswer().getAnswer()).split("/");
					
					if(parts.length > 1) {
						for(int i = 0; i < parts.length; i++) {
							if(domain.getClientAnswer().toLowerCase().trim().equals(parts[i].toLowerCase().trim())) {
								this.isCorrectTestResultDetail = true;
								break;
							}
						}
					}else {
						if(domain.getClientAnswer().toLowerCase().trim().equals(domain.getQuestionAnswer().getAnswer().getAnswer().toLowerCase().trim())) {
							this.isCorrectTestResultDetail = true;
						}
					}
					
				} else if (domain.getQuestionAnswer() != null 
						&& domain.getQuestionAnswer().getAnswer() != null
						&& domain.getQuestionAnswer().getQuestion() != null 
						&& domain.getQuestionAnswer().getQuestion().getParent() != null
						&& (domain.getQuestionAnswer().getQuestion().getParent().getType() == 4
							||domain.getQuestionAnswer().getQuestion().getParent().getType() == 8)) {
					
										
					if(domain.getClientAnswer().equals(domain.getQuestionAnswer().getAnswer().getAnswer())) {
						this.isCorrectTestResultDetail = true;
					}
					
				} else if (domain.getQuestionAnswer() != null 
						&& domain.getQuestionAnswer().getAnswer() != null
						&& domain.getQuestionAnswer().getQuestion() != null 
						&& domain.getQuestionAnswer().getQuestion().getParent() != null
						&& (domain.getQuestionAnswer().getQuestion().getParent().getType() == 5 
							|| domain.getQuestionAnswer().getQuestion().getParent().getType() == 7 )) {
					
					
					for (QuestionAnswer q : domain.getQuestionAnswer().getQuestion().getQuestionAnswers()) {
						if(q.isCorrect() == true) {
							this.correctAnswerForMultipleAnswer += q.getAnswer().getAnswer() + " <br>  <br> ";
						}
					}
					
					if(domain.getQuestionAnswer().isCorrect() == true) {
						this.isCorrectTestResultDetail = true;
					}
					
				}
			} else {
				if(domain.getQuestionAnswer().getAnswer() != null && domain.getQuestionAnswer().getAnswer().getAnswer() != null && domain.getClientAnswer() != null) {
					if(domain.getQuestionAnswer().getAnswer().getAnswer().equals(domain.getClientAnswer()))
					this.isCorrectTestResultDetail = true;
				}
			}
			
		}
		
//		if(domain.getTestResult() != null) {
//			this.testResult = new TestResultDto(domain.getTestResult());
//		}
	}
	
	public class sortByOrdinalNumberQuestionAnswerTestResult implements Comparator<QuestionAnswerTestResultDto> {
		public int compare(QuestionAnswerTestResultDto a, QuestionAnswerTestResultDto b)
	    {
	        return a.ordinalNumber - b.ordinalNumber;
	    }
	}
	
}
