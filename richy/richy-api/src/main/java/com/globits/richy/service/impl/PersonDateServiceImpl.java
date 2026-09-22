package com.globits.richy.service.impl;

import java.util.ArrayList;
import org.joda.time.format.DateTimeFormat;
import org.joda.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import javax.persistence.Query;

import org.joda.time.LocalDate;
import org.joda.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.globits.core.repository.PersonRepository;
import com.globits.core.service.impl.GenericServiceImpl;
import com.globits.richy.domain.BillProduct;
import com.globits.richy.domain.EnrolmentClass;
import com.globits.richy.domain.PersonDate;
import com.globits.richy.dto.PersonDateBulkCreateDto;
import com.globits.richy.dto.PersonDateClassReportDto;
import com.globits.richy.dto.PersonDateDto;
import com.globits.richy.repository.EnrolmentClassRepository;
import com.globits.richy.repository.PersonDateRepository;
import com.globits.richy.service.PersonDateService;
import com.globits.security.domain.User;
import com.globits.security.domain.UserGroup;
import com.globits.security.repository.UserRepository;

@Transactional
@Service
public class PersonDateServiceImpl extends GenericServiceImpl<PersonDate, Long> implements PersonDateService {
	// @Autowired
	// private BCryptPasswordEncoder bCryptPasswordEncoder;
	@Autowired
	private PersonRepository studentRepository;
	@Autowired
	private EnrolmentClassRepository enrolmentClassRepository;
	@Autowired
	private PersonDateRepository personDateRepository;
	@Autowired
	private UserRepository userRepository;
	
//	@Override
//	public Page<PersonDateDto> getPageObject(PersonDateDto searchDto, int pageIndex, int pageSize) {
//		if (pageIndex > 0)
//			pageIndex = pageIndex - 1;
//		else
//			pageIndex = 0;
//		Pageable pageable = new PageRequest(pageIndex, pageSize);
//
//		String textSearch = searchDto.getTextSearch();
//
//		String sql = "select new com.globits.richy.dto.PersonDateDto(s) from PersonDate s where (1=1)";
//		String sqlCount = "select count(s.id) from PersonDate s where (1=1)";
//		String whereClause = "";
//
//		if (textSearch != null && textSearch.length() > 0) {
//			whereClause += " and (s.name like :textSearch or s.code like :textSearch)";
//		}
//		
//		if (searchDto != null && searchDto.getStartDate() != null && searchDto.getEndDate() != null) {	
//			whereClause += " and (s.createDate >= :startDate and s.createDate < :endDate)";
//		}
//		
////		if(searchDto.getImportant() != null) {
////			whereClause += " and (s.important = :important)";
////		}
////		
//		if(searchDto.getUser() != null && searchDto.getUser().getPerson() != null && searchDto.getUser().getPerson().getEnrollmentClass() != null) {
//			whereClause += " and (s.user.person.enrollmentClass = :enrollmentClass)";
//		}
//		
//		sql += whereClause;
//		sqlCount += whereClause;
//		
//
//		Query q = manager.createQuery(sql, PersonDateDto.class);
//		Query qCount = manager.createQuery(sqlCount);
//
//		if (textSearch != null && textSearch.length() > 0) {
//			q.setParameter("textSearch", '%' + textSearch + '%');
//			qCount.setParameter("textSearch", '%' + textSearch + '%');
//		}
//		
//		if (searchDto != null && searchDto.getStartDate() != null && searchDto.getEndDate() != null) {
//			
//			LocalDateTime startDate = searchDto.getStartDate();
//			startDate = startDate.plusDays(1).withHourOfDay(0);
//			LocalDateTime endDate = searchDto.getEndDate();
//			endDate = endDate.plusDays(2).withHourOfDay(0);
//			
//			q.setParameter("startDate", startDate);
//			qCount.setParameter("startDate", startDate);
//			
//			q.setParameter("endDate", endDate);
//			qCount.setParameter("endDate", endDate);
//		}
//		
//		if(searchDto.getUser() != null && searchDto.getUser().getPerson() != null && searchDto.getUser().getPerson().getEnrollmentClass() != null) {
//			q.setParameter("enrollmentClass",searchDto.getUser().getPerson().getEnrollmentClass());
//			qCount.setParameter("enrollmentClass",searchDto.getUser().getPerson().getEnrollmentClass());
//		}
//		
////		if(searchDto.getImportant() != null) {
////			q.setParameter("important",searchDto.getImportant());
////			qCount.setParameter("important",searchDto.getImportant());
////		}
////		
////		if(searchDto.getCategory() != null) {
////			q.setParameter("category",searchDto.getCategory());
////			qCount.setParameter("category",searchDto.getCategory());
////		}
//
//		q.setFirstResult((pageIndex) * pageSize);
//		q.setMaxResults(pageSize);
//
//		Long numberResult = (Long) qCount.getSingleResult();
//
//		Page<PersonDateDto> page = new PageImpl<PersonDateDto>(q.getResultList(), pageable, numberResult);
//		return page;
//	}
	
