package com.globits.richy.service.impl;

import java.util.ArrayList;
import java.util.List;

import javax.persistence.EntityManager;
import javax.persistence.Query;

import org.joda.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import com.globits.richy.domain.EducationProgram;
import com.globits.richy.domain.Mark;
import com.globits.richy.domain.StudentMark;
import com.globits.richy.dto.DisplayStudentMarkDto;
import com.globits.richy.dto.MarkDto;
import com.globits.richy.dto.StudentMarkDto;
import com.globits.richy.repository.EducationProgramRepository;
import com.globits.richy.repository.MarkRepository;
import com.globits.richy.repository.StudentMarkRepository;
import com.globits.richy.service.StudentMarkService;
import com.globits.security.domain.User;
import com.globits.security.dto.UserDto;
import com.globits.security.repository.UserRepository;

@Service
public class StudentMarkServiceImpl implements StudentMarkService {
	@Autowired
	EntityManager manager;
	@Autowired
	StudentMarkRepository studentMarkRepository;
	@Autowired
	MarkRepository markRepository;
	@Autowired
	UserRepository userRepository;
	@Autowired
	EducationProgramRepository educationProgramRepository;
	
	@Override
	public Page<StudentMarkDto> getPageObject(StudentMarkDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.StudentMarkDto(s) from StudentMark s where (1=1)";
		String sqlCount = "select count(s.id) from StudentMark s where (1=1)";
		String whereClause = "";

		if (textSearch != null && textSearch.length() > 0) {
			whereClause += " and (s.text like :textSearch)";
		}
		
		if(searchDto != null && searchDto.getUser() != null && searchDto.getUser().getId() != null) {
			whereClause += " and (s.user.id = :userId) ";
		}
	
		if(searchDto != null && searchDto.getMark() != null && searchDto.getMark().getId() != null) {
			whereClause += " and (s.mark.id = :markId) ";
		}
		
		if(searchDto != null && searchDto.getMark() != null && searchDto.getMark().getEducationProgram() != null  && searchDto.getMark().getEducationProgram().getId() != null) {
			whereClause += " and (s.mark.educationProgram.id = :eduId) ";
		}

		sql += whereClause;
		sqlCount += whereClause;

		Query q = manager.createQuery(sql, StudentMarkDto.class);
		Query qCount = manager.createQuery(sqlCount);

		if (textSearch != null && textSearch.length() > 0) {
			q.setParameter("textSearch", '%' + textSearch + '%');
			qCount.setParameter("textSearch", '%' + textSearch + '%');
		}
		
		if(searchDto != null && searchDto.getUser() != null && searchDto.getUser().getId() != null) {
			q.setParameter("userId",  searchDto.getUser().getId() );
			qCount.setParameter("userId", searchDto.getUser().getId() );
		}
		
		if(searchDto != null && searchDto.getMark() != null && searchDto.getMark().getId() != null) {
			q.setParameter("markId",  searchDto.getMark().getId() );
			qCount.setParameter("markId", searchDto.getMark().getId() );
		}
		
		if(searchDto != null && searchDto.getMark() != null && searchDto.getMark().getEducationProgram() != null  && searchDto.getMark().getEducationProgram().getId() != null) {
			q.setParameter("eduId",  searchDto.getMark().getEducationProgram().getId() );
			qCount.setParameter("eduId", searchDto.getMark().getEducationProgram().getId() );
		}

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<StudentMarkDto> page = new PageImpl<StudentMarkDto>(q.getResultList(), pageable, numberResult);
		return page;
	}
	
	
	@Override
	public List<DisplayStudentMarkDto> getListDisplayStudentMark(DisplayStudentMarkDto searchDto) {
	    List<DisplayStudentMarkDto> ret = new ArrayList<DisplayStudentMarkDto>();

	    if (searchDto == null || searchDto.getEnrollmentClass() == null || searchDto.getEducationProgramId() == null) {
	        return ret;
	    }

	    Integer enrollmentClass = searchDto.getEnrollmentClass();
	    Long educationProgramId = searchDto.getEducationProgramId();
	    String textSearch = searchDto.getTextSearch();

	    // tìm user theo lớp
	    List<UserDto> users = userRepository.getUsersDtoByEnrollmentClass(enrollmentClass);
	    List<Mark> marks = markRepository.findMarkBy(educationProgramId);

	    if (users == null || users.isEmpty()) {
	        return ret;
	    }

	    for (UserDto userDto : users) {
	        if (userDto == null || userDto.getId() == null) {
	            continue;
	        }

	        // lọc theo textSearch nếu có
	        if (textSearch != null && textSearch.trim().length() > 0) {
	            String keyword = textSearch.trim().toLowerCase();
	            String displayName = userDto.getDisplayName() != null ? userDto.getDisplayName().toLowerCase() : "";
	            String username = userDto.getUsername() != null ? userDto.getUsername().toLowerCase() : "";

	            if (!displayName.contains(keyword) && !username.contains(keyword)) {
	                continue;
	            }
	        }

	        DisplayStudentMarkDto dto = new DisplayStudentMarkDto();
	        dto.setId(userDto.getId());
	        dto.setUser(userDto);
	        dto.setEnrollmentClass(enrollmentClass);
	        dto.setEducationProgramId(educationProgramId);

	        List<StudentMarkDto> studentMarks = new ArrayList<StudentMarkDto>();

	        for (Mark mark : marks) {
	            StudentMark studentMark = studentMarkRepository
	                    .findStudentMarkBy(mark.getId(), userDto.getId())
	                    .orElse(null);

	            StudentMarkDto studentMarkDto;

	            if (studentMark != null) {
	                studentMarkDto = new StudentMarkDto(studentMark);
	            } else {
	                studentMarkDto = new StudentMarkDto();
	                studentMarkDto.setId(null);
	                studentMarkDto.setUser(userDto);
	                studentMarkDto.setMark(new MarkDto(mark));
	                studentMarkDto.setMarkNumber(null);
	                studentMarkDto.setMarkText(null);
	            }

	            studentMarks.add(studentMarkDto);
	        }

	        dto.setStudentMarks(studentMarks);
	        ret.add(dto);
	    }

	    return ret;
	}

