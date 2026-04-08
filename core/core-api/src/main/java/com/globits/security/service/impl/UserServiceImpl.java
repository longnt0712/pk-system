package com.globits.security.service.impl;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import javax.persistence.EntityManager;
import javax.persistence.Query;
import javax.persistence.criteria.CriteriaBuilder;
import javax.persistence.criteria.CriteriaQuery;
import javax.persistence.criteria.Join;
import javax.persistence.criteria.Predicate;
import javax.persistence.criteria.Root;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import com.globits.core.domain.Ethnics;
import com.globits.core.domain.Person;
import com.globits.core.dto.PersonDto;
import com.globits.core.repository.EthnicsRepository;
import com.globits.core.repository.PersonRepository;
import com.globits.core.service.impl.GenericServiceImpl;
import com.globits.core.utils.CommonUtils;
import com.globits.core.utils.SecurityUtils;
import com.globits.security.domain.Role;
import com.globits.security.domain.User;
import com.globits.security.domain.UserGroup;
import com.globits.security.dto.RoleDto;
import com.globits.security.dto.UserDto;
import com.globits.security.dto.UserFilterDto;
import com.globits.security.dto.UserGroupDto;
import com.globits.security.repository.RoleRepository;
import com.globits.security.repository.UserGroupRepository;
import com.globits.security.repository.UserRepository;
import com.globits.security.service.UserService;

@Service
public class UserServiceImpl extends  GenericServiceImpl<User,Long> implements UserService {

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private UserGroupRepository groupRepos;

	@Autowired
	private RoleRepository roleRepos;

	@Autowired
	private PersonRepository personRepos;

	@Autowired
	private EthnicsRepository ethnicsRepos;

	@Autowired
	EntityManager manager;
	@Override
	@Transactional(readOnly = true)
	public UserDto findByUserId(Long userId) {
		User user = userRepository.findById(userId);

		if (user != null) {
			return new UserDto(user);
		} else {
			return null;
		}
	}
	@Override
	public UserDto deleteById(Long userId) {
		User user = userRepository.findById(userId);
		if (user != null) {
			userRepository.delete(user);
			return new UserDto(user);
		} else {
			return null;
		}
	}
	//
	@Override
	@Transactional(readOnly = true)
	public UserDto findByUsername(String username) {
		User user = userRepository.findByUsername(username);
		if (user != null) {
			return new UserDto(user);
		} else {
			return null;
		}
	}
	
	@Override
	@Transactional(readOnly = true)
	public List<UserDto> getAllUserWithDisplayNameAndUsername() {
		return userRepository.getAllUserWithDisplayNameAndUsername();
	}

	@Override
	@Transactional(readOnly = true)
	public UserDto findByEmail(String email) {
		User retUser = userRepository.findByEmail(email);

		if (retUser != null) {
			UserDto dto = new UserDto(retUser);
			dto.setPassword(null);

			return dto;
		}

		return null;
	}

	@Override
	@Transactional(readOnly = true)
	public Page<UserDto> findByPage(int pageIndex, int pageSize) {
		Pageable pageable = new PageRequest(pageIndex - 1, pageSize);

		Page<User> page = userRepository.findAll(pageable);

		List<User> _content = page.getContent();
		List<UserDto> content = new ArrayList<UserDto>();

		for (User entity : _content) {

			// No password disclosed
			// entity.setPassword(null);

			content.add(new UserDto(entity));
		}

		return new PageImpl<>(content, pageable, page.getTotalElements());
	}

	@Override
	@Transactional(readOnly = true)
	public Page<UserDto> findByPageBasicInfo(int pageIndex, int pageSize) {
		Pageable pageable = new PageRequest(pageIndex - 1, pageSize);

		Page<User> page = userRepository.findByPageBasicInfo(pageable);

		List<User> _content = page.getContent();
		List<UserDto> content = new ArrayList<UserDto>();

		for (User entity : _content) {

			// No password disclosed
			// entity.setPassword(null);

			content.add(new UserDto(entity));
		}

		return new PageImpl<>(content, pageable, page.getTotalElements());
	}