	@Override
	public Page<PersonDateDto> getPageObject(
	        PersonDateDto searchDto,
	        int pageIndex,
	        int pageSize
	) {
	    if (pageIndex > 0) {
	        pageIndex = pageIndex - 1;
	    } else {
	        pageIndex = 0;
	    }

	    Pageable pageable = new PageRequest(
	            pageIndex,
	            pageSize
	    );

	    String textSearch = null;

	    if (searchDto != null) {
	        textSearch = searchDto.getTextSearch();
	    }

	    String sql =
	            "select distinct " +
	            "new com.globits.richy.dto.PersonDateDto(s) " +
	            "from PersonDate s " +
	            "join s.user u " +
	            "left join u.groups g " +
	            "where (1=1)";

	    String sqlCount =
	            "select count(distinct s.id) " +
	            "from PersonDate s " +
	            "join s.user u " +
	            "left join u.groups g " +
	            "where (1=1)";

	    String whereClause = "";

	    /*
	     * Chỉ lấy user đang hoạt động.
	     */
	    whereClause += " and u.active = true";

	    if (searchDto != null && searchDto.getSchoolId() != null) {
	        whereClause += " and (s.schoolId = :schoolId "
                + "or (s.schoolId is null and ((:schoolId = 2 and (s.statusMass is not null or s.extraClass is not null)) "
                + "or (:schoolId = 1 and s.statusMass is null and s.extraClass is null))))";
	    }
	    if (searchDto != null && searchDto.getAttendanceClassId() != null) {
	        whereClause += " and (s.attendanceClassId = :attendanceClassId or s.attendanceClassId is null)";
	    }

	    /*
	     * Lọc nhóm.
	     */
	    if (
	            searchDto != null &&
	            searchDto.getGroupId() != null
	    ) {
	        whereClause += " and g.id = :groupId";
	    }

	    /*
	     * Tìm kiếm.
	     */
	    if (
	            textSearch != null &&
	            textSearch.trim().length() > 0
	    ) {
	        whereClause +=
	                " and (" +
	                "lower(u.username) like :textSearch " +
	                "or lower(u.person.displayName) like :textSearch " +
	                "or lower(u.person.firstName) like :textSearch " +
	                "or lower(u.person.lastName) like :textSearch" +
	                ")";
	    }

	    /*
	     * Lọc ngày.
	     */
	    if (
	            searchDto != null &&
	            searchDto.getStartDate() != null &&
	            searchDto.getEndDate() != null
	    ) {
	        whereClause +=
	                " and (" +
	                "s.createDate >= :startDate " +
	                "and s.createDate < :endDate" +
	                ")";
	    }

	    /*
	     * Lọc lớp.
	     */
	    if (
	            searchDto != null &&
	            searchDto.getUser() != null &&
	            searchDto.getUser().getPerson() != null &&
	            searchDto.getUser()
	                    .getPerson()
	                    .getEnrollmentClassId() != null
	    ) {
	        whereClause +=
	                " and u.person.enrollmentClassId = " +
	                ":enrollmentClassId";
	    }

	    sql += whereClause;
	    sqlCount += whereClause;

	    Query q = manager.createQuery(
	            sql,
	            PersonDateDto.class
	    );

	    Query qCount = manager.createQuery(sqlCount);

	    if (searchDto != null && searchDto.getSchoolId() != null) {
	        q.setParameter("schoolId", searchDto.getSchoolId());
	        qCount.setParameter("schoolId", searchDto.getSchoolId());
	    }
	    if (searchDto != null && searchDto.getAttendanceClassId() != null) {
	        q.setParameter("attendanceClassId", searchDto.getAttendanceClassId());
	        qCount.setParameter("attendanceClassId", searchDto.getAttendanceClassId());
	    }

	    /*
	     * Set group.
	     */
	    if (
	            searchDto != null &&
	            searchDto.getGroupId() != null
	    ) {
	        q.setParameter(
	                "groupId",
	                searchDto.getGroupId()
	        );

	        qCount.setParameter(
	                "groupId",
	                searchDto.getGroupId()
	        );
	    }

	    /*
	     * Set tìm kiếm.
	     */
	    if (
	            textSearch != null &&
	            textSearch.trim().length() > 0
	    ) {
	        String keyword =
	                "%" +
	                textSearch.trim().toLowerCase() +
	                "%";

	        q.setParameter(
	                "textSearch",
	                keyword
	        );

	        qCount.setParameter(
	                "textSearch",
	                keyword
	        );
	    }

	    /*
	     * Set ngày.
	     */
	    if (
	            searchDto != null &&
	            searchDto.getStartDate() != null &&
	            searchDto.getEndDate() != null
	    ) {
	        LocalDateTime startDate =
	                searchDto.getStartDate()
	                        .plusDays(1)
	                        .withHourOfDay(0);

	        LocalDateTime endDate =
	                searchDto.getEndDate()
	                        .plusDays(2)
	                        .withHourOfDay(0);

	        q.setParameter(
	                "startDate",
	                startDate
	        );

	        qCount.setParameter(
	                "startDate",
	                startDate
	        );

	        q.setParameter(
	                "endDate",
	                endDate
	        );

	        qCount.setParameter(
	                "endDate",
	                endDate
	        );
	    }

	    /*
	     * Set lớp.
	     *
	     * Getter trả về Integer.
	     */
	    if (
	            searchDto != null &&
	            searchDto.getUser() != null &&
	            searchDto.getUser().getPerson() != null &&
	            searchDto.getUser()
	                    .getPerson()
	                    .getEnrollmentClassId() != null
	    ) {
	        Integer enrollmentClassId =
	                searchDto.getUser()
	                        .getPerson()
	                        .getEnrollmentClassId();

	        q.setParameter(
	                "enrollmentClassId",
	                enrollmentClassId
	        );

	        qCount.setParameter(
	                "enrollmentClassId",
	                enrollmentClassId
	        );
	    }

	    q.setFirstResult(
	            pageIndex * pageSize
	    );

	    q.setMaxResults(pageSize);

	    Long numberResult =
	            (Long) qCount.getSingleResult();

	    List<PersonDateDto> content =
	            q.getResultList();

	    return new PageImpl<PersonDateDto>(
	            content,
	            pageable,
	            numberResult
	    );
	}


