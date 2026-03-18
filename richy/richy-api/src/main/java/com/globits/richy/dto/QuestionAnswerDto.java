package com.globits.richy.dto;

import java.io.Serializable;
import java.util.Comparator;

import com.globits.richy.domain.QuestionAnswer;


public class QuestionAnswerDto implements Serializable{
	private Long id;
	private QuestionDto question;
	private AnswerDto answer;
	private String clientAnswer;
	private boolean isCorrect;
	private String textSearch;
	Integer ordinalNumberQuestionAnswer;
	private String label;
	private String correctAnswer; //for multiple choice qu
	

	public String getCorrectAnswer() {
		return correctAnswer;
	}

	public void setCorrectAnswer(String correctAnswer) {
		this.correctAnswer = correctAnswer;
	}

	public String getLabel() {
		return label;
	}

	public void setLabel(String label) {
		this.label = label;
	}

	private boolean isSelected = false;
	
	public boolean isSelected() {
		return isSelected;
	}
	
	public String getClientAnswer() {
		return clientAnswer;
	}

	public void setClientAnswer(String clientAnswer) {
		this.clientAnswer = clientAnswer;
	}

	public void setSelected(boolean isSelected) {
		this.isSelected = isSelected;
	}
	public Integer getOrdinalNumberQuestionAnswer() {
		return ordinalNumberQuestionAnswer;
	}
	public void setOrdinalNumberQuestionAnswer(Integer ordinalNumberQuestionAnswer) {
		this.ordinalNumberQuestionAnswer = ordinalNumberQuestionAnswer;
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
	public boolean isCorrect() {
		return isCorrect;
	}
	public void setCorrect(boolean isCorrect) {
		this.isCorrect = isCorrect;
	}
	public QuestionDto getQuestion() {
		return question;
	}
	public void setQuestion(QuestionDto question) {
		this.question = question;
	}
	public AnswerDto getAnswer() {
		return answer;
	}
	public void setAnswer(AnswerDto answer) {
		this.answer = answer;
	}

	public QuestionAnswerDto() {
		
	}
	
	public QuestionAnswerDto(QuestionAnswer domain) {
		this.id = domain.getId();
		if(domain.getQuestion() != null) {
			this.question = new QuestionDto();
			this.question.setId(domain.getQuestion().getId());
			this.question.setOrdinalNumber(domain.getQuestion().getOrdinalNumber());
			if(domain.getQuestion().getParent()!=null) {
				QuestionDto qDto = new QuestionDto();
				qDto.setId(domain.getQuestion().getParent().getId());
				qDto.setType(domain.getQuestion().getParent().getType());
				this.question.setParent(qDto);
			}
			if(domain.getQuestion().getQuestionAnswers() != null && domain.getQuestion().getQuestionAnswers().size() > 0) {
				for (QuestionAnswer qadto : domain.getQuestion().getQuestionAnswers()) {
					if(qadto.isCorrect()) {
						this.correctAnswer = qadto.getAnswer().getAnswer();
					}
				}
			}
		}
		if(domain.getAnswer() != null) {
			this.answer = new  AnswerDto(domain.getAnswer());
		}
		this.isCorrect = domain.isCorrect();
		this.ordinalNumberQuestionAnswer = domain.getOrdinalNumber();
	}
	
	public class sortByOrdinalNumberQuestionAnswer implements Comparator<QuestionAnswerDto> {
		public int compare(QuestionAnswerDto a, QuestionAnswerDto b)
	    {
	        return a.ordinalNumberQuestionAnswer - b.ordinalNumberQuestionAnswer;
	    }
	}
}
