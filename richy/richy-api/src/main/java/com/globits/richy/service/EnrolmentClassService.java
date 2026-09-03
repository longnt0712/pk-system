package com.globits.richy.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.core.dto.OrganizationDto;
import com.globits.core.dto.PersonDto;
import com.globits.richy.dto.EnrolmentClassDto;
import com.globits.richy.dto.EnrolmentClassMoveStudentDto;
import com.globits.richy.dto.EnrolmentClassTeamBoardDto;
import com.globits.security.dto.UserDto;

public interface EnrolmentClassService {
	public Page<EnrolmentClassDto> getPageObject(EnrolmentClassDto searchDto, int pageIndex, int pageSize);
	public List<EnrolmentClassDto> getListObject(EnrolmentClassDto searchDto, int pageIndex, int pageSize);
	public EnrolmentClassDto getObjectById(Long id);
	public boolean saveObject(EnrolmentClassDto dto);
	public boolean deleteObject(Long id);
	public List<EnrolmentClassDto> getTreeObjects();
	public List<Long> getClassAndDescendantIds(Long classId);
	public List<Long> getClassIdsBySchool(Integer schoolId);
	public List<UserDto> getTeacherCandidates();
	public EnrolmentClassTeamBoardDto getTeamBoard(Long classId);
	public EnrolmentClassTeamBoardDto moveStudentToTeam(Long classId, EnrolmentClassMoveStudentDto moveDto);
}
