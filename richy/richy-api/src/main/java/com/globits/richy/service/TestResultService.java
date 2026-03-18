package com.globits.richy.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.richy.dto.TestResultDto;

public interface TestResultService {
	public Page<TestResultDto> getPageObject(TestResultDto searchDto, int pageIndex, int pageSize);
	public List<TestResultDto> getRanking(TestResultDto searchDto);
	public List<TestResultDto> getListObject(TestResultDto searchDto, int pageIndex, int pageSize);
	public TestResultDto getObjectById(Long id);
	public TestResultDto saveObject(TestResultDto dto);
	public boolean deleteObject(Long id);
}
