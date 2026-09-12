package com.globits.richy.service.impl;

import java.text.Normalizer;
import java.text.ParsePosition;
import java.text.SimpleDateFormat;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Queue;
import java.util.Set;

import org.joda.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import com.globits.richy.domain.EnrolmentClass;
import com.globits.richy.domain.EnrolmentClassScheduleDay;
import com.globits.richy.domain.EnrolmentClassWeeklySession;
import com.globits.richy.domain.Topic;
import com.globits.richy.domain.EnrolmentClassScheduleTask;
import com.globits.richy.domain.EnrolmentClassTaskProgress;
import com.globits.richy.dto.EnrolmentClassScheduleTaskDto;
import com.globits.richy.dto.EnrolmentClassTaskProgressDto;
import com.globits.richy.service.EnrolmentClassScheduleException;
import org.springframework.http.HttpStatus;
import com.globits.richy.dto.EnrolmentClassDto;
import com.globits.richy.dto.EnrolmentClassScheduleDayDto;
import com.globits.richy.dto.EnrolmentClassWeeklySessionDto;
import com.globits.richy.dto.EnrolmentClassMoveStudentDto;
import com.globits.richy.dto.EnrolmentClassTeamBoardDto;
import com.globits.richy.dto.EnrolmentClassTeamDto;
import com.globits.richy.dto.TopicForListAllDto;
import com.globits.richy.repository.EnrolmentClassRepository;
import com.globits.richy.repository.EnrolmentClassScheduleDayRepository;
import com.globits.richy.repository.EnrolmentClassWeeklySessionRepository;
import com.globits.richy.repository.TopicRepository;
import com.globits.richy.repository.TestResultRepository;
import com.globits.richy.service.EnrolmentClassService;
import com.globits.security.domain.Role;
import com.globits.security.domain.User;
import com.globits.security.dto.UserDto;
import com.globits.security.repository.UserRepository;

@Service
@Transactional
public class EnrolmentClassServiceImpl implements EnrolmentClassService {
	@Autowired
	EnrolmentClassRepository enrolmentClassRepository;
	@Autowired
	UserRepository userRepository;
	@Autowired
	EnrolmentClassScheduleDayRepository scheduleDayRepository;
	@Autowired
	TestResultRepository testResultRepository;
	@Autowired
	EnrolmentClassWeeklySessionRepository weeklySessionRepository;
	@Autowired
	TopicRepository topicRepository;

	private static final List<String> TEACHER_ROLE_NAMES = Arrays.asList(
			"ROLE_ADMIN",
			"ROLE_EDUCATION_MANAGERMENT",
			"ROLE_STUDENT_MANAGERMENT",
			"ROLE_STAFF");

	private static final String ROLE_ADMIN = "ROLE_ADMIN";
	private static final String ROLE_USER = "ROLE_USER";
	private static final String ROLE_VIEWER = "ROLE_VIEWER";
	private static final String ROLE_EDUCATION_MANAGERMENT = "ROLE_EDUCATION_MANAGERMENT";
	private static final String ROLE_STUDENT_MANAGERMENT = "ROLE_STUDENT_MANAGERMENT";
	private static final Integer HIDDEN_SCHOOL_ID = Integer.valueOf(1);
	private static final Integer EDUCATION_MANAGER_SCHOOL_ID = Integer.valueOf(2);

	@Override
	public Page<EnrolmentClassDto> getPageObject(EnrolmentClassDto searchDto, int pageIndex, int pageSize) {
		int zeroBasedPage = pageIndex > 0 ? pageIndex - 1 : 0;
		int safePageSize = pageSize > 0 ? pageSize : 10;
		Pageable pageable = new PageRequest(zeroBasedPage, safePageSize);
		String textSearch = searchDto == null || searchDto.getTextSearch() == null
				? ""
				: searchDto.getTextSearch().trim().toLowerCase(Locale.ROOT);
		User currentUser = getCurrentUser();
		List<EnrolmentClass> domains = enrolmentClassRepository.findAll();
		sortClasses(domains);

		List<EnrolmentClassDto> visible = new ArrayList<EnrolmentClassDto>();
		for (EnrolmentClass domain : domains) {
			if (!(searchDto != null && searchDto.getSchoolId() != null ? searchDto.getSchoolId()
					: EDUCATION_MANAGER_SCHOOL_ID).equals(domain.getSchoolId()) || !canViewClass(currentUser, domain)) {
				continue;
			}
			String searchable = ((domain.getName() == null ? "" : domain.getName()) + " "
					+ (domain.getCode() == null ? "" : domain.getCode())).toLowerCase(Locale.ROOT);
			if (!textSearch.isEmpty() && !searchable.contains(textSearch)) {
				continue;
			}
			visible.add(toDto(domain, null, currentUser));
		}

		long requestedFromIndex = (long) zeroBasedPage * (long) safePageSize;
		int fromIndex = (int) Math.min(requestedFromIndex, (long) visible.size());
		int toIndex = Math.min(fromIndex + safePageSize, visible.size());
		return new PageImpl<EnrolmentClassDto>(
				new ArrayList<EnrolmentClassDto>(visible.subList(fromIndex, toIndex)),
				pageable,
				visible.size());
	}

	@Override
	public List<EnrolmentClassDto> getListObject(EnrolmentClassDto searchDto, int pageIndex, int pageSize) {
		return getPageObject(searchDto, pageIndex, pageSize).getContent();
	}

	@Override
	public EnrolmentClassDto getObjectById(Long id) {
		EnrolmentClass domain = id == null ? null : enrolmentClassRepository.findOne(id);
		if (domain == null) {
			return null;
		}
		User currentUser = getCurrentUser();
		if (!canViewClass(currentUser, domain)) {
			throw new AccessDeniedException("Bạn không được xem lớp này.");
		}
		EnrolmentClassDto dto = toDto(domain, null, currentUser);
		dto.setWeeklySessions(toWeeklySessionDtos(id));
		return dto;
	}

	@Override
	public boolean saveObject(EnrolmentClassDto dto) {
		User currentUser = getCurrentUser();
		if (currentUser == null) {
			throw new AccessDeniedException("Bạn chưa đăng nhập.");
		}
		LocalDateTime currentDate = LocalDateTime.now();
		String currentUserName = currentUser.getUsername();
		if(dto == null || dto.getName() == null || dto.getName().trim().isEmpty()) {
			return false;
		}
		EnrolmentClass domain = null;
		if(dto.getId() != null) {
			domain = enrolmentClassRepository.findOne(dto.getId());
			if (domain == null) {
				return false;
			}
		}
		boolean isNew = domain == null;
		EnrolmentClass originalParent = isNew ? null : domain.getParent();
		if (!isNew && !canEditClass(currentUser, domain)) {
			throw new AccessDeniedException("Bạn không được sửa lớp này.");
		}

		EnrolmentClass parent = null;
		if (dto.getParentId() != null) {
			parent = enrolmentClassRepository.findOne(dto.getParentId());
			if (parent == null || (!isNew && createsCycle(domain, parent))) {
				return false;
			}
		}

		boolean parentChanged = !sameClass(originalParent, parent);
        Integer targetSchoolId = parent != null ? parent.getSchoolId()
                : !isNew ? domain.getSchoolId()
                : dto.getSchoolId() != null ? dto.getSchoolId() : EDUCATION_MANAGER_SCHOOL_ID;
        if (!canViewSchool(currentUser, targetSchoolId)
                || (dto.getSchoolId() != null && !dto.getSchoolId().equals(targetSchoolId))
                || (!isNew && !targetSchoolId.equals(domain.getSchoolId()))) {
            throw new AccessDeniedException("Không được chuyển lớp sang trường hoặc phạm vi khác.");
        }
        if (isNew && parent == null && HIDDEN_SCHOOL_ID.equals(targetSchoolId) && !hasRole(currentUser, ROLE_ADMIN)) {
            throw new AccessDeniedException("Bạn không được tạo lớp tiếng Anh gốc.");
        }
		if (isNew) {
			if (parent == null) {
				if (!canCreateRootClass(currentUser)) {
					throw new AccessDeniedException("Bạn không được tạo lớp gốc.");
				}
			} else if (!canEditClass(currentUser, parent)) {
				throw new AccessDeniedException("Bạn không được thêm lớp con vào lớp này.");
			}
		} else if (parentChanged) {
			if (parent == null) {
				if (!canCreateRootClass(currentUser)) {
					throw new AccessDeniedException("Bạn không được chuyển lớp thành lớp gốc.");
				}
			} else if (!canEditClass(currentUser, parent)) {
				throw new AccessDeniedException("Bạn không được chuyển lớp vào lớp cha này.");
			}
		}

		// Validate before changing managed entities: returning false does not roll back.
		Set<Long> requestedIds = new LinkedHashSet<Long>();
		Long primaryTeacherId;
		if (dto.getDeputyTeacherIds() != null) {
			primaryTeacherId = dto.getPrimaryTeacherId();
			requestedIds.addAll(dto.getDeputyTeacherIds());
			if (primaryTeacherId != null && !requestedIds.add(primaryTeacherId)) {
				return false;
			}
		} else {
			if (dto.getTeacherIds() != null) {
				requestedIds.addAll(dto.getTeacherIds());
			}
			primaryTeacherId = domain == null ? null : domain.getPrimaryTeacherId();
			if (!requestedIds.contains(primaryTeacherId)) {
				primaryTeacherId = null;
			}
		}
		Set<User> teachers = new LinkedHashSet<User>();
		for (Long teacherId : requestedIds) {
			User teacher = teacherId == null ? null : userRepository.findOne(teacherId);
			if (teacher == null || !Boolean.TRUE.equals(teacher.getActive())
					|| (parent == null ? !isTeacherCandidate(teacher)
							: isNew || !isClassStudent(teacher, targetSchoolId)
									|| !userBelongsToClass(teacher, domain.getId()))) {
				return false;
			}
			teachers.add(teacher);
		}

		if(domain != null) {
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(currentDate);
		}
		if(domain == null) {
			domain = new EnrolmentClass();
			domain.setCreateDate(currentDate);
			domain.setCreatedBy(currentUserName);
		}
		
		if(dto.getName() != null) {
			domain.setName(dto.getName().trim());
		}
		
		if(dto.getCode() != null) {
			domain.setCode(dto.getCode().trim());
		}
		
        domain.setSchoolId(targetSchoolId);
		domain.setParent(parent);

		domain.setTeachers(teachers);
		domain.setPrimaryTeacherId(primaryTeacherId);
		
		domain = enrolmentClassRepository.save(domain);
		
		return domain.getId() != null;
	}