	@Override
	@Transactional(readOnly = true)
	public Page<UserDto> searchByPageBasicInfo(int pageIndex, int pageSize, String username) {
		Pageable pageable = new PageRequest(pageIndex - 1, pageSize);

		Page<User> page = userRepository.searchByPageBasicInfo(pageable, username);

		List<User> _content = page.getContent();
		List<UserDto> content = new ArrayList<UserDto>();

		for (User entity : _content) {

			// No password disclosed
			// entity.setPassword(null);

			content.add(new UserDto(entity));
		}

		return new PageImpl<>(content, pageable, page.getTotalElements());
	}
	
//	public static String removeAccent(String s) {
//
//	    if (s == null) {
//	        return null;
//	    }
//
//	    String normalized = java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD);
//
//	    return normalized.replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
//	            .replaceAll("đ", "d")
//	            .replaceAll("Đ", "D")
//	            .toLowerCase();
//	}

	@Override
	@Transactional(readOnly = true)
//	public Page<UserDto> findAllPageable(final UserFilterDto filter, int pageIndex, int pageSize) {
//		if (pageIndex > 0)
//			pageIndex = pageIndex - 1;
//		else
//			pageIndex = 0;
//		
//		Pageable pageable = new PageRequest(pageIndex, pageSize);
//		String sql = "from User u";
//		String sqlCount = "select count(distinct u.id) from User u ";
//		
//		String clause =" where (1=1)";
//		if (!CommonUtils.isEmpty(filter.getKeyword())) {
//			clause +=" and (u.username like :keyword or u.email like :keyword or (u.person!=null and u.person.displayName like :keyword)"
//					+ " or (u.person!=null and u.person.patron like :keyword) "
//					+ " or (u.person!=null and u.person.firstName like :keyword) "
//					+ " or (u.person!=null and u.person.lastName like :keyword) )";
//		}
//		
//		if (filter.getActive() != null) {
//			clause +=" and (u.active = :active)";
//		}
//		
//		if (filter.getEnrollmentClass() != null) {
//			clause +=" and (u.person.enrollmentClass = :enrollmentClass)";
//		}
//		
//		List<Long> roleIds = new ArrayList<>();
//		if (filter.getRoles() != null && filter.getRoles().length > 0) {
//			for (RoleDto dto : filter.getRoles()) {
//				if (CommonUtils.isPositive(dto.getId(), true)) {
//					roleIds.add(dto.getId());
//				}
//			}
////			sql +=" join fetch u.roles roles ";
//			sql +=" join u.roles roles ";
//			sqlCount +=" join u.roles roles ";
//			clause +=" and roles.id in :roleIds";
//		}	
//		List<Long> groupIds = new ArrayList<>();
//		if (filter.getGroups() != null && filter.getGroups().length > 0) {
//			
//			
//			for (UserGroupDto dto : filter.getGroups()) {
//				if (CommonUtils.isPositive(dto.getId(), true)) {
//					groupIds.add(dto.getId());
//				}
//			}
////			sql +=" join fetch u.groups groups";
//			sql +=" join u.groups groups";
//			sqlCount +=" join u.groups groups";
//			clause +=" and groups.id in :groupIds";
//		}
//		sql+=clause;
//		sqlCount+=clause;
//		
//		sql+=" order by u.username DESC";
//		
//		Query q = manager.createQuery(sql);
//		Query qCount = manager.createQuery(sqlCount);
//		if (!CommonUtils.isEmpty(filter.getKeyword())) {
//			q.setParameter("keyword", '%'+filter.getKeyword()+'%');
//			qCount.setParameter("keyword", '%'+filter.getKeyword()+'%');
//		}
//		
//		if (filter.getActive() != null) {
//			q.setParameter("active", filter.getActive());
//			qCount.setParameter("active", filter.getActive());
//		}
//		
//		if (filter.getRoles() != null && filter.getRoles().length > 0) {
//			q.setParameter("roleIds", roleIds);
//			qCount.setParameter("roleIds", roleIds);
//		}	
//		if (filter.getGroups() != null && filter.getGroups().length > 0) {
//			q.setParameter("groupIds", groupIds);
//			qCount.setParameter("groupIds", groupIds);
//		}
//		
//		if (filter.getEnrollmentClass() != null) {
//			q.setParameter("enrollmentClass", filter.getEnrollmentClass());
//			qCount.setParameter("enrollmentClass", filter.getEnrollmentClass());
//		}
//
////		int startPosition = (pageIndex-1)* pageSize;
//		q.setFirstResult((pageIndex) * pageSize);
//		q.setMaxResults(pageSize);
//		List<User> users= q.getResultList();
//		Long numberResult = (Long)qCount.getSingleResult();
//		
//		List<UserDto> userDtos = new ArrayList<>();
//		for (User u : users) {
//			userDtos.add(new UserDto(u));
//		}
//
//		return new PageImpl<>(userDtos, pageable, numberResult);
//	}
	
