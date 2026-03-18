package com.globits.richy.service.impl;

import java.util.ArrayList;
import java.util.HashSet;
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
import com.globits.richy.domain.PersonDate;
import com.globits.richy.dto.PersonDateDto;
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
	private PersonDateRepository personDateRepository;
	@Autowired
	private UserRepository userRepository;
	
	@Override
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
	
	public Page<PersonDateDto> getPageObject(PersonDateDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0) {
			pageIndex = pageIndex - 1;
		} else {
			pageIndex = 0;
		}

		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();

		String sql = "select distinct new com.globits.richy.dto.PersonDateDto(s) "
				+ "from PersonDate s "
				+ "join s.user u "
				+ "left join u.groups g "
				+ "where (1=1)";

		String sqlCount = "select count(distinct s.id) "
				+ "from PersonDate s "
				+ "join s.user u "
				+ "left join u.groups g "
				+ "where (1=1)";

		String whereClause = "";

		// lọc theo group id
		if (searchDto != null && searchDto.getGroupId() != null) {
			whereClause += " and g.id = :groupId";
		}

		// textSearch
		if (textSearch != null && textSearch.trim().length() > 0) {
			whereClause += " and ("
					+ "lower(u.username) like :textSearch "
					+ "or lower(u.person.displayName) like :textSearch "
					+ "or lower(u.person.firstName) like :textSearch "
					+ "or lower(u.person.lastName) like :textSearch"
					+ ")";
		}

		// lọc theo ngày
		if (searchDto != null && searchDto.getStartDate() != null && searchDto.getEndDate() != null) {
			whereClause += " and (s.createDate >= :startDate and s.createDate < :endDate)";
		}

		// lọc theo lớp
		if (searchDto != null
				&& searchDto.getUser() != null
				&& searchDto.getUser().getPerson() != null
				&& searchDto.getUser().getPerson().getEnrollmentClass() != null) {
			whereClause += " and (u.person.enrollmentClass = :enrollmentClass)";
		}

		sql += whereClause;
		sqlCount += whereClause;

		Query q = manager.createQuery(sql, PersonDateDto.class);
		Query qCount = manager.createQuery(sqlCount);

		// set groupId
		if (searchDto != null && searchDto.getGroupId() != null) {
			q.setParameter("groupId", searchDto.getGroupId());
			qCount.setParameter("groupId", searchDto.getGroupId());
		}

		// set textSearch
		if (textSearch != null && textSearch.trim().length() > 0) {
			q.setParameter("textSearch", "%" + textSearch.trim().toLowerCase() + "%");
			qCount.setParameter("textSearch", "%" + textSearch.trim().toLowerCase() + "%");
		}

		// set ngày
		if (searchDto != null && searchDto.getStartDate() != null && searchDto.getEndDate() != null) {
			LocalDateTime startDate = searchDto.getStartDate();
			startDate = startDate.plusDays(1).withHourOfDay(0);

			LocalDateTime endDate = searchDto.getEndDate();
			endDate = endDate.plusDays(2).withHourOfDay(0);

			q.setParameter("startDate", startDate);
			qCount.setParameter("startDate", startDate);

			q.setParameter("endDate", endDate);
			qCount.setParameter("endDate", endDate);
		}

		// set lớp
		if (searchDto != null
				&& searchDto.getUser() != null
				&& searchDto.getUser().getPerson() != null
				&& searchDto.getUser().getPerson().getEnrollmentClass() != null) {
			q.setParameter("enrollmentClass", searchDto.getUser().getPerson().getEnrollmentClass());
			qCount.setParameter("enrollmentClass", searchDto.getUser().getPerson().getEnrollmentClass());
		}

		q.setFirstResult(pageIndex * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<PersonDateDto> page = new PageImpl<PersonDateDto>(q.getResultList(), pageable, numberResult);
		return page;
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
	    	
			domain = personDateRepository.getBy(dto.getUser().getUsername(),startOfToday,startOfTomorrow);
			if(domain == null) {
				return dto;
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

    @Transactional(rollbackFor = Exception.class)
	@Override
	public boolean saveListByEnrollmentClass(int enrollmentClass) {
    	//quy trình
    	//Chưa có bảng điểm danh của ngày đó => sẽ tạo mới tất cả
    	//Đã tạo mới bảng điểm danh của ngày đó rồi => không tạo nữa
    	
    	// => tìm xem đã có bảng điểm danh của ngày chưa
    	LocalDate today = LocalDate.now();

    	LocalDateTime startOfToday = today.toDateTimeAtStartOfDay().toLocalDateTime();
    	LocalDateTime startOfTomorrow = today.plusDays(1).toDateTimeAtStartOfDay().toLocalDateTime();
    	
    	Long personDateNumbers = personDateRepository.countPersonDateBy(startOfToday, startOfTomorrow);
    	
    	if(personDateNumbers != null && personDateNumbers > 0) {// đã có bảng điểm danh
    		return true;
    	}
    	
    	// chưa có bảng điểm danh => tạo mới
		// tìm tất cả học sinh của lớp
    	List<User> users = new ArrayList<User>();
    	if(enrollmentClass == 0) {
    		users = userRepository.getUsersByAllEnrollmentClass();
    	}else {
    		users = userRepository.getUsersByEnrollmentClass(enrollmentClass);
    	}
		List<PersonDate> personDates = new ArrayList<PersonDate>();
		// create bản ghi điểm danh
		for (User user : users) {
			PersonDate personDate = new PersonDate();
			personDate.setUser(user);
			personDate.setStatusClass(2);
			personDate.setStatusMass(2);
			personDates.add(personDate);
		}
		if(personDates != null && personDates.size() > 0) {
			personDateRepository.save(personDates);
		}
		
		return true;
	}
}
