package com.globits.richy.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.richy.dto.QuestionAnswerDto;

public interface QuestionAnswerService {
	public Page<QuestionAnswerDto> getPageObject(QuestionAnswerDto searchDto, int pageIndex, int pageSize);
	public List<QuestionAnswerDto> getListObject(QuestionAnswerDto searchDto, int pageIndex, int pageSize);
	public QuestionAnswerDto getObjectById(Long id);
	public boolean saveObject(QuestionAnswerDto dto);
	public boolean deleteObject(Long id);
}