	@Override
	public boolean deleteObject(Long id) {
		if(id == null) {
			return false;
		}
		EnrolmentClass domain = enrolmentClassRepository.findOne(id);
		if(domain == null) {
			return false;
		}
		if (!canEditClass(getCurrentUser(), domain)) {
			throw new AccessDeniedException("Bạn không được xóa lớp này.");
		}
		if (enrolmentClassRepository.countByParentId(id) > 0
				|| !userRepository.getUsersByEnrollmentClassIds(Collections.singletonList(id)).isEmpty()) {
			return false;
		}
		domain.getTeachers().clear();
		enrolmentClassRepository.delete(domain);
		return true;
	}

	@Override
	public List<EnrolmentClassDto> getTreeObjects() {
		return getTreeObjects(EDUCATION_MANAGER_SCHOOL_ID);
	}

	@Override
	public List<EnrolmentClassDto> getTreeObjects(Integer schoolId) {
		List<EnrolmentClass> domains = enrolmentClassRepository.findAll();
		User currentUser = getCurrentUser();
        if (!canViewSchool(currentUser, schoolId)) {
            throw new AccessDeniedException("Bạn không được xem danh sách lớp này.");
        }
        List<EnrolmentClass> scopedDomains = new ArrayList<EnrolmentClass>();
        for (EnrolmentClass domain : domains) {
            if (schoolId.equals(domain.getSchoolId())) { scopedDomains.add(domain); }
        }
        domains = scopedDomains;
		Collections.sort(domains, new Comparator<EnrolmentClass>() {
			@Override
			public int compare(EnrolmentClass first, EnrolmentClass second) {
				String a = first.getName() == null ? "" : first.getName();
				String b = second.getName() == null ? "" : second.getName();
				return a.compareToIgnoreCase(b);
			}
		});
		Map<Long, Integer> childCounts = new HashMap<Long, Integer>();
		for (EnrolmentClass domain : domains) {
			if (!canViewClass(currentUser, domain)) {
				continue;
			}
			if (domain.getParent() != null && canViewClass(currentUser, domain.getParent())) {
				Long parentId = domain.getParent().getId();
				Integer current = childCounts.get(parentId);
				childCounts.put(parentId, current == null ? 1 : current + 1);
			}
		}
		List<EnrolmentClassDto> result = new ArrayList<EnrolmentClassDto>();
		for (EnrolmentClass domain : domains) {
			if (canViewClass(currentUser, domain)) {
				result.add(toDto(domain, childCounts, currentUser));
			}
		}
		return result;
	}

	@Override
	public List<Long> getClassAndDescendantIds(Long classId) {
		List<Long> result = new ArrayList<Long>();
		if (classId == null || enrolmentClassRepository.findOne(classId) == null) {
			return result;
		}
		Queue<Long> queue = new ArrayDeque<Long>();
		Set<Long> visited = new HashSet<Long>();
		queue.add(classId);
		while (!queue.isEmpty()) {
			Long currentId = queue.remove();
			if (!visited.add(currentId)) {
				continue;
			}
			result.add(currentId);
			for (EnrolmentClass child : enrolmentClassRepository.findByParentId(currentId)) {
				queue.add(child.getId());
			}
		}
		return result;
	}

	@Override
	public List<Long> getClassIdsBySchool(Integer schoolId) {
		return schoolId == null ? new ArrayList<Long>() : enrolmentClassRepository.findIdsBySchoolId(schoolId);
	}

	@Override
	public List<UserDto> getTeacherCandidates() {
		return userRepository.getActiveUsersByRoleNames(TEACHER_ROLE_NAMES);
	}

	@Override
	public List<UserDto> getResponsibleCandidates(Long parentClassId) {
		return getResponsibleCandidates(parentClassId, null);
	}

	@Override
	public List<UserDto> getResponsibleCandidates(Long parentClassId, Long classId) {
		User currentUser = getCurrentUser();
		if (parentClassId == null) {
			if (!canCreateRootClass(currentUser)) {
				throw new AccessDeniedException("Bạn không được tạo hoặc sửa lớp gốc.");
			}
		} else {
			EnrolmentClass parentClass = enrolmentClassRepository.findOne(parentClassId);
			if (parentClass == null || !canViewClass(currentUser, parentClass)) {
				throw new AccessDeniedException("Bạn không được xem lớp cha này.");
			}
			if (!canEditClass(currentUser, parentClass)
					&& !canEditAnyDirectChild(currentUser, parentClassId)) {
				throw new AccessDeniedException("Bạn không được sửa lớp trong phạm vi này.");
			}
		}

		Map<Long, UserDto> candidates = new LinkedHashMap<Long, UserDto>();
		if (parentClassId == null) {
			for (UserDto teacher : getTeacherCandidates()) {
				if (teacher != null && teacher.getId() != null) {
					candidates.put(teacher.getId(), teacher);
				}
			}
		} else if (classId != null) {
			EnrolmentClass team = enrolmentClassRepository.findOne(classId);
			if (team == null || !canEditClass(currentUser, team)) {
				throw new AccessDeniedException("Bạn không được sửa tổ này.");
			}
			for (User student : getClassStudents(Collections.singletonList(classId), team.getSchoolId())) {
				if (student != null && student.getId() != null) {
					candidates.put(student.getId(), new UserDto(student, true));
				}
			}
		}

		List<UserDto> result = new ArrayList<UserDto>(candidates.values());
		Collections.sort(result, new Comparator<UserDto>() {
			@Override
			public int compare(UserDto first, UserDto second) {
				String firstName = first == null || first.getDisplayName() == null
						? (first == null || first.getUsername() == null ? "" : first.getUsername())
						: first.getDisplayName();
				String secondName = second == null || second.getDisplayName() == null
						? (second == null || second.getUsername() == null ? "" : second.getUsername())
						: second.getDisplayName();
				return firstName.compareToIgnoreCase(secondName);
			}
		});
		return result;
	}