	@Override
	public PersonDateDto getObjectById(Long id) {
		return new PersonDateDto(personDateRepository.getOne(id));
	}

	@Override
	public PersonDateDto saveObject(PersonDateDto dto) {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User modifiedUser = null;
		LocalDateTime currentDate = LocalDateTime.now();
		String currentUserName = "Unknown User";
		if (authentication != null) {
			modifiedUser = (User) authentication.getPrincipal();
			currentUserName = modifiedUser.getUsername();
		}
		PersonDateDto ret = new PersonDateDto();
		
		if(dto == null) {
			return ret;
		}
		Integer targetSchoolId = dto.getSchoolId() == null ? Integer.valueOf(2) : dto.getSchoolId();
		Long targetAttendanceClassId = dto.getAttendanceClassId();
		if (!Integer.valueOf(1).equals(targetSchoolId) && !Integer.valueOf(2).equals(targetSchoolId)) {
			throw new IllegalArgumentException("SchoolId điểm danh không hợp lệ.");
		}
		
		PersonDate domain = null;
		boolean isChoir = false;

//		boolean saveForQR = false;
		if(dto.getId() != null) { // save bằng click
			domain = personDateRepository.getOne(dto.getId());
		}
		else if (dto.getUser() != null && dto.getUser().getUsername() != null) { // save bằng QR
			
			//chỉ tìm user trong ngày thôi
			LocalDate today = LocalDate.now();

	    	LocalDateTime startOfToday = today.toDateTimeAtStartOfDay().toLocalDateTime();
	    	LocalDateTime startOfTomorrow = today.plusDays(1).toDateTimeAtStartOfDay().toLocalDateTime();
	    	
			if (targetAttendanceClassId != null) {
				List<PersonDate> matches = personDateRepository.findForUserDateSchoolAndClass(
						dto.getUser().getUsername(), targetSchoolId, targetAttendanceClassId, startOfToday, startOfTomorrow);
				domain = matches.isEmpty() ? null : matches.get(0);
			} else {
				domain = personDateRepository.getBy(dto.getUser().getUsername(), targetSchoolId, startOfToday, startOfTomorrow);
			}
			if(domain == null) {
				throw new IllegalArgumentException(
						"Không tìm thấy bản ghi điểm danh của học sinh trong ngày và lớp đã chọn.");
			}
			if(domain.getUser() != null && domain.getUser().getId() != null) {
				dto.getUser().setId(domain.getUser().getId());	
			}
			
		}
		if(domain != null) {
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(currentDate);
		}
		if(domain == null) {
			domain = new PersonDate();
			domain.setCreateDate(currentDate);
			domain.setCreatedBy(currentUserName);
		}
		if (domain.getSchoolId() == null || dto.getSchoolId() != null) {
			domain.setSchoolId(targetSchoolId);
		}
		if (domain.getAttendanceClassId() == null || dto.getAttendanceClassId() != null) {
			domain.setAttendanceClassId(targetAttendanceClassId);
		}
		
		if(dto.getUser() != null && dto.getUser().getId() != null) {
			User user = userRepository.getOne(dto.getUser().getId());
			if(user != null) {
				domain.setUser(user);
				if(user.getPerson() != null) {
					if(user.getGroups() != null && user.getGroups().size() > 0) {
//						HashSet<UserGroup> groups = new HashSet<UserGroup>();
						for (UserGroup userGroup : user.getGroups()) {
							if(userGroup.getName().equals("CADOAN")) { // cái này thì phải viết tài liệu lại
								isChoir = true;
							}
						}
					}
				}
			}
		}
//		else if (saveForQR == false){
//			return ret;
//		}
		
		// 1: có đi lễ ; 2: không đi lễ; 3: muộn; 5: ca đoàn; 6: Phép (lễ)
		if(dto.getStatusClass() != null) {
			if(dto.getStatusClass() == 1) {// có đi học giáo lý
			    LocalDateTime localDateTime = LocalDateTime.now();
			    domain.setTimeGoToClass(localDateTime);
			}
			if(dto.getStatusClass() == 2) {// không đi học giáo lý
			    domain.setTimeGoToClass(null);
			}
			if(dto.getStatusClass() == 3) {// muộn => tách ra để sau này sửa thêm
			    LocalDateTime localDateTime = LocalDateTime.now();
			    domain.setTimeGoToClass(localDateTime);
			}
			if(dto.getStatusClass() == 6) {// Phép
			    domain.setTimeGoToClass(null);
			}
			domain.setStatusClass(dto.getStatusClass());
		}
		
		if(dto.getExtraClass() != null) {
			if(dto.getExtraClass() == 1) {// có đi học giáo lý
			    LocalDateTime localDateTime = LocalDateTime.now();
			    domain.setTimeGoToExtraClass(localDateTime);
			}
			if(dto.getExtraClass() == 2) {// không đi học giáo lý
			    domain.setTimeGoToExtraClass(null);
			}
			if(dto.getExtraClass() == 3) {// muộn => tách ra để sau này sửa thêm
			    LocalDateTime localDateTime = LocalDateTime.now();
			    domain.setTimeGoToExtraClass(localDateTime);
			}
			if(dto.getExtraClass() == 6) {// Phép
			    domain.setTimeGoToExtraClass(null);
			}
			domain.setExtraClass(dto.getExtraClass());
		}
		
		if(dto.getStatusMass() != null) {
			if(dto.getStatusMass() == 1) {// có đi LỄ
			    LocalDateTime localDateTime = LocalDateTime.now();
			    domain.setTimeGoToChurch(localDateTime);
			    
			    //ĐI HÁT CA ĐOÀN = ĐI LỄ
			    if(isChoir == true) {
			    	dto.setStatusMass(5);
			    }
			    
			}
			if(dto.getStatusMass() == 2) {// không đi LỄ
			    domain.setTimeGoToChurch(null);
			}
			if(dto.getStatusMass() == 3) {// muộn => tách ra để sau này sửa thêm
			    LocalDateTime localDateTime = LocalDateTime.now();
			    domain.setTimeGoToChurch(localDateTime);
			}
			if(dto.getStatusMass() == 5) {//ca đoàn
			    LocalDateTime localDateTime = LocalDateTime.now();
			    domain.setTimeGoToChurch(localDateTime);
			}
			if(dto.getStatusMass() == 6) {// Phép
			    domain.setTimeGoToChurch(null);
			}
			domain.setStatusMass(dto.getStatusMass());
		}
		
		if(dto.getDescription() != null) {
			domain.setDescription(dto.getDescription());	
		}
		
		domain = personDateRepository.save(domain);
		
		ret = new PersonDateDto(domain);
		
		return ret;
	}

