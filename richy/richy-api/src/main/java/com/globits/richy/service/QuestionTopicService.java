package com.globits.richy.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.richy.dto.QuestionTopicDto;

public interface QuestionTopicService {
	public Page<QuestionTopicDto> getPageObject(QuestionTopicDto searchDto, int pageIndex, int pageSize);
	public List<QuestionTopicDto> getListObject(QuestionTopicDto searchDto, int pageIndex, int pageSize);
	public QuestionTopicDto getObjectById(Long id);
	public boolean saveObject(QuestionTopicDto dto);
	public boolean deleteObject(Long id);
}