	@Override
	public EnrolmentClassTeamBoardDto getTeamBoard(Long classId) {
		EnrolmentClass selectedClass = classId == null ? null : enrolmentClassRepository.findOne(classId);
		if (selectedClass == null) {
			return null;
		}

		User currentUser = getCurrentUser();
		if (!canManageTeams(currentUser, selectedClass)) {
			throw new AccessDeniedException("Bạn không được phân đội cho lớp này.");
		}

		List<EnrolmentClass> teamDomains = new ArrayList<EnrolmentClass>();
		for (EnrolmentClass team : enrolmentClassRepository.findByParentId(classId)) {
			if (selectedClass.getSchoolId().equals(team.getSchoolId()) && canViewClass(currentUser, team)) {
				teamDomains.add(team);
			}
		}
		sortClasses(teamDomains);

		List<Long> scopeIds = new ArrayList<Long>();
		scopeIds.add(classId);
		for (EnrolmentClass team : teamDomains) {
			scopeIds.add(team.getId());
		}

		List<User> students = getClassStudents(scopeIds, selectedClass.getSchoolId());
		Collections.sort(students, new Comparator<User>() {
			@Override
			public int compare(User first, User second) {
				int byName = studentNameSortKey(first).compareTo(studentNameSortKey(second));
				if (byName != 0) {
					return byName;
				}
				return studentUsername(first).compareTo(studentUsername(second));
			}
		});

		EnrolmentClassTeamBoardDto board = new EnrolmentClassTeamBoardDto();
		board.setClassId(selectedClass.getId());
		board.setClassName(selectedClass.getName());
		board.setCanManage(true);
		board.setTotalStudents(students.size());

		Map<Long, EnrolmentClassTeamDto> teamsById = new HashMap<Long, EnrolmentClassTeamDto>();
		for (EnrolmentClass team : teamDomains) {
			EnrolmentClassTeamDto teamDto = new EnrolmentClassTeamDto();
			teamDto.setId(team.getId());
			teamDto.setName(team.getName());
			teamDto.setCode(team.getCode());
			board.getTeams().add(teamDto);
			teamsById.put(team.getId(), teamDto);
		}

		for (User student : students) {
			UserDto studentDto = new UserDto(student, true);
			if (student.getPerson() != null) {
				studentDto.setLastName(student.getPerson().getLastName());
				studentDto.setFirstName(student.getPerson().getFirstName());
				studentDto.setDisplayName(studentDisplayName(student));
			}
			EnrolmentClassTeamDto assignedTeam = null;
			for (EnrolmentClass team : teamDomains) {
				if (userBelongsToClass(student, team.getId())) {
					assignedTeam = teamsById.get(team.getId());
					break;
				}
			}
			if (assignedTeam == null) {
				board.getUnassignedStudents().add(studentDto);
			} else {
				assignedTeam.getStudents().add(studentDto);
			}
		}

		return board;
	}

	@Override
	public EnrolmentClassTeamBoardDto moveStudentToTeam(
			Long classId,
			EnrolmentClassMoveStudentDto moveDto) {

		if (classId == null || moveDto == null || moveDto.getUserId() == null) {
			return null;
		}

		EnrolmentClass selectedClass = enrolmentClassRepository.findOne(classId);
		if (selectedClass == null) {
			return null;
		}
		User currentUser = getCurrentUser();
		if (!canManageTeams(currentUser, selectedClass)) {
			throw new AccessDeniedException("Bạn không được phân đội cho lớp này.");
		}

		List<EnrolmentClass> directTeams = new ArrayList<EnrolmentClass>();
		for (EnrolmentClass team : enrolmentClassRepository.findByParentId(classId)) {
			if (selectedClass.getSchoolId().equals(team.getSchoolId()) && canViewClass(currentUser, team)) {
				directTeams.add(team);
			}
		}
		Set<Long> directTeamIds = new HashSet<Long>();
		for (EnrolmentClass team : directTeams) {
			directTeamIds.add(team.getId());
		}

		Long targetTeamId = moveDto.getTargetTeamId();
		if (targetTeamId != null && !directTeamIds.contains(targetTeamId)) {
			return null;
		}

		User student = userRepository.findOne(moveDto.getUserId());
		if (!isClassStudent(student, selectedClass.getSchoolId())) {
			return null;
		}

		boolean currentlyInClass = userBelongsToClass(student, classId);
		if (!currentlyInClass) {
			for (Long teamId : directTeamIds) {
				if (userBelongsToClass(student, teamId)) {
					currentlyInClass = true;
					break;
				}
			}
		}
		if (!currentlyInClass) {
			return null;
		}

		if (student.getEnrollmentClassIds() == null) {
			student.setEnrollmentClassIds(new LinkedHashSet<Long>());
		}
		student.getEnrollmentClassIds().removeAll(directTeamIds);
		student.getEnrollmentClassIds().add(classId);
		if (targetTeamId != null) {
			student.getEnrollmentClassIds().add(targetTeamId);
		}

		if (student.getPerson() != null) {
			Integer primaryClassId = student.getPerson().getEnrollmentClassId();
			boolean primaryWasDirectTeam = primaryClassId != null
					&& directTeamIds.contains(primaryClassId.longValue());
			if (primaryWasDirectTeam || primaryClassId == null) {
				Long nextPrimaryId = targetTeamId == null ? classId : targetTeamId;
				if (nextPrimaryId.longValue() <= Integer.MAX_VALUE) {
					student.getPerson().setEnrollmentClassId(nextPrimaryId.intValue());
				}
			}
		}

		userRepository.save(student);
		for (EnrolmentClass team : directTeams) {
			if (!team.getId().equals(targetTeamId)) {
				team.getTeachers().removeIf(teacher -> student.getId().equals(teacher.getId()));
				if (student.getId().equals(team.getPrimaryTeacherId())) {
					team.setPrimaryTeacherId(null);
				}
			}
		}
		return getTeamBoard(classId);
	}

	@Override
	public EnrolmentClassDto saveScheduleSettings(Long classId, EnrolmentClassDto dto) {
		EnrolmentClass selectedClass = classId == null ? null : enrolmentClassRepository.findOne(classId);
		if (selectedClass == null || dto == null) {
			return null;
		}
		User currentUser = getCurrentUser();
		if (!canEditClass(currentUser, selectedClass)) {
			throw new AccessDeniedException("Bạn không được thiết lập lớp này.");
		}
		List<EnrolmentClassWeeklySessionDto> requestedSessions = dto.getWeeklySessions();
		if (requestedSessions == null) {
			return null;
		}
		List<EnrolmentClassWeeklySession> replacements = new ArrayList<EnrolmentClassWeeklySession>();
		Set<String> uniqueSessions = new HashSet<String>();
		int order = 0;
		for (EnrolmentClassWeeklySessionDto requested : requestedSessions) {
			if (requested == null || requested.getDayOfWeek() == null
					|| requested.getDayOfWeek() < 1 || requested.getDayOfWeek() > 7) {
				return null;
			}
			String startTime = normalizeTime(requested.getStartTime());
			String endTime = normalizeTime(requested.getEndTime());
			if (startTime == null || endTime == null || endTime.compareTo(startTime) <= 0) {
				return null;
			}
			String uniqueKey = requested.getDayOfWeek() + "|" + startTime + "|" + endTime;
			if (!uniqueSessions.add(uniqueKey)) {
				return null;
			}
			EnrolmentClassWeeklySession session = new EnrolmentClassWeeklySession();
			session.setEnrolmentClass(selectedClass);
			session.setDayOfWeek(requested.getDayOfWeek());
			session.setStartTime(startTime);
			session.setEndTime(endTime);
			session.setDisplayOrder(order++);
			session.setCreateDate(LocalDateTime.now());
			session.setCreatedBy(currentUser.getUsername());
			replacements.add(session);
		}

		List<EnrolmentClassWeeklySession> existing = weeklySessionRepository
				.findByEnrolmentClassIdOrderByDisplayOrderAscDayOfWeekAscStartTimeAsc(classId);
		weeklySessionRepository.delete(existing);
		weeklySessionRepository.flush();
		if (!replacements.isEmpty()) {
			weeklySessionRepository.save(replacements);
		}
		selectedClass.setStartTime(replacements.isEmpty() ? null : replacements.get(0).getStartTime());
		selectedClass.setEndTime(replacements.isEmpty() ? null : replacements.get(0).getEndTime());
		selectedClass.setModifiedBy(currentUser.getUsername());
		selectedClass.setModifyDate(LocalDateTime.now());
		enrolmentClassRepository.save(selectedClass);
		EnrolmentClassDto result = toDto(selectedClass, null, currentUser);
		result.setWeeklySessions(toWeeklySessionDtos(classId));
		return result;
	}

	@Override
	public List<EnrolmentClassScheduleDayDto> getScheduleDays(Long classId, String fromDate, String toDate) {
		EnrolmentClass selectedClass = classId == null ? null : enrolmentClassRepository.findOne(classId);
		if (selectedClass == null || !isValidDate(fromDate) || !isValidDate(toDate)
				|| fromDate.compareTo(toDate) > 0) {
			return new ArrayList<EnrolmentClassScheduleDayDto>();
		}
		User currentUser = getCurrentUser();
		if (!canViewClass(currentUser, selectedClass)) {
			throw new AccessDeniedException("Bạn không được xem lịch của lớp này.");
		}
		List<EnrolmentClassScheduleDayDto> result = new ArrayList<EnrolmentClassScheduleDayDto>();
		EffectiveClassSchedule timeline = effectiveSchedule(classId);
		for (EnrolmentClassScheduleDay day : scheduleDayRepository
				.findByEnrolmentClassIdAndScheduleDateBetweenOrderByScheduleDateAsc(classId, fromDate, toDate)) {
			result.add(canEditClass(currentUser, selectedClass) ? scheduleDayWithCompletion(day, timeline)
                    : new EnrolmentClassScheduleDayDto(day));
		}
		return result;
	}

