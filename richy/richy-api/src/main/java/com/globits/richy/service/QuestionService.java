package com.globits.richy.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.richy.dto.QuestionDto;
import com.globits.richy.dto.QuestionForGamesDto;
import com.globits.richy.dto.QuestionForTestsDto;
import com.globits.richy.dto.QuestionOnlyQuestionDto;
import com.globits.richy.dto.QuestionUserDto;
import com.globits.richy.dto.QuizDto;

public interface QuestionService {
	public Page<QuestionDto> getPageObject(QuestionDto searchDto, int pageIndex, int pageSize);
	public Page<QuestionForGamesDto> getPageObjectForGames(QuestionDto searchDto, int pageIndex, int pageSize);
	public Page<QuestionForTestsDto> getPageObjectForTests(QuestionDto searchDto, int pageIndex, int pageSize);
	public Page<QuestionOnlyQuestionDto> getPageObjectOnlyQuestion(QuestionDto searchDto, int pageIndex, int pageSize);
	public Page<QuestionDto> getPageObjectReverse(QuestionDto searchDto, int pageIndex, int pageSize);
	public List<QuestionDto> getListObject(QuestionDto searchDto, int pageIndex, int pageSize);
	public QuestionDto getObjectById(Long id);
	public QuestionDto saveObject(QuestionDto dto);
	public boolean deleteObject(Long id);
	
	public QuestionDto getRandomObject(int from, int to);
	
	public QuestionDto getRandomFlashCard(QuestionDto searchDto);
	
	public QuestionDto answerQuestion(QuestionDto dto);
	
	public QuestionDto answerQuestionCatechism(QuestionDto dto);
	
	public QuizDto getRandomFlashCardQuiz(QuizDto searchDto);
	
	public QuestionDto saveMaterial(QuestionDto searchDto);
	
	public Page<QuestionUserDto> getStatisticQuestionUser(QuestionDto searchDto,int pageIndex, int pageSize);

}