	public Page<UserDto> findAllPageable(final UserFilterDto filter, int pageIndex, int pageSize) {

	    if (pageIndex > 0) {
	        pageIndex = pageIndex - 1;
	    } else {
	        pageIndex = 0;
	    }

	    Pageable pageable = new PageRequest(pageIndex, pageSize);

	    String sql = "select u from User u left join u.person p ";
	    String sqlCount = "select count(u.id) from User u left join u.person p ";

	    String clause = " where 1=1 ";

	    List<Long> roleIds = new ArrayList<>();
	    List<Long> groupIds = new ArrayList<>();

	    /*
	     * KEYWORD
	     */
	    if (!CommonUtils.isEmpty(filter.getKeyword())) {
	        clause += " and ("
	                + " lower(u.username) like :keyword "
	                + " or lower(u.email) like :keyword "
	                + " or lower(concat("
	                + " coalesce(p.patron,''), ' ',"
	                + " coalesce(p.lastName,''), ' ',"
	                + " coalesce(p.firstName,'')"
	                + " )) like :keyword "
	                + ")";
	    }

	    /*
	     * ACTIVE
	     */
	    if (filter.getActive() != null) {
	        clause += " and u.active = :active ";
	    }

	    /*
	     * ENROLLMENT CLASS
	     */
	    if (filter.getEnrollmentClass() != null) {
	        clause += " and p.enrollmentClass = :enrollmentClass ";
	    }

	    /*
	     * ROLE FILTER
	     */
	    if (filter.getRoles() != null && filter.getRoles().length > 0) {
	        for (RoleDto dto : filter.getRoles()) {
	            if (CommonUtils.isPositive(dto.getId(), true)) {
	                roleIds.add(dto.getId());
	            }
	        }

	        if (!roleIds.isEmpty()) {
	            clause += " and exists ("
	                    + " select 1 from u.roles r "
	                    + " where r.id in :roleIds"
	                    + " )";
	        }
	    }

	    /*
	     * GROUP FILTER
	     */
	    if (filter.getGroups() != null && filter.getGroups().length > 0) {
	        for (UserGroupDto dto : filter.getGroups()) {
	            if (CommonUtils.isPositive(dto.getId(), true)) {
	                groupIds.add(dto.getId());
	            }
	        }

	        if (!groupIds.isEmpty()) {
	            clause += " and exists ("
	                    + " select 1 from u.groups g "
	                    + " where g.id in :groupIds"
	                    + " )";
	        }
	    }

	    /*
	     * FINAL QUERY
	     */
	    sql += clause
	            + " order by "
	            + " case when p.firstName is null then 1 else 0 end, "
	            + " p.firstName asc, "
	            + " case when p.lastName is null then 1 else 0 end, "
	            + " p.lastName asc, "
	            + " u.username asc ";

	    sqlCount += clause;

	    Query q = manager.createQuery(sql);
	    Query qCount = manager.createQuery(sqlCount);

	    /*
	     * SET PARAMETER
	     */
	    if (!CommonUtils.isEmpty(filter.getKeyword())) {
	        String keyword = "%" + filter.getKeyword().toLowerCase().trim() + "%";
	        q.setParameter("keyword", keyword);
	        qCount.setParameter("keyword", keyword);
	    }

	    if (filter.getActive() != null) {
	        q.setParameter("active", filter.getActive());
	        qCount.setParameter("active", filter.getActive());
	    }

	    if (filter.getEnrollmentClass() != null) {
	        q.setParameter("enrollmentClass", filter.getEnrollmentClass());
	        qCount.setParameter("enrollmentClass", filter.getEnrollmentClass());
	    }

	    if (!roleIds.isEmpty()) {
	        q.setParameter("roleIds", roleIds);
	        qCount.setParameter("roleIds", roleIds);
	    }

	    if (!groupIds.isEmpty()) {
	        q.setParameter("groupIds", groupIds);
	        qCount.setParameter("groupIds", groupIds);
	    }

	    /*
	     * PAGINATION
	     */
	    q.setFirstResult(pageIndex * pageSize);
	    q.setMaxResults(pageSize);

	    List<User> users = q.getResultList();
	    Long numberResult = (Long) qCount.getSingleResult();

	    List<UserDto> userDtos = new ArrayList<>();
	    for (User u : users) {
	        userDtos.add(new UserDto(u));
	    }

	    return new PageImpl<>(userDtos, pageable, numberResult);
	}

