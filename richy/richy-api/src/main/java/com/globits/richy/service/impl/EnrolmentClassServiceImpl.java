package com.globits.richy.service.impl;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.Set;

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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.globits.richy.domain.EnrolmentClass;
import com.globits.richy.dto.EnrolmentClassDto;
import com.globits.richy.dto.EnrolmentClassMoveStudentDto;
import com.globits.richy.dto.EnrolmentClassTeamBoardDto;
import com.globits.richy.dto.EnrolmentClassTeamDto;
import com.globits.richy.repository.EnrolmentClassRepository;
import com.globits.richy.service.EnrolmentClassService;
import com.globits.security.domain.Role;
import com.globits.security.domain.User;
import com.globits.security.dto.UserDto;
import com.globits.security.repository.UserRepository;

@Service
@Transactional
public class EnrolmentClassServiceImpl implements EnrolmentClassService {
	@Autowired
	EntityManager manager;
	@Autowired
	EnrolmentClassRepository enrolmentClassRepository;
	@Autowired
	UserRepository userRepository;

	private static final List<String> TEACHER_ROLE_NAMES = Arrays.asList(
			"ROLE_ADMIN",
			"ROLE_EDUCATION_MANAGERMENT",
			"ROLE_STUDENT_MANAGERMENT",
			"ROLE_STAFF");

	private static final List<String> ALL_CLASS_TEAM_MANAGER_ROLES = Arrays.asList(
			"ROLE_ADMIN",
			"ROLE_EDUCATION_MANAGERMENT",
			"ROLE_STUDENT_MANAGERMENT");

	@Override
	public Page<EnrolmentClassDto> getPageObject(EnrolmentClassDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto == null ? null : searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.EnrolmentClassDto(s) from EnrolmentClass s where (1=1)";
		String sqlCount = "select count(s.id) from EnrolmentClass s where (1=1)";
		String whereClause = "";

		if (textSearch != null && textSearch.length() > 0) {
			whereClause += " and (lower(s.name) like :textSearch or lower(s.code) like :textSearch)";
		}

		sql += whereClause;
		sqlCount += whereClause;

		Query q = manager.createQuery(sql, EnrolmentClassDto.class);
		Query qCount = manager.createQuery(sqlCount);

		if (textSearch != null && textSearch.length() > 0) {
			q.setParameter("textSearch", '%' + textSearch.trim().toLowerCase() + '%');
			qCount.setParameter("textSearch", '%' + textSearch.trim().toLowerCase() + '%');
		}

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<EnrolmentClassDto> page = new PageImpl<EnrolmentClassDto>(q.getResultList(), pageable, numberResult);
		return page;
	}

	@Override
	public List<EnrolmentClassDto> getListObject(EnrolmentClassDto searchDto, int pageIndex, int pageSize) {
		return getPageObject(searchDto, pageIndex, pageSize).getContent();
	}

	@Override
	public EnrolmentClassDto getObjectById(Long id) {
		EnrolmentClass domain = id == null ? null : enrolmentClassRepository.findOne(id);
		return domain == null ? null : toDto(domain, null, getCurrentUser());
	}

