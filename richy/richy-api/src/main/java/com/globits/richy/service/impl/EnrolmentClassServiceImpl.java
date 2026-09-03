package com.globits.richy.service.impl;

import java.text.Normalizer;
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
	EnrolmentClassRepository enrolmentClassRepository;
	@Autowired
	UserRepository userRepository;

	private static final List<String> TEACHER_ROLE_NAMES = Arrays.asList(
			"ROLE_ADMIN",
			"ROLE_EDUCATION_MANAGERMENT",
			"ROLE_STUDENT_MANAGERMENT",
			"ROLE_STAFF");

	private static final String ROLE_ADMIN = "ROLE_ADMIN";
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
			if (!canViewClass(currentUser, domain)) {
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
		return toDto(domain, null, currentUser);
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
		
		if (hasRole(currentUser, ROLE_ADMIN)) {
			domain.setSchoolId(dto.getSchoolId());
		} else if (parent != null) {
			domain.setSchoolId(parent.getSchoolId());
		} else if (isNew) {
			domain.setSchoolId(EDUCATION_MANAGER_SCHOOL_ID);
		}
		domain.setParent(parent);

		Set<Long> studentResponsibleClassIds = parent == null
				? new HashSet<Long>()
				: new HashSet<Long>(getClassAndDescendantIds(parent.getId()));
		Set<User> teachers = new LinkedHashSet<User>();
		if (dto.getTeacherIds() != null) {
			for (Long teacherId : dto.getTeacherIds()) {
				User teacher = teacherId == null ? null : userRepository.findOne(teacherId);
				if (teacher != null
						&& Boolean.TRUE.equals(teacher.getActive())
						&& (isTeacherCandidate(teacher)
								|| isStudentResponsibleCandidate(teacher, studentResponsibleClassIds))) {
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
		List<EnrolmentClass> domains = enrolmentClassRepository.findAll();
		User currentUser = getCurrentUser();
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
		for (UserDto teacher : getTeacherCandidates()) {
			if (teacher != null && teacher.getId() != null) {
				candidates.put(teacher.getId(), teacher);
			}
		}

		List<Long> classIds = new ArrayList<Long>();
		for (Long classId : getClassAndDescendantIds(parentClassId)) {
			EnrolmentClass candidateClass = enrolmentClassRepository.findOne(classId);
			if (canViewClass(currentUser, candidateClass)) {
				classIds.add(classId);
			}
		}
		if (!classIds.isEmpty()) {
			for (User student : userRepository.getActiveStudentsByEnrollmentClassIds(classIds)) {
				if (student != null && student.getId() != null && !candidates.containsKey(student.getId())) {
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
			if (canViewClass(currentUser, team)) {
				teamDomains.add(team);
			}
		}
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
			if (canViewClass(currentUser, team)) {
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
		if (domain.getParent() != null && !canViewClass(currentUser, domain.getParent())) {
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
		if (user == null || selectedClass == null) {
			return false;
		}
		if (hasRole(user, ROLE_ADMIN)) {
			return true;
		}
		if (HIDDEN_SCHOOL_ID.equals(selectedClass.getSchoolId())) {
			return false;
		}
		return hasRole(user, ROLE_EDUCATION_MANAGERMENT)
				|| hasRole(user, ROLE_STUDENT_MANAGERMENT)
				|| isAssignedResponsibleForClassOrAncestor(user, selectedClass);
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