	@Override
	@Transactional(rollbackFor = Exception.class)
	public PersonDateDto saveByQr(PersonDateDto dto, String attendanceDate) {
		if (dto == null || dto.getUser() == null || dto.getUser().getUsername() == null
				|| dto.getUser().getUsername().trim().length() == 0) {
			throw new IllegalArgumentException("Mã học sinh trong QR không hợp lệ.");
		}
		if (dto.getExtraClass() != null
				|| (dto.getStatusMass() != null && !Integer.valueOf(1).equals(dto.getStatusMass()))
				|| (dto.getStatusClass() != null && !Integer.valueOf(1).equals(dto.getStatusClass()))) {
			throw new IllegalArgumentException("Loại điểm danh QR không hợp lệ.");
		}

		Integer targetSchoolId = normalizeAttendanceSchoolId(dto.getSchoolId());
		LocalDate selectedDate = parseAttendanceDate(attendanceDate);
		LocalDateTime start = selectedDate.toDateTimeAtStartOfDay().toLocalDateTime();
		LocalDateTime end = start.plusDays(1);
		String username = dto.getUser().getUsername().trim();
		List<PersonDate> matches = personDateRepository.findForQrByUserDateAndSchool(
				username, targetSchoolId, start, end);
		if (matches == null || matches.isEmpty()) {
			throw new IllegalArgumentException(
					"Không tìm thấy học sinh có mã " + username + " trong bảng điểm danh ngày "
					+ selectedDate.toString("dd/MM/yyyy") + ".");
		}

		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		String currentUserName = "Unknown User";
		if (authentication != null) {
			User modifiedUser = (User) authentication.getPrincipal();
			currentUserName = modifiedUser.getUsername();
		}
		LocalDateTime now = LocalDateTime.now();
		PersonDate firstSaved = null;
		for (PersonDate domain : matches) {
			// Một lượt quét QR luôn điểm danh cả Lễ và Giáo lý cho mọi bản ghi
			// của học sinh trong ngày, không phụ thuộc lớp đang được lọc trên giao diện.
			domain.setStatusClass(1);
			domain.setTimeGoToClass(now);
			boolean isChoir = false;
			if (domain.getUser() != null && domain.getUser().getGroups() != null) {
				for (UserGroup group : domain.getUser().getGroups()) {
					if (group != null && "CADOAN".equals(group.getName())) {
						isChoir = true;
						break;
					}
				}
			}
			domain.setStatusMass(isChoir ? 5 : 1);
			domain.setTimeGoToChurch(now);
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(now);
			PersonDate saved = personDateRepository.save(domain);
			if (firstSaved == null) {
				firstSaved = saved;
			}
		}
		return new PersonDateDto(firstSaved);
	}