    @Override
    public EnrolmentClassScheduleDayDto getPreviousScheduleDay(Long classId, String beforeDate) {
        if (!isValidDate(beforeDate)) {
            throw new EnrolmentClassScheduleException(HttpStatus.BAD_REQUEST, "Ngày kế hoạch không hợp lệ.");
        }
        EnrolmentClass selectedClass = classId == null ? null : enrolmentClassRepository.findOne(classId);
        if (selectedClass == null) { return null; }
        if (!canEditClass(getCurrentUser(), selectedClass)) {
            throw new AccessDeniedException("Bạn không được xem tiến độ học sinh lớp này.");
        }
        EffectiveClassSchedule timeline = effectiveSchedule(classId);
        EffectiveClassSchedule.Slot previous = timeline.previous(beforeDate);
        if (previous == null) { return null; }
        String previousDate = previous.date;
        EnrolmentClassScheduleDay saved = scheduleDayRepository.findByEnrolmentClassIdAndScheduleDate(classId, previousDate);
        if (saved != null) { return scheduleDayWithCompletion(saved, timeline); }
        // The preceding scheduled session has no saved plan: never reuse older progress.
        EnrolmentClassScheduleDayDto empty = new EnrolmentClassScheduleDayDto();
        empty.setEnrolmentClassId(classId);
        empty.setScheduleDate(previousDate);
        empty.setTasks(new ArrayList<EnrolmentClassScheduleTaskDto>());
        enrichScheduleDeadline(empty, timeline);
        return empty;
    }

    private EnrolmentClassScheduleDayDto scheduleDayWithCompletion(EnrolmentClassScheduleDay day) {
        return scheduleDayWithCompletion(day, effectiveSchedule(day.getEnrolmentClass().getId()));
    }

    private EnrolmentClassScheduleDayDto scheduleDayWithCompletion(EnrolmentClassScheduleDay day, EffectiveClassSchedule timeline) {
        EnrolmentClassScheduleDayDto dto = new EnrolmentClassScheduleDayDto(day);
        enrichScheduleDeadline(dto, timeline);
        if (day.getMovedToDate() != null) { return dto; }
        List<Long> topicIds = new ArrayList<Long>();
        for (EnrolmentClassScheduleTaskDto task : dto.getTasks()) {
            if (HomeworkTopicCompletion.enabled(task) && !topicIds.contains(task.getTopicId())) { topicIds.add(task.getTopicId()); }
        }
        if (topicIds.isEmpty()) { return dto; }
        Long classId = day.getEnrolmentClass().getId();
        List<Long> studentIds = new ArrayList<Long>();
        for (User student : scheduleStudentDomains(classId, getCurrentUser())) { studentIds.add(student.getId()); }
        if (studentIds.isEmpty()) { return dto; }
        java.time.LocalDate startDate = java.time.LocalDate.parse(day.getScheduleDate());
        if (day.getMovedFromDate() != null && day.getMovedFromDate().compareTo(day.getScheduleDate()) < 0) {
            startDate = java.time.LocalDate.parse(day.getMovedFromDate());
        }
        LocalDateTime start = HomeworkTopicCompletion.midnight(startDate), maximumEnd = start;
        Map<EnrolmentClassScheduleTaskDto, LocalDateTime> ends = new LinkedHashMap<EnrolmentClassScheduleTaskDto, LocalDateTime>();
        for (EnrolmentClassScheduleTaskDto task : dto.getTasks()) {
            if (!HomeworkTopicCompletion.enabled(task)) { continue; }
            LocalDateTime end = HomeworkTopicCompletion.deadlineEnd(task.getResolvedDueDate(), task.getResolvedDueTime());
            if (end == null || !end.isAfter(start)) { continue; }
            ends.put(task, end); if (end.isAfter(maximumEnd)) { maximumEnd = end; }
        }
        if (ends.isEmpty()) { return dto; }
        List<Object[]> completions = testResultRepository.findVocabularyCompletions(studentIds, topicIds, start,
                maximumEnd);
        for (Map.Entry<EnrolmentClassScheduleTaskDto, LocalDateTime> entry : ends.entrySet()) {
            HomeworkTopicCompletion.apply(entry.getKey(), completions, start, entry.getValue());
        }
        return dto;
    }

    private EffectiveClassSchedule effectiveSchedule(Long classId) {
        List<Object[]> weekly = new ArrayList<Object[]>();
        for (EnrolmentClassWeeklySession session : weeklySessionRepository.findByEnrolmentClassIdOrderByDisplayOrderAscDayOfWeekAscStartTimeAsc(classId)) {
            if (session.getDayOfWeek() != null) {
                weekly.add(new Object[] {session.getDayOfWeek(), session.getStartTime(), session.getEndTime()});
            }
        }
        return new EffectiveClassSchedule(weekly, scheduleDayRepository.findScheduleTimeline(classId));
    }

    private void enrichScheduleDeadline(EnrolmentClassScheduleDayDto dto, EffectiveClassSchedule timeline) {
        if (dto.getMovedToDate() != null) { return; }
        EffectiveClassSchedule.Slot current = timeline.on(dto.getScheduleDate()), next = timeline.next(dto.getScheduleDate());
        if (current != null) { dto.setSessionStartTime(current.startTime); dto.setSessionEndTime(current.endTime); }
        dto.setDefaultHomeworkDeadline(next == null ? null : next.deadline());
        if (dto.getTasks() == null) { return; }
        for (EnrolmentClassScheduleTaskDto task : dto.getTasks()) {
            if (HomeworkTopicCompletion.automaticDeadline(task)) {
                task.setResolvedDueDate(next == null || next.endTime == null ? null : next.date);
                task.setResolvedDueTime(next == null ? null : next.endTime);
            } else { task.setResolvedDueDate(task.getDueDate()); task.setResolvedDueTime(task.getDueTime()); }
        }
    }

    @Override
    public EnrolmentClassScheduleDayDto getScheduleSession(Long classId, String date) {
        EnrolmentClass selected = classId == null ? null : enrolmentClassRepository.findOne(classId);
        if (selected == null || !canEditClass(getCurrentUser(), selected)) {
            throw new AccessDeniedException("Bạn không được thiết lập lớp này.");
        }
        if (!isValidDate(date)) { throw new EnrolmentClassScheduleException(HttpStatus.BAD_REQUEST, "Ngày học không hợp lệ."); }
        EnrolmentClassScheduleDay saved = scheduleDayRepository.findByEnrolmentClassIdAndScheduleDate(classId, date);
        EffectiveClassSchedule timeline = effectiveSchedule(classId);
        if (saved != null) { return scheduleDayWithCompletion(saved, timeline); }
        EnrolmentClassScheduleDayDto dto = new EnrolmentClassScheduleDayDto();
        dto.setEnrolmentClassId(classId); dto.setScheduleDate(date); dto.setTasks(new ArrayList<EnrolmentClassScheduleTaskDto>());
        enrichScheduleDeadline(dto, timeline);
        return dto;
    }

