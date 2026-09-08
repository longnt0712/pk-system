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
		if(domain == null) {
			return;
		}
		this.id = domain.getId();
		this.clientAnswer = domain.getClientAnswer();
		this.ordinalNumber = domain.getOrdinalNumber();
		if(domain.getQuestionAnswer() != null) {
			this.questionAnswer = new QuestionAnswerDto(domain.getQuestionAnswer());
		}

		QuestionAnswer selectedAnswer = domain.getQuestionAnswer();
		if(selectedAnswer == null || selectedAnswer.getQuestion() == null
				|| selectedAnswer.getQuestion().getParent() == null) {
			return;
		}

		Integer type = selectedAnswer.getQuestion().getParent().getType();
		if(type == null) {
			return;
		}
		String submittedAnswer = normalize(domain.getClientAnswer());
		boolean hasSubmittedAnswer = submittedAnswer.length() > 0;

		// Single-option modes. Matching Information (12) and Complete List of
		// Words (13) use the same persisted QuestionAnswer contract as Matching
		// Names (10), Maps (9), and normal single-choice questions.
		if(type == 1 || type == 6 || type == 9 || type == 10 || type == 12 || type == 13) {
			this.isCorrectTestResultDetail = hasSubmittedAnswer && selectedAnswer.isCorrect();
			return;
		}

		// Filling Gaps New / One Editor (11) is scored exactly like the legacy
		// filling-gap modes, including alternatives separated by '/'.
		if(type == 2 || type == 3 || type == 11) {
			if(hasSubmittedAnswer && selectedAnswer.getAnswer() != null
					&& selectedAnswer.getAnswer().getAnswer() != null) {
				String[] acceptedAnswers = selectedAnswer.getAnswer().getAnswer().split("/");
				for(String acceptedAnswer : acceptedAnswers) {
					if(submittedAnswer.equalsIgnoreCase(normalize(acceptedAnswer))) {
						this.isCorrectTestResultDetail = true;
						break;
					}
				}
			}
			return;
		}

		if(type == 4 || type == 8) {
			this.isCorrectTestResultDetail = hasSubmittedAnswer
					&& selectedAnswer.getAnswer() != null
					&& submittedAnswer.equals(normalize(selectedAnswer.getAnswer().getAnswer()));
			return;
		}

		if(type == 5 || type == 7) {
			if(selectedAnswer.getQuestion().getQuestionAnswers() != null) {
				for(QuestionAnswer answer : selectedAnswer.getQuestion().getQuestionAnswers()) {
					if(answer != null && answer.isCorrect() && answer.getAnswer() != null
							&& answer.getAnswer().getAnswer() != null) {
						this.correctAnswerForMultipleAnswer += answer.getAnswer().getAnswer() + " <br>  <br> ";
					}
				}
			}
			this.isCorrectTestResultDetail = hasSubmittedAnswer && selectedAnswer.isCorrect();
			return;
		}

		// Safe fallback for any future text-based mode.
		if(hasSubmittedAnswer && selectedAnswer.getAnswer() != null
				&& selectedAnswer.getAnswer().getAnswer() != null) {
			this.isCorrectTestResultDetail = submittedAnswer.equalsIgnoreCase(
					normalize(selectedAnswer.getAnswer().getAnswer()));
		}
		
//		if(domain.getTestResult() != null) {
//			this.testResult = new TestResultDto(domain.getTestResult());
//		}
	}

	private String normalize(String value) {
		return value == null ? "" : value.trim();
	}
	
	public class sortByOrdinalNumberQuestionAnswerTestResult implements Comparator<QuestionAnswerTestResultDto> {
		public int compare(QuestionAnswerTestResultDto a, QuestionAnswerTestResultDto b)
	    {
	        return a.ordinalNumber - b.ordinalNumber;
	    }
	}
	
}