	@Override
	public List<StudentMarkDto> getListObject(StudentMarkDto searchDto, int pageIndex, int pageSize) {
		return null;
	}

	@Override
	public StudentMarkDto getObjectById(Long id) {
		return new StudentMarkDto(studentMarkRepository.getOne(id));
	}

	@Override
	public StudentMarkDto saveObject(StudentMarkDto dto) {
	    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
	    User modifiedUser = null;
	    LocalDateTime currentDate = LocalDateTime.now();
	    String currentUserName = "Unknown User";

	    if (authentication != null && authentication.getPrincipal() instanceof User) {
	        modifiedUser = (User) authentication.getPrincipal();
	        currentUserName = modifiedUser.getUsername();
	    }

	    if (dto == null) {
	        return null;
	    }

	    StudentMark domain = null;

	    if (dto.getId() != null) {
	        domain = studentMarkRepository.findOne(dto.getId());
	    }

	    if (domain == null) {
	        domain = new StudentMark();
	        domain.setCreateDate(currentDate);
	        domain.setCreatedBy(currentUserName);
	    } else {
	        domain.setModifyDate(currentDate);
	        domain.setModifiedBy(currentUserName);
	    }

	    if (dto.getUser() != null && dto.getUser().getId() != null) {
	        User user = userRepository.findOne(dto.getUser().getId());
	        if (user != null) {
	            domain.setUser(user);
	        }
	    }

	    if (dto.getMark() != null && dto.getMark().getId() != null) {
	        Mark mark = markRepository.findOne(dto.getMark().getId());
	        if (mark != null) {
	            domain.setMark(mark);
	        }
	    }

	    domain.setMarkNumber(dto.getMarkNumber());
	    domain.setMarkText(dto.getMarkText());

	    domain = studentMarkRepository.save(domain);

	    return new StudentMarkDto(domain);
	}

	@Override
	public boolean deleteObject(Long id) {
		if(id == null) {
			return false;
		}
		StudentMark domain = studentMarkRepository.getOne(id);
		if(domain == null) {
			return false;
		}
		studentMarkRepository.delete(domain);
		return true;
	}

}