	@Override
	@Transactional(readOnly = true)
	public UserDto getCurrentUser() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User user = (User) authentication.getPrincipal();
		if (user != null && user.getUsername() != null) {
			User entity = userRepository.findByUsernameAndPerson(user.getUsername());

			if (entity != null) {
				return new UserDto(entity);
			}
		}

		return null;
	}

	@Override
	@Transactional(readOnly = true)
	public byte[] getProfilePhoto(String username) {
		if (username == null || username.trim().isEmpty()) {
			return null;
		}

		User user = userRepository.findByUsernameAndPerson(username);

		if (user == null || user.getPerson() == null || user.getPerson().getPhoto() == null) {
			return null;
		}

		return user.getPerson().getPhoto();
	}
	@Override
	@Transactional(rollbackFor = Exception.class)
	public User saveUser(UserDto userDto) {

		if (userDto == null) {
			throw new IllegalArgumentException();
		}

		User user = null;

		if (CommonUtils.isPositive(userDto.getId(), true)) {
			user = userRepository.findById(userDto.getId());
		}

		if (user == null) {
			user = userDto.toEntity();

			user.setJustCreated(true);

			if (userDto.getPassword() != null && userDto.getPassword().length() > 0) {
				user.setPassword(SecurityUtils.getHashPassword(userDto.getPassword()));
			}

		} else {
			user.setUsername(userDto.getUsername());//Nếu muốn cho đổi username thì bỏ đoạn rem này ra
			user.setEmail(userDto.getEmail());
			if (userDto.getPassword() != null && userDto.getPassword().length() > 0) {
				user.setPassword(SecurityUtils.getHashPassword(userDto.getPassword()));
			}
		}

		if (userDto.getRoles() != null) {
			List<Role> rs = new ArrayList<Role>();

			for (RoleDto d : userDto.getRoles()) {
				Role r = roleRepos.findOne(d.getId());

				if (r != null) {
					rs.add(r);
				}
			}

			user.getRoles().clear();
			user.getRoles().addAll(rs);
		}

		if (userDto.getGroups() != null) {
			List<UserGroup> gs = new ArrayList<>();

			for (UserGroupDto d : userDto.getGroups()) {
				UserGroup g = groupRepos.findOne(d.getId());

				if (g != null) {
					gs.add(g);
				}
			}

			user.getGroups().clear();
			user.getGroups().addAll(gs);
		}

		PersonDto personDto = userDto.getPerson();
		Person person = null;

		if (personDto != null && CommonUtils.isPositive(personDto.getId(), true)) {
			person = personRepos.findOne(personDto.getId());
		}

		if (person != null) {
			person.setFirstName(personDto.getFirstName());
			person.setLastName(personDto.getLastName());
			person.setDisplayName(personDto.getDisplayName());
			person.setBirthDate(personDto.getBirthDate());
			person.setBirthPlace(personDto.getBirthPlace());
			person.setEmail(personDto.getEmail());
			person.setEndDate(personDto.getEndDate());
			person.setFatherFullName(personDto.getFatherFullName());
			person.setMotherFullName(personDto.getMotherFullName());
			person.setFatherPhoneNumber(personDto.getFatherPhoneNumber());
			person.setMotherPhoneNumber(personDto.getMotherPhoneNumber());
			person.setAddressString(personDto.getAddressString());
			person.setZaloStatus(personDto.getZaloStatus());
			person.setDiocese(personDto.getDiocese());
			person.setEnrollmentClass(personDto.getEnrollmentClass());
			person.setPatron(personDto.getPatron());
			person.setSacrament(personDto.getSacrament());
			person.setPhoneNumber(personDto.getPhoneNumber());

			if (personDto.getEthnics() != null && CommonUtils.isPositive(personDto.getEthnics().getId(), true)) {

				Ethnics e = ethnicsRepos.findOne(personDto.getEthnics().getId());

				if (e != null) {
					person.setEthnics(e);
				}
			}

			person.setGender(personDto.getGender());
			person.setIdNumber(personDto.getIdNumber());
			person.setIdNumberIssueBy(personDto.getIdNumberIssueBy());
			person.setIdNumberIssueDate(personDto.getIdNumberIssueDate());
		} else {
			person = personDto.toEntity();
		}

		user.setPerson(person);
		person.setUser(user);
		user.setActive(userDto.getActive());
		user = userRepository.save(user);

		return user;
	}
	@Override
	@Transactional(rollbackFor = Exception.class)
	public UserDto save(UserDto userDto) {

		if (userDto == null) {
			throw new IllegalArgumentException();
		}

		User user = null;

		if (CommonUtils.isPositive(userDto.getId(), true)) {
			user = userRepository.findById(userDto.getId());
		}

		if (user == null) {
			user = userDto.toEntity();

			user.setJustCreated(true);

			if (userDto.getPassword() != null && userDto.getPassword().length() > 0) {
				user.setPassword(SecurityUtils.getHashPassword(userDto.getPassword()));
			}

		} else {
			user.setUsername(userDto.getUsername());//Nếu muốn cho đổi username thì bỏ đoạn rem này ra
			user.setEmail(userDto.getEmail());
//			if (userDto.getPassword() != null && userDto.getPassword().length() > 0) {
//				user.setPassword(SecurityUtils.getHashPassword(userDto.getPassword()));
//			}
		}

		if (userDto.getRoles() != null) {
			List<Role> rs = new ArrayList<Role>();

			for (RoleDto d : userDto.getRoles()) {
				Role r = roleRepos.findOne(d.getId());

				if (r != null) {
					rs.add(r);
				}
			}

			user.getRoles().clear();
			user.getRoles().addAll(rs);
		}

		if (userDto.getGroups() != null) {
			List<UserGroup> gs = new ArrayList<>();

			for (UserGroupDto d : userDto.getGroups()) {
				UserGroup g = groupRepos.findOne(d.getId());

				if (g != null) {
					gs.add(g);
				}
			}

			user.getGroups().clear();
			user.getGroups().addAll(gs);
		}

		PersonDto personDto = userDto.getPerson();
		Person person = null;

		if (personDto != null && CommonUtils.isPositive(personDto.getId(), true)) {
			person = personRepos.findOne(personDto.getId());
		}

		if (person != null) {
			person.setFirstName(personDto.getFirstName());
			person.setLastName(personDto.getLastName());
			person.setDisplayName(personDto.getDisplayName());
			person.setBirthDate(personDto.getBirthDate());
			person.setBirthPlace(personDto.getBirthPlace());
			person.setEmail(personDto.getEmail());
			person.setEndDate(personDto.getEndDate());
			person.setFatherFullName(personDto.getFatherFullName());
			person.setMotherFullName(personDto.getMotherFullName());
			person.setFatherPhoneNumber(personDto.getFatherPhoneNumber());
			person.setMotherPhoneNumber(personDto.getMotherPhoneNumber());
			person.setAddressString(personDto.getAddressString());
			person.setZaloStatus(personDto.getZaloStatus());
			person.setDiocese(personDto.getDiocese());
			person.setEnrollmentClass(personDto.getEnrollmentClass());
			person.setPatron(personDto.getPatron());
			person.setSacrament(personDto.getSacrament());
			person.setPhoneNumber(personDto.getPhoneNumber());

			if (personDto.getEthnics() != null && CommonUtils.isPositive(personDto.getEthnics().getId(), true)) {

				Ethnics e = ethnicsRepos.findOne(personDto.getEthnics().getId());

				if (e != null) {
					person.setEthnics(e);
				}
			}

			person.setGender(personDto.getGender());
			person.setIdNumber(personDto.getIdNumber());
			person.setIdNumberIssueBy(personDto.getIdNumberIssueBy());
			person.setIdNumberIssueDate(personDto.getIdNumberIssueDate());
		} else {
			person = personDto.toEntity();
		}

		user.setPerson(person);
		person.setUser(user);
		user.setActive(userDto.getActive());
		user = userRepository.save(user);

		if (user != null) {
			return new UserDto(user);
		} else {
			return null;
		}
	}
	
	@Override
	@Transactional(rollbackFor = Exception.class)
	public UserDto saveBasicInfo(UserDto userDto) {

		if (userDto == null) {
			throw new IllegalArgumentException();
		}

		User user = null;

		if (CommonUtils.isPositive(userDto.getId(), true)) {
			user = userRepository.findById(userDto.getId());
		}

		if (user == null) {
			user = userDto.toEntity();

			user.setJustCreated(true);

			if (userDto.getPassword() != null && userDto.getPassword().length() > 0) {
				user.setPassword(SecurityUtils.getHashPassword(userDto.getPassword()));
			}

		} else {
			user.setUsername(userDto.getUsername());//Nếu muốn cho đổi username thì bỏ đoạn rem này ra
			user.setEmail(userDto.getEmail());
//			if (userDto.getPassword() != null && userDto.getPassword().length() > 0) {
//				user.setPassword(SecurityUtils.getHashPassword(userDto.getPassword()));
//			}
		}

//		if (userDto.getRoles() != null) {
//			List<Role> rs = new ArrayList<Role>();
//
//			for (RoleDto d : userDto.getRoles()) {
//				Role r = roleRepos.findOne(d.getId());
//
//				if (r != null) {
//					rs.add(r);
//				}
//			}
//
//			user.getRoles().clear();
//			user.getRoles().addAll(rs);
//		}

		if (userDto.getGroups() != null) {
			List<UserGroup> gs = new ArrayList<>();

			for (UserGroupDto d : userDto.getGroups()) {
				UserGroup g = groupRepos.findOne(d.getId());

				if (g != null) {
					gs.add(g);
				}
			}

			user.getGroups().clear();
			user.getGroups().addAll(gs);
		}

		PersonDto personDto = userDto.getPerson();
		Person person = null;

		if (personDto != null && CommonUtils.isPositive(personDto.getId(), true)) {
			person = personRepos.findOne(personDto.getId());
		}

		if (person != null) {
			person.setFirstName(personDto.getFirstName());
			person.setLastName(personDto.getLastName());
			person.setDisplayName(personDto.getDisplayName());
			person.setBirthDate(personDto.getBirthDate());
			person.setBirthPlace(personDto.getBirthPlace());
			person.setEmail(personDto.getEmail());
			person.setEndDate(personDto.getEndDate());
			person.setFatherFullName(personDto.getFatherFullName());
			person.setMotherFullName(personDto.getMotherFullName());
			person.setFatherPhoneNumber(personDto.getFatherPhoneNumber());
			person.setMotherPhoneNumber(personDto.getMotherPhoneNumber());
			person.setAddressString(personDto.getAddressString());
			person.setZaloStatus(personDto.getZaloStatus());
			person.setDiocese(personDto.getDiocese());
			person.setEnrollmentClass(personDto.getEnrollmentClass());
			person.setPatron(personDto.getPatron());
			person.setSacrament(personDto.getSacrament());
			person.setPhoneNumber(personDto.getPhoneNumber());

			if (personDto.getEthnics() != null && CommonUtils.isPositive(personDto.getEthnics().getId(), true)) {

				Ethnics e = ethnicsRepos.findOne(personDto.getEthnics().getId());

				if (e != null) {
					person.setEthnics(e);
				}
			}

			person.setGender(personDto.getGender());
			person.setIdNumber(personDto.getIdNumber());
			person.setIdNumberIssueBy(personDto.getIdNumberIssueBy());
			person.setIdNumberIssueDate(personDto.getIdNumberIssueDate());
		} else {
			person = personDto.toEntity();
		}

		user.setPerson(person);
		person.setUser(user);
		user.setActive(userDto.getActive());
		user = userRepository.save(user);

		if (user != null) {
			return new UserDto(user);
		} else {
			return null;
		}
	}

	@Override
	@Transactional(rollbackFor = Exception.class)
	public UserDto savePhoto(UserDto dto) {

		if (dto == null) {
			throw new RuntimeException();
		}

		User user = null;

		if (dto.getId() != null && dto.getId() > 0) {
			user = userRepository.findOne(dto.getId());
		}

		if (user == null) {
			throw new RuntimeException();
		}

		Person person = user.getPerson();
		if (person == null) {
			person = new Person();
		}

		person.setPhoto(dto.getPerson().getPhoto());
		person.setPhotoCropped(dto.getPerson().getPhotoCropped());

		person.setUser(user);
		user.setPerson(person);

		// Save
		user = userRepository.save(user);

		if (user != null) {
			return new UserDto(user);
		} else {
			throw new RuntimeException();
		}
	}

	@Override
	@Transactional(readOnly = true)
	public boolean passwordMatch(UserDto dto) {

		if (dto == null || !CommonUtils.isPositive(dto.getId(), true)) {
			return false;
		}

		User user = userRepository.findOne(dto.getId());

		if (user != null) {
			return SecurityUtils.passwordsMatch(user.getPassword(), dto.getPassword());
		} else {
			return false;
		}
	}

	@Override
	@Transactional(rollbackFor = Exception.class)
	public UserDto changePassword(UserDto dto) {

		if (dto == null || !CommonUtils.isPositive(dto.getId(), true) || CommonUtils.isEmpty(dto.getPassword())) {
			return null;
		}

		User user = userRepository.findOne(dto.getId());

		if (user == null) {
			return null;
		}

		user.setPassword(SecurityUtils.getHashPassword(dto.getPassword()));

		user = userRepository.save(user);

		if (user == null) {
			return null;
		} else {
			return new UserDto(user);
		}
	}

	@Override
	public Page<UserDto> findByPageUsername(String username, int pageIndex, int pageSize) {
		Pageable pageable = new PageRequest(pageIndex, pageSize);	
		Page<UserDto> page = userRepository.findByPageUsername(username, pageable);
		return page;
	}
	@Override
	@Transactional(readOnly = true)
	public boolean emailAlreadyUsed(UserDto dto) {

		if (dto == null || CommonUtils.isEmpty(dto.getEmail())) {
			return false;
		}

		User user = userRepository.findByEmail(dto.getEmail());

		return (user!=null);
	}

	@Override
	@Transactional
	public User updateUserLastLogin(Long userId) {
		User user = userRepository.findOne(userId);
		user.setLastLoginTime(new Date());
		return userRepository.save(user);
	}

	@Override
	public User findEntityByUsername(String username) {
		User user = userRepository.findByUsername(username);
		return user;
	}

}