	@Override
	public boolean deleteObject(Long id) {
		if(id == null) {
			return false;
		}
		PersonDate domain = personDateRepository.getOne(id);
		if(domain == null) {
			return false;
		}
		personDateRepository.delete(domain);
		return true;
	}

	private Integer normalizeAttendanceSchoolId(Integer schoolId) {
		Integer target = schoolId == null ? Integer.valueOf(2) : schoolId;
		if (!Integer.valueOf(1).equals(target) && !Integer.valueOf(2).equals(target)) {
			throw new IllegalArgumentException("SchoolId điểm danh không hợp lệ.");
		}
		return target;
	}

	private LocalDate parseAttendanceDate(String attendanceDate) {
		if (attendanceDate != null && attendanceDate.trim().length() > 0) {
			DateTimeFormatter formatter = DateTimeFormat.forPattern("yyyy-MM-dd");
			return formatter.parseLocalDate(attendanceDate.trim());
		}
		return LocalDate.now();
	}

	private List<User> getAttendanceStudents(Long classId) {
		List<User> result = new ArrayList<User>();
		if (classId == null) { return result; }
		List<User> users = userRepository.getUsersByEnrollmentClass(classId.intValue());
		if (users == null) { return result; }
		for (User user : users) {
			if (user != null && user.getId() != null && Boolean.TRUE.equals(user.getActive())) {
				result.add(user);
			}
		}
		return result;
	}

