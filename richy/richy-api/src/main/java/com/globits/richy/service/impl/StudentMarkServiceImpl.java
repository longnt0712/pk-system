package com.globits.richy.service.impl;

import java.util.ArrayList;
import java.util.List;
import org.springframework.transaction.annotation.Transactional;

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
	public List<DisplayStudentMarkDto> getListDisplayStudentMark(
	        DisplayStudentMarkDto searchDto) {

	    List<DisplayStudentMarkDto> ret =
	            new ArrayList<DisplayStudentMarkDto>();

	    /*
	     * Chương trình đào tạo vẫn cần thiết vì dùng để lấy
	     * danh sách loại điểm/cột điểm.
	     */
	    if (searchDto == null
	            || searchDto.getEducationProgramId() == null) {
	        return ret;
	    }

	    Integer enrollmentClass =
	            searchDto.getEnrollmentClass();

	    Long groupId =
	            searchDto.getGroupId();

	    Long educationProgramId =
	            searchDto.getEducationProgramId();

	    String textSearch =
	            searchDto.getTextSearch();

	    List<UserDto> users;

	    /*
	     * Trường hợp 1:
	     * Có lớp và có group.
	     * Lấy học sinh đồng thời thuộc lớp và group.
	     */
	    if (enrollmentClass != null && groupId != null) {

	        users = userRepository
	                .getUsersDtoByEnrollmentClassAndGroupId(
	                        enrollmentClass,
	                        groupId
	                );

	    /*
	     * Trường hợp 2:
	     * Chỉ chọn lớp.
	     */
	    } else if (enrollmentClass != null) {

	        users = userRepository
	                .getUsersDtoByEnrollmentClass(
	                        enrollmentClass
	                );

	    /*
	     * Trường hợp 3:
	     * Chỉ chọn group.
	     */
	    } else if (groupId != null) {

	        users = userRepository
	                .getUsersDtoByGroupId(groupId);

	    /*
	     * Trường hợp 4:
	     * Không chọn lớp và không chọn group.
	     */
	    } else {

	        users = userRepository
	                .getAllActiveStudentDtos();
	    }

	    List<Mark> marks =
	            markRepository.findMarkBy(
	                    educationProgramId
	            );

	    if (users == null || users.isEmpty()) {
	        return ret;
	    }

	    if (marks == null) {
	        marks = new ArrayList<Mark>();
	    }

	    String keyword = null;

	    if (textSearch != null
	            && textSearch.trim().length() > 0) {

	        keyword = textSearch
	                .trim()
	                .toLowerCase();
	    }

	    for (UserDto userDto : users) {

	        if (userDto == null
	                || userDto.getId() == null) {
	            continue;
	        }

	        /*
	         * Lọc thêm theo tên hoặc mã học sinh.
	         */
	        if (keyword != null) {

	            String displayName =
	                    userDto.getDisplayName() != null
	                            ? userDto.getDisplayName()
	                                    .toLowerCase()
	                            : "";

	            String username =
	                    userDto.getUsername() != null
	                            ? userDto.getUsername()
	                                    .toLowerCase()
	                            : "";

	            if (!displayName.contains(keyword)
	                    && !username.contains(keyword)) {
	                continue;
	            }
	        }

	        DisplayStudentMarkDto dto =
	                new DisplayStudentMarkDto();

	        dto.setId(userDto.getId());
	        dto.setUser(userDto);
	        dto.setEnrollmentClass(enrollmentClass);
	        dto.setGroupId(groupId);
	        dto.setEducationProgramId(
	                educationProgramId
	        );

	        List<StudentMarkDto> studentMarks =
	                new ArrayList<StudentMarkDto>();

	        for (Mark mark : marks) {

	            if (mark == null
	                    || mark.getId() == null) {
	                continue;
	            }

	            List<StudentMark> existedStudentMarks =
	                    studentMarkRepository
	                            .findStudentMarksByMarkIdAndUserId(
	                                    mark.getId(),
	                                    userDto.getId()
	                            );

	            StudentMark studentMark =
	                    getBestStudentMark(
	                            existedStudentMarks
	                    );

	            StudentMarkDto studentMarkDto;

	            if (studentMark != null) {

	                studentMarkDto =
	                        new StudentMarkDto(
	                                studentMark
	                        );

	            } else {

	                studentMarkDto =
	                        new StudentMarkDto();

	                studentMarkDto.setId(null);
	                studentMarkDto.setUser(userDto);
	                studentMarkDto.setMark(
	                        new MarkDto(mark)
	                );
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
	@Transactional
	public StudentMarkDto saveObject(StudentMarkDto dto) {
	    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

	    LocalDateTime currentDate = LocalDateTime.now();
	    String currentUserName = "Unknown User";

	    if (authentication != null && authentication.getPrincipal() instanceof User) {
	        User modifiedUser = (User) authentication.getPrincipal();
	        currentUserName = modifiedUser.getUsername();
	    }

	    if (dto == null) {
	        return null;
	    }

	    StudentMark domain = null;

	    Long userId = null;
	    Long markId = null;

	    if (dto.getUser() != null && dto.getUser().getId() != null) {
	        userId = dto.getUser().getId();
	    }

	    if (dto.getMark() != null && dto.getMark().getId() != null) {
	        markId = dto.getMark().getId();
	    }

	    if (dto.getId() != null) {
	        domain = studentMarkRepository.findOne(dto.getId());
	    }

	    /*
	     * Nếu không tìm thấy theo id thì tìm theo user + mark.
	     * Không dùng findStudentMarkBy nữa vì hàm đó sẽ lỗi nếu đang có dữ liệu trùng.
	     */
	    if (domain == null && userId != null && markId != null) {
	        List<StudentMark> existedStudentMarks = studentMarkRepository
	                .findStudentMarksByMarkIdAndUserId(markId, userId);

	        domain = getBestStudentMark(existedStudentMarks);
	    }

	    if (domain == null) {
	        domain = new StudentMark();
	        domain.setCreateDate(currentDate);
	        domain.setCreatedBy(currentUserName);
	    } else {
	        domain.setModifyDate(currentDate);
	        domain.setModifiedBy(currentUserName);
	    }

	    if (userId != null) {
	        User user = userRepository.findOne(userId);
	        if (user != null) {
	            domain.setUser(user);
	        }
	    }

	    if (markId != null) {
	        Mark mark = markRepository.findOne(markId);
	        if (mark != null) {
	            domain.setMark(mark);
	        }
	    }

	    domain.setMarkNumber(dto.getMarkNumber());
	    domain.setMarkText(dto.getMarkText());

	    domain = studentMarkRepository.save(domain);

	    /*
	     * Sau khi lưu xong, dọn các dòng trùng cùng user + mark.
	     * Giữ lại dòng vừa save.
	     */
	    if (domain.getId() != null
	            && domain.getUser() != null
	            && domain.getUser().getId() != null
	            && domain.getMark() != null
	            && domain.getMark().getId() != null) {

	        List<StudentMark> duplicatedStudentMarks = studentMarkRepository
	                .findStudentMarksByMarkIdAndUserId(
	                        domain.getMark().getId(),
	                        domain.getUser().getId()
	                );

	        deleteDuplicateStudentMarks(duplicatedStudentMarks, domain.getId());
	    }

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
	
	private StudentMark getBestStudentMark(List<StudentMark> studentMarks) {
	    if (studentMarks == null || studentMarks.isEmpty()) {
	        return null;
	    }

	    StudentMark best = null;

	    for (StudentMark item : studentMarks) {
	        if (item == null) {
	            continue;
	        }

	        if (best == null) {
	            best = item;
	            continue;
	        }

	        if (isBetterStudentMark(item, best)) {
	            best = item;
	        }
	    }

	    return best;
	}

	private boolean isBetterStudentMark(StudentMark candidate, StudentMark current) {
	    boolean candidateHasMark = hasMarkValue(candidate);
	    boolean currentHasMark = hasMarkValue(current);

	    if (candidateHasMark && !currentHasMark) {
	        return true;
	    }

	    if (!candidateHasMark && currentHasMark) {
	        return false;
	    }

	    Long candidateId = candidate.getId() != null ? candidate.getId() : 0L;
	    Long currentId = current.getId() != null ? current.getId() : 0L;

	    return candidateId > currentId;
	}

	private boolean hasMarkValue(StudentMark studentMark) {
	    if (studentMark == null) {
	        return false;
	    }

	    if (studentMark.getMarkNumber() != null) {
	        return true;
	    }

	    return studentMark.getMarkText() != null 
	            && studentMark.getMarkText().trim().length() > 0;
	}

	private void deleteDuplicateStudentMarks(List<StudentMark> studentMarks, Long keepId) {
	    if (studentMarks == null || studentMarks.isEmpty() || keepId == null) {
	        return;
	    }

	    for (StudentMark item : studentMarks) {
	        if (item == null || item.getId() == null) {
	            continue;
	        }

	        if (!keepId.equals(item.getId())) {
	            studentMarkRepository.delete(item);
	        }
	    }
	}

}