    @Override
    public EnrolmentClassScheduleDayDto moveScheduleDay(Long classId, com.globits.richy.dto.EnrolmentClassScheduleMoveDto dto) {
        User teacher = getCurrentUser();
        EnrolmentClass selected = classId == null ? null : enrolmentClassRepository.findOne(classId);
        if (selected == null || !canEditClass(teacher, selected)) { throw new AccessDeniedException("Bạn không được dời buổi lớp này."); }
        if (dto == null || !isValidDate(dto.getFromDate()) || !isValidDate(dto.getToDate()) || dto.getFromDate().equals(dto.getToDate())) {
            throw new EnrolmentClassScheduleException(HttpStatus.BAD_REQUEST, "Chọn một ngày mới khác ngày học hiện tại.");
        }
        String start = normalizeTime(dto.getStartTime()), end = normalizeTime(dto.getEndTime());
        String reason = scheduleText(dto.getReason(), 1000, false);
        if (start == null || end == null || end.compareTo(start) <= 0) {
            throw new EnrolmentClassScheduleException(HttpStatus.BAD_REQUEST, "Giờ tan phải sau giờ học, định dạng HH:mm.");
        }
        EffectiveClassSchedule timeline = effectiveSchedule(classId);
        EnrolmentClassScheduleDay day = scheduleDayRepository.findByEnrolmentClassIdAndScheduleDate(classId, dto.getFromDate());
        if (timeline.cancelled(dto.getFromDate())) {
            throw new EnrolmentClassScheduleException(HttpStatus.CONFLICT, "Buổi đã được dời. Hãy tải lại lịch.");
        }
        if (day == null && (dto.getDayId() != null || timeline.on(dto.getFromDate()) == null)) {
            throw new EnrolmentClassScheduleException(HttpStatus.CONFLICT, "Không còn buổi học gốc. Hãy tải lại lịch.");
        }
        if (day != null && (dto.getDayId() == null || !dto.getDayId().equals(day.getId()) || dto.getDayVersion() == null
                || dto.getDayVersion().longValue() != day.getScheduleVersion())) {
            throw new EnrolmentClassScheduleException(HttpStatus.CONFLICT, "Kế hoạch đã thay đổi. Hãy tải lại trước khi dời.");
        }
        if ((day == null || day.getSessionStartTime() == null) && timeline.weeklyCount(dto.getFromDate()) > 1) {
            throw new EnrolmentClassScheduleException(HttpStatus.BAD_REQUEST,
                    "Ngày này có nhiều khung giờ nhưng dùng chung một kế hoạch. Chưa hỗ trợ dời riêng từng khung giờ.");
        }
        if (scheduleDayRepository.findByEnrolmentClassIdAndScheduleDate(classId, dto.getToDate()) != null
                || timeline.weeklyCount(dto.getToDate()) > 0) {
            throw new EnrolmentClassScheduleException(HttpStatus.CONFLICT, "Ngày mới đã có lịch hoặc kế hoạch. Hãy chọn ngày trống khác.");
        }
        java.time.LocalDate from = java.time.LocalDate.parse(dto.getFromDate()), to = java.time.LocalDate.parse(dto.getToDate());
        long shift = java.time.temporal.ChronoUnit.DAYS.between(from, to);
        // Validate shifted manual dates before mutating any managed child.
        Map<EnrolmentClassScheduleTask, String> shifted = new LinkedHashMap<EnrolmentClassScheduleTask, String>();
        if (day != null && dto.isShiftManualDeadlines()) {
            for (EnrolmentClassScheduleTask task : day.getTasks()) {
                if (task.getDueDate() == null || HomeworkTopicCompletion.automaticDeadline(new EnrolmentClassScheduleTaskDto(task))) { continue; }
                String date = java.time.LocalDate.parse(task.getDueDate()).plusDays(shift).toString();
                if (!isValidDate(date) || date.compareTo(dto.getToDate()) < 0) {
                    throw new EnrolmentClassScheduleException(HttpStatus.BAD_REQUEST, "Hạn nhập tay sau khi dịch không hợp lệ; hãy giữ nguyên hạn hoặc sửa trước.");
                }
                shifted.put(task, date);
            }
        }
        if (day == null) {
            day = new EnrolmentClassScheduleDay(); day.setEnrolmentClass(selected);
            day.setCreateDate(LocalDateTime.now()); day.setCreatedBy(teacher.getUsername());
        }
        if (day.getMovedFromDate() == null || dto.getFromDate().compareTo(day.getMovedFromDate()) < 0) { day.setMovedFromDate(dto.getFromDate()); }
        day.setScheduleDate(dto.getToDate()); day.setSessionStartTime(start); day.setSessionEndTime(end); day.setMoveReason(reason);
        for (Map.Entry<EnrolmentClassScheduleTask, String> entry : shifted.entrySet()) { entry.getKey().setDueDate(entry.getValue()); }
        day.setModifyDate(LocalDateTime.now()); day.setModifiedBy(teacher.getUsername());
        try {
            day = scheduleDayRepository.saveAndFlush(day);
            // Chain moves retain all old source markers, each pointing to the current live date.
            for (EnrolmentClassScheduleDay marker : scheduleDayRepository.findByEnrolmentClassIdAndMovedDayId(classId, day.getId())) {
                marker.setMovedToDate(dto.getToDate()); marker.setModifyDate(LocalDateTime.now()); marker.setModifiedBy(teacher.getUsername());
                scheduleDayRepository.save(marker);
            }
            EnrolmentClassScheduleDay marker = new EnrolmentClassScheduleDay();
            marker.setEnrolmentClass(selected); marker.setScheduleDate(dto.getFromDate()); marker.setMovedToDate(dto.getToDate());
            marker.setMovedDayId(day.getId()); marker.setMoveReason(reason);
            marker.setCreateDate(LocalDateTime.now()); marker.setCreatedBy(teacher.getUsername());
            scheduleDayRepository.saveAndFlush(marker);
        } catch (org.springframework.dao.OptimisticLockingFailureException error) {
            throw new EnrolmentClassScheduleException(HttpStatus.CONFLICT, "Lịch vừa thay đổi. Hãy tải lại trước khi dời.");
        } catch (org.springframework.dao.DataIntegrityViolationException error) {
            throw new EnrolmentClassScheduleException(HttpStatus.CONFLICT, "Ngày mới vừa được sử dụng. Không dời và không ghi đè kế hoạch.");
        }
        return scheduleDayWithCompletion(day);
    }

	@Override
	public EnrolmentClassScheduleDayDto saveScheduleDay(Long classId, EnrolmentClassScheduleDayDto dto) {
		EnrolmentClass selectedClass = classId == null ? null : enrolmentClassRepository.findOne(classId);
		if (selectedClass == null || dto == null || !isValidDate(dto.getScheduleDate())) {
			return null;
		}
		User currentUser = getCurrentUser();
		if (!canEditClass(currentUser, selectedClass)) {
			throw new AccessDeniedException("Bạn không được sửa lịch của lớp này.");
		}

		Set<Topic> classTopics = loadTopics(dto.getClassTopicIds());
		Set<Topic> homeworkTopics = loadTopics(dto.getHomeworkTopicIds());
		if (classTopics == null || homeworkTopics == null) {
			return null;
		}

		EnrolmentClassScheduleDay domain = scheduleDayRepository
				.findByEnrolmentClassIdAndScheduleDate(classId, dto.getScheduleDate());
        if (domain != null && domain.getMovedToDate() != null) {
            throw new EnrolmentClassScheduleException(HttpStatus.CONFLICT, "Buổi này đã dời sang " + domain.getMovedToDate() + ". Hãy tải lại lịch.");
        }
		if (domain != null && dto.getTasks() != null &&
				(dto.getVersion() == null || dto.getVersion().longValue() != domain.getScheduleVersion())) {
			throw new EnrolmentClassScheduleException(HttpStatus.CONFLICT,
					"Kế hoạch đã được người khác cập nhật. Hãy tải lại lịch trước khi lưu.");
		}
		if (domain == null && dto.getId() != null) {
			throw new EnrolmentClassScheduleException(HttpStatus.CONFLICT, "Ngày học đã thay đổi. Hãy tải lại lịch.");
		}
		String classNotes = scheduleText(dto.getClassNotes(), 4000, false);
		String homeworkNotes = scheduleText(dto.getHomeworkNotes(), 4000, false);
		if (dto.getTasks() != null) {
			for (EnrolmentClassScheduleTaskDto task : dto.getTasks()) {
				if (task != null && task.getId() == null && !Boolean.TRUE.equals(task.getDeadlineAutomatic())
                        && task.getDueDate() != null && !task.getDueDate().isEmpty()
						&& task.getDueDate().compareTo(dto.getScheduleDate()) < 0) {
					throw new EnrolmentClassScheduleException(HttpStatus.BAD_REQUEST, "Hạn hoàn thành không được trước ngày giao bài.");
				}
			}
		}
		/* Validate every task before changing any managed entity. */
        if (dto.getTasks() != null) {
            EffectiveClassSchedule.Slot next = effectiveSchedule(classId).next(dto.getScheduleDate());
            for (EnrolmentClassScheduleTaskDto task : dto.getTasks()) {
                if (task != null && Boolean.TRUE.equals(task.getDeadlineAutomatic()) && (next == null || next.endTime == null)) {
                    throw new EnrolmentClassScheduleException(HttpStatus.BAD_REQUEST, "Chưa có giờ tan của buổi kế tiếp. Hãy thiết lập lịch hoặc nhập hạn thủ công.");
                }
            }
        }
		List<EnrolmentClassScheduleTask> preparedTasks = dto.getTasks() == null ? null
				: prepareScheduleTasks(classId, domain, dto.getTasks());
		if (domain == null) {
			domain = new EnrolmentClassScheduleDay();
			domain.setEnrolmentClass(selectedClass);
			domain.setScheduleDate(dto.getScheduleDate());
			domain.setCreateDate(LocalDateTime.now());
			domain.setCreatedBy(currentUser.getUsername());
		} else {
			domain.setModifyDate(LocalDateTime.now());
			domain.setModifiedBy(currentUser.getUsername());
		}
		domain.setClassTopics(classTopics);
		domain.setHomeworkTopics(homeworkTopics);
		if (dto.getClassNotes() != null) { domain.setClassNotes(classNotes); }
		if (dto.getHomeworkNotes() != null) { domain.setHomeworkNotes(homeworkNotes); }
		if (preparedTasks != null) {
			Map<Long, EnrolmentClassScheduleTask> oldTasks = new LinkedHashMap<Long, EnrolmentClassScheduleTask>();
			for (EnrolmentClassScheduleTask task : domain.getTasks()) { oldTasks.put(task.getId(), task); }
			List<EnrolmentClassScheduleTask> nextTasks = new ArrayList<EnrolmentClassScheduleTask>();
			for (EnrolmentClassScheduleTask prepared : preparedTasks) {
				EnrolmentClassScheduleTask task = prepared.getId() == null ? prepared : oldTasks.get(prepared.getId());
				if (task.getId() == null) {
					task.setCreateDate(LocalDateTime.now()); task.setCreatedBy(currentUser.getUsername());
				} else {
					task.setModifyDate(LocalDateTime.now()); task.setModifiedBy(currentUser.getUsername());
				}
				task.setScheduleDay(domain); task.setSection(prepared.getSection()); task.setTitle(prepared.getTitle());
				task.setNotes(prepared.getNotes()); task.setDueDate(prepared.getDueDate()); task.setStatus(prepared.getStatus());
                task.setDueTime(prepared.getDueTime()); task.setDeadlineAutomatic(prepared.getDeadlineAutomatic());
				task.setTopic(prepared.getTopic()); task.setDisplayOrder(prepared.getDisplayOrder());
				task.setAutoCompleteFromTopic(prepared.getAutoCompleteFromTopic());
				if (task != prepared) {
					task.getStudentProgress().clear(); task.getStudentProgress().addAll(prepared.getStudentProgress());
				}
				nextTasks.add(task);
			}
			domain.getTasks().retainAll(nextTasks);
			for (EnrolmentClassScheduleTask task : nextTasks) {
				if (!domain.getTasks().contains(task)) { domain.getTasks().add(task); }
			}
		}
		/* Force the day row to change when only child tasks/progress changed. */
		domain.setModifyDate(LocalDateTime.now());
		domain = scheduleDayRepository.saveAndFlush(domain);
		return scheduleDayWithCompletion(domain);
	}