	private HashSet<Long> getExistingAttendanceUserIds(
			List<User> students,
			Integer schoolId,
			Long classId,
			LocalDateTime startDate,
			LocalDateTime endDate) {
		HashSet<Long> result = new HashSet<Long>();
		List<Long> userIds = new ArrayList<Long>();
		for (User student : students) {
			if (student != null && student.getId() != null) { userIds.add(student.getId()); }
		}
		if (userIds.isEmpty()) { return result; }
		List<PersonDate> existing = personDateRepository.findByUserIdsDateSchoolAndClass(
				userIds, startDate, endDate, schoolId, classId);
		if (existing == null) { return result; }
		for (PersonDate item : existing) {
			if (item != null && item.getUser() != null && item.getUser().getId() != null) {
				result.add(item.getUser().getId());
			}
		}
		return result;
	}

	private String getAttendanceStudentName(User student) {
		if (student != null && student.getPerson() != null) {
			String displayName = student.getPerson().getDisplayName();
			if (displayName != null && displayName.trim().length() > 0) {
				return displayName.trim();
			}
		}
		return student == null || student.getUsername() == null ? "Không rõ học sinh" : student.getUsername();
	}

	private PersonDateClassReportDto buildAttendanceClassReport(
			Long classId,
			Integer schoolId,
			LocalDateTime startDate,
			LocalDateTime endDate,
			int createdStudents) {
		PersonDateClassReportDto report = new PersonDateClassReportDto();
		report.setClassId(classId);
		EnrolmentClass enrolmentClass = classId == null ? null : enrolmentClassRepository.findOne(classId);
		report.setClassName(enrolmentClass == null ? "Lớp không xác định" : enrolmentClass.getName());
		List<User> students = getAttendanceStudents(classId);
		HashSet<Long> existingUserIds = getExistingAttendanceUserIds(
				students, schoolId, classId, startDate, endDate);
		List<String> missingNames = new ArrayList<String>();
		for (User student : students) {
			if (!existingUserIds.contains(student.getId())) {
				missingNames.add(getAttendanceStudentName(student));
			}
		}
		report.setTotalStudents(students.size());
		report.setExistingStudents(existingUserIds.size());
		report.setCreatedStudents(createdStudents);
		report.setMissingStudentNames(missingNames);
		return report;
	}

	@Override
	public List<PersonDateClassReportDto> getAttendanceClassStatuses(String attendanceDate, Integer schoolId) {
		Integer targetSchoolId = normalizeAttendanceSchoolId(schoolId);
		LocalDate selectedDate = parseAttendanceDate(attendanceDate);
		LocalDateTime start = selectedDate.toDateTimeAtStartOfDay().toLocalDateTime();
		LocalDateTime end = start.plusDays(1);
		List<PersonDateClassReportDto> result = new ArrayList<PersonDateClassReportDto>();
		List<Long> classIds = enrolmentClassRepository.findIdsBySchoolId(targetSchoolId);
		if (classIds == null) { return result; }
		for (Long classId : classIds) {
			result.add(buildAttendanceClassReport(classId, targetSchoolId, start, end, 0));
		}
		return result;
	}

	@Transactional(rollbackFor = Exception.class)
	@Override
	public boolean saveListByEnrollmentClass(int enrollmentClass, String attendanceDate, Integer schoolId) {
		Integer targetSchoolId = normalizeAttendanceSchoolId(schoolId);
		List<Long> classIds = new ArrayList<Long>();
		if (enrollmentClass == 0) {
			classIds.addAll(enrolmentClassRepository.findIdsBySchoolId(targetSchoolId));
		} else {
			classIds.add(Long.valueOf(enrollmentClass));
		}
		PersonDateBulkCreateDto dto = new PersonDateBulkCreateDto();
		dto.setAttendanceDate(attendanceDate);
		dto.setSchoolId(targetSchoolId);
		dto.setClassIds(classIds);
		return !saveListByEnrollmentClasses(dto).isEmpty();
	}

