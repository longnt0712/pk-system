package com.globits.richy.service;

import java.util.List;

import org.springframework.data.domain.Page;
import com.globits.richy.dto.TopicDto;

public interface TopicService {
	public Page<TopicDto> getPageObject(TopicDto searchDto, int pageIndex, int pageSize);
	public List<TopicDto> getListObject();
	public TopicDto getObjectById(Long id);
	public TopicDto saveObject(TopicDto dto);
	public boolean deleteObject(Long id);
}