	@Override
	public List<UserDto> getScheduleStudents(Long classId) {
		EnrolmentClass selectedClass = classId == null ? null : enrolmentClassRepository.findOne(classId);
		User currentUser = getCurrentUser();
		if (selectedClass == null || !canEditClass(currentUser, selectedClass)) {
			throw new AccessDeniedException("Bạn không được quản lý bài tập của lớp này.");
		}
		List<UserDto> result = new ArrayList<UserDto>();
		for (User student : scheduleStudentDomains(classId, currentUser)) { result.add(new UserDto(student, true)); }
		return result;
	}

    @Override
    public EnrolmentClassScheduleDayDto updateTaskProgress(Long classId, Long dayId, Long taskId,
            com.globits.richy.dto.EnrolmentClassTaskProgressUpdateDto dto) {
        User teacher = getCurrentUser();
        EnrolmentClass selectedClass = classId == null ? null : enrolmentClassRepository.findOne(classId);
        if (selectedClass == null || !canEditClass(teacher, selectedClass)) {
            throw new AccessDeniedException("Bạn không được sửa tiến độ lớp này.");
        }
        EnrolmentClassScheduleDay day = dayId == null ? null : scheduleDayRepository.findOne(dayId);
        if (day == null || !classId.equals(day.getEnrolmentClass().getId())) {
            throw new EnrolmentClassScheduleException(HttpStatus.BAD_REQUEST, "Ngày học không thuộc lớp này.");
        }
        if (dto == null || dto.getDayVersion() == null || dto.getDayVersion().longValue() != day.getScheduleVersion()) {
            throw new EnrolmentClassScheduleException(HttpStatus.CONFLICT, "Tiến độ đã thay đổi. Hãy tải lại bảng trước khi sửa.");
        }
        if (dto.getStudentUserId() == null || !Arrays.asList("UNRECORDED", "TODO", "DONE", "NEEDS_REVIEW",
                "PROGRESS_10", "PROGRESS_20", "PROGRESS_30", "PROGRESS_40", "PROGRESS_50",
                "PROGRESS_60", "PROGRESS_70", "PROGRESS_80", "PROGRESS_90").contains(dto.getStatus())) {
            throw new EnrolmentClassScheduleException(HttpStatus.BAD_REQUEST, "Học sinh hoặc trạng thái không hợp lệ.");
        }
        String notes = scheduleText(dto.getNotes(), 1000, false);
        EnrolmentClassScheduleTask task = null;
        for (EnrolmentClassScheduleTask candidate : day.getTasks()) {
            if (taskId != null && taskId.equals(candidate.getId())) { task = candidate; break; }
        }
        if (task == null || !"HOMEWORK".equals(task.getSection())) {
            throw new EnrolmentClassScheduleException(HttpStatus.BAD_REQUEST, "Homework task không thuộc ngày này.");
        }
        EnrolmentClassTaskProgress progress = null;
        for (EnrolmentClassTaskProgress entry : task.getStudentProgress()) {
            if (dto.getStudentUserId().equals(entry.getStudentUserId())) { progress = entry; break; }
        }
        boolean member = progress != null; // Permit feedback on historical students with existing progress.
        if (!member) {
            for (User student : scheduleStudentDomains(classId, teacher)) {
                if (dto.getStudentUserId().equals(student.getId())) { member = true; break; }
            }
        }
        if (!member) { throw new AccessDeniedException("Học sinh không thuộc lớp này."); }
        if (progress == null) {
            progress = new EnrolmentClassTaskProgress(); progress.setStudentUserId(dto.getStudentUserId());
            task.getStudentProgress().add(progress);
        }
        progress.setStatus(dto.getStatus()); progress.setNotes(notes);
        LocalDateTime now = LocalDateTime.now();
        task.setModifyDate(now); task.setModifiedBy(teacher.getUsername());
        day.setModifyDate(now); day.setModifiedBy(teacher.getUsername());
        try { day = scheduleDayRepository.saveAndFlush(day); }
        catch (org.springframework.dao.OptimisticLockingFailureException error) {
            throw new EnrolmentClassScheduleException(HttpStatus.CONFLICT, "Kế hoạch vừa được cập nhật. Hãy tải lại bảng.");
        }
        return scheduleDayWithCompletion(day);
    }

	private List<User> scheduleStudentDomains(Long classId, User currentUser) {
		EnrolmentClass selectedClass = enrolmentClassRepository.findOne(classId);
		if (selectedClass == null || !canViewClass(currentUser, selectedClass)) { return new ArrayList<User>(); }
		List<Long> visibleIds = new ArrayList<Long>();
		for (Long id : getClassAndDescendantIds(classId)) {
			EnrolmentClass item = enrolmentClassRepository.findOne(id);
			if (item != null && selectedClass.getSchoolId().equals(item.getSchoolId())
                    && canViewClass(currentUser, item)) { visibleIds.add(id); }
		}
		return getClassStudents(visibleIds, selectedClass.getSchoolId());
	}

    private boolean isClassStudent(User user, Integer schoolId) {
        if (user == null || !Boolean.TRUE.equals(user.getActive())) { return false; }
        if (HIDDEN_SCHOOL_ID.equals(schoolId)) { return hasRole(user, ROLE_VIEWER); }
        return EDUCATION_MANAGER_SCHOOL_ID.equals(schoolId)
                && hasRole(user, "ROLE_STUDENT") && !hasRole(user, ROLE_VIEWER);
    }

    private List<User> getClassStudents(List<Long> classIds, Integer schoolId) {
        List<User> result = new ArrayList<User>();
        if (classIds == null || classIds.isEmpty()) { return result; }
        Set<Long> seen = new HashSet<Long>();
        for (User user : userRepository.getUsersByEnrollmentClassIds(classIds)) {
            if (isClassStudent(user, schoolId) && user.getId() != null && seen.add(user.getId())) {
                result.add(user);
            }
        }
        return result;
    }

	private String scheduleText(String value, int limit, boolean required) {
		String text = value == null ? "" : value.trim();
		if ((required && text.isEmpty()) || text.length() > limit) {
			throw new EnrolmentClassScheduleException(HttpStatus.BAD_REQUEST,
					"Nội dung task không hợp lệ hoặc vượt giới hạn " + limit + " ký tự.");
		}
		return text;
	}