	@Override
	public boolean saveObject(EnrolmentClassDto dto) {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User modifiedUser = null;
		LocalDateTime currentDate = LocalDateTime.now();
		String currentUserName = "Unknown User";
		if (authentication != null) {
			modifiedUser = (User) authentication.getPrincipal();
			currentUserName = modifiedUser.getUsername();
		}
		if(dto == null || dto.getName() == null || dto.getName().trim().isEmpty()) {
			return false;
		}
		EnrolmentClass domain = null;
		if(dto.getId() != null) {
			domain = enrolmentClassRepository.findOne(dto.getId());
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
		
		domain.setSchoolId(dto.getSchoolId());

		EnrolmentClass parent = null;
		if (dto.getParentId() != null) {
			if (domain.getId() != null && domain.getId().equals(dto.getParentId())) {
				return false;
			}
			parent = enrolmentClassRepository.findOne(dto.getParentId());
			if (parent == null || createsCycle(domain, parent)) {
				return false;
			}
		}
		domain.setParent(parent);

		Set<User> teachers = new LinkedHashSet<User>();
		if (dto.getTeacherIds() != null) {
			for (Long teacherId : dto.getTeacherIds()) {
				User teacher = teacherId == null ? null : userRepository.findOne(teacherId);
				if (teacher != null && Boolean.TRUE.equals(teacher.getActive()) && isTeacherCandidate(teacher)) {
					teachers.add(teacher);
				}
			}
		}
		domain.setTeachers(teachers);
		
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
		List<EnrolmentClass> domains = enrolmentClassRepository.findAll();
		User currentUser = getCurrentUser();
		Set<Long> visibleIds = new HashSet<Long>();
		boolean canSeeAllClasses = hasAnyRole(currentUser, ALL_CLASS_TEAM_MANAGER_ROLES);
		if (!canSeeAllClasses) {
			for (EnrolmentClass domain : domains) {
				if (!canManageTeams(currentUser, domain)) {
					continue;
				}
				EnrolmentClass current = domain;
				Set<Long> path = new HashSet<Long>();
				while (current != null && path.add(current.getId())) {
					visibleIds.add(current.getId());
					current = current.getParent();
				}
			}
		}
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
			if (!canSeeAllClasses && !visibleIds.contains(domain.getId())) {
				continue;
			}
			if (domain.getParent() != null) {
				Long parentId = domain.getParent().getId();
				Integer current = childCounts.get(parentId);
				childCounts.put(parentId, current == null ? 1 : current + 1);
			}
		}
		List<EnrolmentClassDto> result = new ArrayList<EnrolmentClassDto>();
		for (EnrolmentClass domain : domains) {
			if (canSeeAllClasses || visibleIds.contains(domain.getId())) {
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
	public EnrolmentClassTeamBoardDto getTeamBoard(Long classId) {
		EnrolmentClass selectedClass = classId == null ? null : enrolmentClassRepository.findOne(classId);
		if (selectedClass == null) {
			return null;
		}

		User currentUser = getCurrentUser();
		if (!canManageTeams(currentUser, selectedClass)) {
			throw new AccessDeniedException("Bạn không được phân đội cho lớp này.");
		}

		List<EnrolmentClass> teamDomains = enrolmentClassRepository.findByParentId(classId);
		sortClasses(teamDomains);

		List<Long> scopeIds = new ArrayList<Long>();
		scopeIds.add(classId);
		for (EnrolmentClass team : teamDomains) {
			scopeIds.add(team.getId());
		}

		List<User> students = userRepository.getActiveStudentsByEnrollmentClassIds(scopeIds);
		Collections.sort(students, new Comparator<User>() {
			@Override
			public int compare(User first, User second) {
				return studentName(first).compareToIgnoreCase(studentName(second));
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
		if (!canManageTeams(getCurrentUser(), selectedClass)) {
			throw new AccessDeniedException("Bạn không được phân đội cho lớp này.");
		}

		List<EnrolmentClass> directTeams = enrolmentClassRepository.findByParentId(classId);
		Set<Long> directTeamIds = new HashSet<Long>();
		for (EnrolmentClass team : directTeams) {
			directTeamIds.add(team.getId());
		}

		Long targetTeamId = moveDto.getTargetTeamId();
		if (targetTeamId != null && !directTeamIds.contains(targetTeamId)) {
			return null;
		}

		User student = userRepository.findOne(moveDto.getUserId());
		if (student == null || !Boolean.TRUE.equals(student.getActive()) || !hasRole(student, "ROLE_STUDENT")) {
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
		return getTeamBoard(classId);
	}

	private EnrolmentClassDto toDto(
			EnrolmentClass domain,
			Map<Long, Integer> childCounts,
			User currentUser) {
		EnrolmentClassDto dto = new EnrolmentClassDto(domain);
		if (childCounts != null && childCounts.containsKey(domain.getId())) {
			dto.setChildCount(childCounts.get(domain.getId()));
		}
		dto.setCanManageTeams(canManageTeams(currentUser, domain));
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

	private String studentName(User student) {
		if (student != null && student.getPerson() != null) {
			String displayName = student.getPerson().getDisplayName();
			if (displayName != null && !displayName.trim().isEmpty()) {
				return displayName.trim();
			}
			String lastName = student.getPerson().getLastName() == null ? "" : student.getPerson().getLastName();
			String firstName = student.getPerson().getFirstName() == null ? "" : student.getPerson().getFirstName();
			String fullName = (lastName + " " + firstName).trim();
			if (!fullName.isEmpty()) {
				return fullName;
			}
		}
		return student == null || student.getUsername() == null ? "" : student.getUsername();
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
		if (user == null || selectedClass == null) {
			return false;
		}
		for (String roleName : ALL_CLASS_TEAM_MANAGER_ROLES) {
			if (hasRole(user, roleName)) {
				return true;
			}
		}
		Set<Long> visited = new HashSet<Long>();
		EnrolmentClass current = selectedClass;
		while (current != null && visited.add(current.getId())) {
			if (current.getTeachers() != null) {
				for (User teacher : current.getTeachers()) {
					if (teacher != null && user.getId().equals(teacher.getId())) {
						return true;
					}
				}
			}
			current = current.getParent();
		}
		return false;
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

	private boolean hasAnyRole(User user, List<String> roleNames) {
		if (roleNames == null) {
			return false;
		}
		for (String roleName : roleNames) {
			if (hasRole(user, roleName)) {
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

}
