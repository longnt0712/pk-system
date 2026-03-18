package com.globits.richy.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.richy.dto.DisplayStudentMarkDto;
import com.globits.richy.dto.StudentMarkDto;

public interface StudentMarkService {
	public Page<StudentMarkDto> getPageObject(StudentMarkDto searchDto, int pageIndex, int pageSize);
	public List<StudentMarkDto> getListObject(StudentMarkDto searchDto, int pageIndex, int pageSize);
	public List<DisplayStudentMarkDto> getListDisplayStudentMark(DisplayStudentMarkDto searchDto);
	public StudentMarkDto getObjectById(Long id);
	public StudentMarkDto saveObject(StudentMarkDto dto);
	public boolean deleteObject(Long id);
}