	private List<EnrolmentClassScheduleTask> prepareScheduleTasks(Long classId,
			EnrolmentClassScheduleDay day, List<EnrolmentClassScheduleTaskDto> values) {
		if (values.size() > 100) {
			throw new EnrolmentClassScheduleException(HttpStatus.BAD_REQUEST, "Tối đa 100 tasks cho một ngày.");
		}
		Map<Long, EnrolmentClassScheduleTask> oldTasks = new LinkedHashMap<Long, EnrolmentClassScheduleTask>();
		if (day != null) { for (EnrolmentClassScheduleTask task : day.getTasks()) { oldTasks.put(task.getId(), task); } }
		Set<Long> studentIds = new HashSet<Long>();
		boolean hasProgress = false;
		for (EnrolmentClassScheduleTaskDto value : values) {
			if (value != null && value.getStudentProgress() != null && !value.getStudentProgress().isEmpty()) { hasProgress = true; }
		}
		if (hasProgress) {
			for (User student : scheduleStudentDomains(classId, getCurrentUser())) { studentIds.add(student.getId()); }
		}
		List<EnrolmentClassScheduleTask> result = new ArrayList<EnrolmentClassScheduleTask>();
		Set<Long> usedTaskIds = new HashSet<Long>();
		int progressCount = 0;
		for (EnrolmentClassScheduleTaskDto value : values) {
			if (value == null || !Arrays.asList("CLASS", "HOMEWORK").contains(value.getSection()) ||
					!Arrays.asList("TODO", "IN_PROGRESS", "DONE").contains(value.getStatus())) {
				throw new EnrolmentClassScheduleException(HttpStatus.BAD_REQUEST, "Loại hoặc trạng thái task không hợp lệ.");
			}
			if (value.getId() != null && (!oldTasks.containsKey(value.getId()) || !usedTaskIds.add(value.getId()))) {
				throw new EnrolmentClassScheduleException(HttpStatus.BAD_REQUEST, "Task không thuộc ngày/lớp này hoặc bị trùng.");
			}
			EnrolmentClassScheduleTask task = new EnrolmentClassScheduleTask();
			task.setId(value.getId()); task.setSection(value.getSection()); task.setStatus(value.getStatus());
			task.setTitle(scheduleText(value.getTitle(), 200, true)); task.setNotes(scheduleText(value.getNotes(), 4000, false));
			String dueDate = scheduleText(value.getDueDate(), 10, false);
            EnrolmentClassScheduleTask oldTask = value.getId() == null ? null : oldTasks.get(value.getId());
            Boolean automatic = value.getDeadlineAutomatic() == null && oldTask != null
                    ? oldTask.getDeadlineAutomatic() : value.getDeadlineAutomatic();
            String dueTime = Boolean.TRUE.equals(automatic) ? "" : scheduleText(value.getDueTime() == null && oldTask != null
                    && dueDate.equals(oldTask.getDueDate()) ? oldTask.getDueTime() : value.getDueTime(), 5, false);
            if (!dueTime.isEmpty() && (normalizeTime(dueTime) == null || dueDate.isEmpty())) {
                throw new EnrolmentClassScheduleException(HttpStatus.BAD_REQUEST, "Hạn hoàn thành cần ngày và giờ HH:mm hợp lệ.");
            }
            if (Boolean.TRUE.equals(automatic) && !"HOMEWORK".equals(value.getSection())) {
                throw new EnrolmentClassScheduleException(HttpStatus.BAD_REQUEST, "Chỉ Homework có hạn tự động theo buổi kế tiếp.");
            }
			if (!dueDate.isEmpty() && !isValidDate(dueDate)) {
				throw new EnrolmentClassScheduleException(HttpStatus.BAD_REQUEST, "Hạn hoàn thành không hợp lệ.");
			}
			task.setDueDate(Boolean.TRUE.equals(automatic) || dueDate.isEmpty() ? null : dueDate);
            task.setDueTime(Boolean.TRUE.equals(automatic) || dueTime.isEmpty() ? null : dueTime);
            task.setDeadlineAutomatic(automatic);
            String assignedDate = day == null ? null : day.getScheduleDate();
            if (oldTask != null && day.getMovedFromDate() != null && day.getMovedFromDate().compareTo(assignedDate) < 0) { assignedDate = day.getMovedFromDate(); }
			if (!Boolean.TRUE.equals(automatic) && !dueDate.isEmpty() && assignedDate != null && dueDate.compareTo(assignedDate) < 0) {
				throw new EnrolmentClassScheduleException(HttpStatus.BAD_REQUEST, "Hạn hoàn thành không được trước ngày giao bài.");
			}
			task.setAutoCompleteFromTopic(value.getAutoCompleteFromTopic() == null && value.getId() != null
					? oldTasks.get(value.getId()).getAutoCompleteFromTopic() : value.getAutoCompleteFromTopic());
			if (value.getTopicId() != null) {
				Topic topic = topicRepository.findOne(value.getTopicId());
				if (topic == null) { throw new EnrolmentClassScheduleException(HttpStatus.BAD_REQUEST, "Topic không còn tồn tại."); }
				task.setTopic(topic);
			}
			task.setDisplayOrder(result.size());
			Set<Long> allowedStudentIds = new HashSet<Long>(studentIds);
			/* Preserve historical progress when a student later leaves this class. */
			if (value.getId() != null) {
				for (EnrolmentClassTaskProgress old : oldTasks.get(value.getId()).getStudentProgress()) { allowedStudentIds.add(old.getStudentUserId()); }
			}
			Set<Long> seenStudents = new HashSet<Long>();
			if (value.getStudentProgress() != null) {
				for (EnrolmentClassTaskProgressDto entry : value.getStudentProgress()) {
					// Automatic status is recomputed from TestResult, never stored as teacher feedback.
					if (entry != null && entry.isAutomatic()) { continue; }
					if (++progressCount > 5000 || entry == null || entry.getStudentUserId() == null ||
							!allowedStudentIds.contains(entry.getStudentUserId()) || !seenStudents.add(entry.getStudentUserId()) ||
							!Arrays.asList("UNRECORDED", "TODO", "DONE", "NEEDS_REVIEW",
                                "PROGRESS_10", "PROGRESS_20", "PROGRESS_30", "PROGRESS_40", "PROGRESS_50",
                                "PROGRESS_60", "PROGRESS_70", "PROGRESS_80", "PROGRESS_90").contains(entry.getStatus())) {
						throw new EnrolmentClassScheduleException(HttpStatus.BAD_REQUEST, "Tiến độ học sinh không hợp lệ hoặc vượt giới hạn.");
					}
					EnrolmentClassTaskProgress progress = new EnrolmentClassTaskProgress();
					progress.setStudentUserId(entry.getStudentUserId()); progress.setStatus(entry.getStatus());
					progress.setNotes(scheduleText(entry.getNotes(), 1000, false)); task.getStudentProgress().add(progress);
				}
			}
			result.add(task);
		}
		return result;
	}

	@Override
	public List<TopicForListAllDto> getScheduleTopics() {
		List<TopicForListAllDto> topics = topicRepository.getAllTopics();
		Collections.sort(topics, new Comparator<TopicForListAllDto>() {
			@Override
			public int compare(TopicForListAllDto first, TopicForListAllDto second) {
				String a = first == null || first.getName() == null ? "" : first.getName();
				String b = second == null || second.getName() == null ? "" : second.getName();
				return a.compareToIgnoreCase(b);
			}
		});
		return topics;
	}

	private Set<Topic> loadTopics(List<Long> topicIds) {
		Set<Topic> result = new LinkedHashSet<Topic>();
		if (topicIds == null) {
			return result;
		}
		for (Long topicId : new LinkedHashSet<Long>(topicIds)) {
			Topic topic = topicId == null ? null : topicRepository.findOne(topicId);
			if (topic == null) {
				return null;
			}
			result.add(topic);
		}
		return result;
	}

	private List<EnrolmentClassWeeklySessionDto> toWeeklySessionDtos(Long classId) {
		List<EnrolmentClassWeeklySessionDto> result = new ArrayList<EnrolmentClassWeeklySessionDto>();
		for (EnrolmentClassWeeklySession session : weeklySessionRepository
				.findByEnrolmentClassIdOrderByDisplayOrderAscDayOfWeekAscStartTimeAsc(classId)) {
			result.add(new EnrolmentClassWeeklySessionDto(session));
		}
		return result;
	}

	private String normalizeTime(String value) {
		if (value == null || value.trim().isEmpty()) {
			return null;
		}
		String normalized = value.trim();
		if (!normalized.matches("(?:[01]\\d|2[0-3]):[0-5]\\d")) {
			return null;
		}
		return normalized;
	}

	private boolean isValidDate(String value) {
		if (value == null || !value.matches("\\d{4}-\\d{2}-\\d{2}")) {
			return false;
		}
		SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd");
		format.setLenient(false);
		ParsePosition position = new ParsePosition(0);
		return format.parse(value, position) != null && position.getIndex() == value.length();
	}

