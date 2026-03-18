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

public class QuestionUserDto implements Serializable  {
	private String username;
	private Long numberOfWords;
	private boolean haveProgress = false;
	private String textSearch;
	
	
	public String getTextSearch() {
		return textSearch;
	}
	public void setTextSearch(String textSearch) {
		this.textSearch = textSearch;
	}
	public String getUsername() {
		return username;
	}
	public void setUsername(String username) {
		this.username = username;
	}
	public Long getNumberOfWords() {
		return numberOfWords;
	}
	public void setNumberOfWords(Long numberOfWords) {
		this.numberOfWords = numberOfWords;
	}
	public boolean isHaveProgress() {
		return haveProgress;
	}
	public void setHaveProgress(boolean haveProgress) {
		this.haveProgress = haveProgress;
	}
	
	
}