	@Transactional(rollbackFor = Exception.class)
	@Override
	public List<PersonDateClassReportDto> saveListByEnrollmentClasses(PersonDateBulkCreateDto dto) {
		if (dto == null || dto.getClassIds() == null || dto.getClassIds().isEmpty()) {
			throw new IllegalArgumentException("Hãy chọn ít nhất một lớp để tạo bảng điểm danh.");
		}
		Integer targetSchoolId = normalizeAttendanceSchoolId(dto.getSchoolId());
		LocalDate selectedDate = parseAttendanceDate(dto.getAttendanceDate());
		LocalDateTime startOfSelectedDate = selectedDate.toDateTimeAtStartOfDay().toLocalDateTime();
		LocalDateTime startOfNextDate = startOfSelectedDate.plusDays(1);
		List<Long> schoolClassIds = enrolmentClassRepository.findIdsBySchoolId(targetSchoolId);
		LinkedHashSet<Long> selectedClassIds = new LinkedHashSet<Long>();
		for (Long classId : dto.getClassIds()) {
			if (classId != null && schoolClassIds != null && schoolClassIds.contains(classId)) {
				selectedClassIds.add(classId);
			}
		}
		if (selectedClassIds.isEmpty() || selectedClassIds.size() > 500) {
			throw new IllegalArgumentException("Danh sách lớp điểm danh không hợp lệ.");
		}

		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		String currentUserName = "Unknown User";
		if (authentication != null) {
			User modifiedUser = (User) authentication.getPrincipal();
			currentUserName = modifiedUser.getUsername();
		}

		List<PersonDate> personDates = new ArrayList<PersonDate>();
		List<Long> processedClassIds = new ArrayList<Long>();
		List<Integer> createdCounts = new ArrayList<Integer>();
		for (Long classId : selectedClassIds) {
			List<User> students = getAttendanceStudents(classId);
			HashSet<Long> existingUserIds = getExistingAttendanceUserIds(
					students, targetSchoolId, classId, startOfSelectedDate, startOfNextDate);
			int createdCount = 0;
			for (User user : students) {
				if (existingUserIds.contains(user.getId())) { continue; }
				PersonDate personDate = new PersonDate();
				personDate.setUser(user);
				personDate.setSchoolId(targetSchoolId);
				personDate.setAttendanceClassId(classId);
				personDate.setStatusClass(2);
				personDate.setStatusMass(2);
				personDate.setExtraClass(2);
				personDate.setCreateDate(startOfSelectedDate);
				personDate.setModifyDate(startOfSelectedDate);
				personDate.setCreatedBy(currentUserName);
				personDate.setModifiedBy(currentUserName);
				personDates.add(personDate);
				createdCount++;
			}
			processedClassIds.add(classId);
			createdCounts.add(Integer.valueOf(createdCount));
		}

		if (!personDates.isEmpty()) {
			List<PersonDate> savedPersonDates = personDateRepository.save(personDates);
			manager.flush();
			List<Long> ids = new ArrayList<Long>();
			for (PersonDate item : savedPersonDates) {
				if (item != null && item.getId() != null) { ids.add(item.getId()); }
			}
			if (!ids.isEmpty()) {
				Query updateQuery = manager.createQuery(
						"update PersonDate p set p.createDate = :createDate, p.modifyDate = :modifyDate, "
						+ "p.createdBy = :createdBy, p.modifiedBy = :modifiedBy where p.id in (:ids)");
				updateQuery.setParameter("createDate", startOfSelectedDate);
				updateQuery.setParameter("modifyDate", startOfSelectedDate);
				updateQuery.setParameter("createdBy", currentUserName);
				updateQuery.setParameter("modifiedBy", currentUserName);
				updateQuery.setParameter("ids", ids);
				updateQuery.executeUpdate();
				manager.flush();
				manager.clear();
			}
		}

		List<PersonDateClassReportDto> reports = new ArrayList<PersonDateClassReportDto>();
		for (int i = 0; i < processedClassIds.size(); i++) {
			reports.add(buildAttendanceClassReport(
					processedClassIds.get(i), targetSchoolId, startOfSelectedDate, startOfNextDate,
					createdCounts.get(i).intValue()));
		}
		return reports;
	}
}