	private EnrolmentClassDto toDto(
			EnrolmentClass domain,
			Map<Long, Integer> childCounts,
			User currentUser) {
		EnrolmentClassDto dto = new EnrolmentClassDto(domain);
		if (domain.getParent() != null && (!domain.getSchoolId().equals(domain.getParent().getSchoolId())
                || !canViewClass(currentUser, domain.getParent()))) {
			dto.setParentId(null);
			dto.setParentName(null);
		}
		if (childCounts != null && childCounts.containsKey(domain.getId())) {
			dto.setChildCount(childCounts.get(domain.getId()));
		}
		dto.setCanManageTeams(canManageTeams(currentUser, domain));
		boolean canEdit = canEditClass(currentUser, domain);
		dto.setCanEdit(canEdit);
		dto.setCanAddChild(canEdit);
		return dto;
	}

	private void sortClasses(List<EnrolmentClass> classes) {
		Collections.sort(classes, new Comparator<EnrolmentClass>() {
			@Override
			public int compare(EnrolmentClass first, EnrolmentClass second) {
				String a = first.getName() == null ? "" : first.getName();
				String b = second.getName() == null ? "" : second.getName();
				return a.compareToIgnoreCase(b);
			}
		});
	}

	private String studentDisplayName(User student) {
		if (student != null && student.getPerson() != null) {
			String lastName = student.getPerson().getLastName() == null ? "" : student.getPerson().getLastName();
			String firstName = student.getPerson().getFirstName() == null ? "" : student.getPerson().getFirstName();
			String fullName = normalizeNameSpacing(lastName + " " + firstName);
			if (!fullName.isEmpty()) {
				return fullName;
			}

			String displayName = student.getPerson().getDisplayName();
			if (displayName != null && !displayName.trim().isEmpty()) {
				return normalizeNameSpacing(displayName);
			}
		}
		return student == null || student.getUsername() == null ? "" : student.getUsername();
	}

	private String studentNameSortKey(User student) {
		if (student == null || student.getPerson() == null) {
			return "";
		}

		String lastName = normalizeVietnameseText(student.getPerson().getLastName());
		String firstName = removeNameNote(student.getPerson().getFirstName());
		String fullName = normalizeVietnameseText(lastName + " " + firstName);
		if (fullName.isEmpty()) {
			return "";
		}

		String[] nameParts = fullName.split(" ");
		StringBuilder sortKey = new StringBuilder();
		for (int index = nameParts.length - 1; index >= 0; index--) {
			if (nameParts[index].isEmpty()) {
				continue;
			}
			if (sortKey.length() > 0) {
				sortKey.append('|');
			}
			sortKey.append(nameParts[index]);
		}
		return sortKey.toString();
	}

	private String normalizeVietnameseText(String value) {
		String text = normalizeNameSpacing(value).toLowerCase(Locale.ROOT);
		return Normalizer.normalize(text, Normalizer.Form.NFC);
	}

	private String normalizeNameSpacing(String value) {
		return value == null ? "" : value.replaceAll("\\s+", " ").trim();
	}

	private String removeNameNote(String value) {
		String text = normalizeVietnameseText(value);
		String oldText;
		do {
			oldText = text;
			text = text
					.replaceAll("\\s*\\([^()]*\\)\\s*$", "")
					.replaceAll("\\s*\\[[^\\[\\]]*\\]\\s*$", "")
					.trim();
		} while (!text.equals(oldText));
		return text;
	}

	private String studentUsername(User student) {
		return student == null || student.getUsername() == null
				? ""
				: student.getUsername().toLowerCase(Locale.ROOT);
	}

	private boolean userBelongsToClass(User user, Long classId) {
		if (user == null || classId == null) {
			return false;
		}
		if (user.getPerson() != null
				&& user.getPerson().getEnrollmentClassId() != null
				&& classId.equals(user.getPerson().getEnrollmentClassId().longValue())) {
			return true;
		}
		return user.getEnrollmentClassIds() != null && user.getEnrollmentClassIds().contains(classId);
	}

	private User getCurrentUser() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication == null || authentication.getName() == null) {
			return null;
		}
		return userRepository.findByUsername(authentication.getName());
	}

	private boolean canManageTeams(User user, EnrolmentClass selectedClass) {
		if (!canViewClass(user, selectedClass)) {
			return false;
		}
		if (hasRole(user, ROLE_ADMIN)) {
			return true;
		}
		if (hasRole(user, ROLE_EDUCATION_MANAGERMENT)
				&& EDUCATION_MANAGER_SCHOOL_ID.equals(selectedClass.getSchoolId())) {
			return true;
		}
		return isAssignedResponsibleForClassOrAncestor(user, selectedClass)
				&& isTeacherCandidate(user);
	}

	private boolean canViewClass(User user, EnrolmentClass selectedClass) {
		return selectedClass != null && canViewSchool(user, selectedClass.getSchoolId());
	}

    private boolean canViewSchool(User user, Integer schoolId) {
        if (user == null || schoolId == null) { return false; }
        boolean manager = hasRole(user, ROLE_ADMIN) || hasRole(user, ROLE_EDUCATION_MANAGERMENT)
                || hasRole(user, ROLE_STUDENT_MANAGERMENT) || hasRole(user, "ROLE_STAFF")
                || hasRole(user, "ROLE_STAFF_MANAGEMENT");
        if (HIDDEN_SCHOOL_ID.equals(schoolId)) {
            if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes)) { return false; }
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            return "ieltsroom.com".equalsIgnoreCase(attributes.getRequest().getServerName())
                    && (manager || hasRole(user, ROLE_VIEWER));
        }
        return EDUCATION_MANAGER_SCHOOL_ID.equals(schoolId) && (manager || !hasRole(user, ROLE_VIEWER));
    }

	private boolean canEditClass(User user, EnrolmentClass selectedClass) {
		if (!canViewClass(user, selectedClass)) {
			return false;
		}
		if (hasRole(user, ROLE_ADMIN)) {
			return true;
		}
		if (hasRole(user, ROLE_EDUCATION_MANAGERMENT)
				&& EDUCATION_MANAGER_SCHOOL_ID.equals(selectedClass.getSchoolId())) {
			return true;
		}
		return hasRole(user, ROLE_STUDENT_MANAGERMENT)
				&& isAssignedResponsibleForClassOrAncestor(user, selectedClass);
	}

	private boolean canCreateRootClass(User user) {
		return hasRole(user, ROLE_ADMIN) || hasRole(user, ROLE_EDUCATION_MANAGERMENT);
	}

	private boolean canEditAnyDirectChild(User user, Long parentClassId) {
		if (user == null || parentClassId == null) {
			return false;
		}
		for (EnrolmentClass child : enrolmentClassRepository.findByParentId(parentClassId)) {
			if (canEditClass(user, child)) {
				return true;
			}
		}
		return false;
	}

	private boolean isAssignedResponsibleForClassOrAncestor(
			User user,
			EnrolmentClass selectedClass) {
		if (user == null || user.getId() == null || selectedClass == null) {
			return false;
		}
		Set<Long> visited = new HashSet<Long>();
		EnrolmentClass current = selectedClass;
		while (current != null && visited.add(current.getId())) {
			if (current.getTeachers() != null) {
				for (User teacher : current.getTeachers()) {
					if (teacher != null
							&& user.getId().equals(teacher.getId())) {
						return true;
					}
				}
			}
			current = current.getParent();
		}
		return false;
	}

	private boolean sameClass(EnrolmentClass first, EnrolmentClass second) {
		if (first == null || second == null) {
			return first == second;
		}
		return first.getId() != null && first.getId().equals(second.getId());
	}

	private boolean hasRole(User user, String roleName) {
		if (user == null || user.getRoles() == null) {
			return false;
		}
		for (Role role : user.getRoles()) {
			if (role != null && roleName.equals(role.getName())) {
				return true;
			}
		}
		return false;
	}

	private boolean createsCycle(EnrolmentClass domain, EnrolmentClass proposedParent) {
		if (domain == null || domain.getId() == null) {
			return false;
		}
		Set<Long> visited = new HashSet<Long>();
		EnrolmentClass current = proposedParent;
		while (current != null && visited.add(current.getId())) {
			if (domain.getId().equals(current.getId())) {
				return true;
			}
			current = current.getParent();
		}
		return false;
	}

	private boolean isTeacherCandidate(User user) {
		if (user.getRoles() == null) {
			return false;
		}
		for (Role role : user.getRoles()) {
			if (role != null && TEACHER_ROLE_NAMES.contains(role.getName())) {
				return true;
			}
		}
		return false;
	}

	private boolean isStudentResponsibleCandidate(User user, Set<Long> allowedClassIds) {
		if (!hasRole(user, "ROLE_STUDENT") || allowedClassIds == null || allowedClassIds.isEmpty()) {
			return false;
		}
		for (Long classId : allowedClassIds) {
			if (userBelongsToClass(user, classId)) {
				return true;
			}
		}
		return false;
	}

}
