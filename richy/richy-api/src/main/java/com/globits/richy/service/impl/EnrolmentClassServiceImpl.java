package com.globits.richy.service.impl;

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
import com.globits.richy.domain.EnrolmentClass;
import com.globits.richy.dto.EnrolmentClassDto;
import com.globits.richy.repository.EnrolmentClassRepository;
import com.globits.richy.service.EnrolmentClassService;
import com.globits.security.domain.User;

@Service
public class EnrolmentClassServiceImpl implements EnrolmentClassService {
	@Autowired
	EntityManager manager;
	@Autowired
	EnrolmentClassRepository enrolmentClassRepository;

	@Override
	public Page<EnrolmentClassDto> getPageObject(EnrolmentClassDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.EnrolmentClassDto(s) from EnrolmentClass s where (1=1)";
		String sqlCount = "select count(s.id) from EnrolmentClass s where (1=1)";
		String whereClause = "";

		if (textSearch != null && textSearch.length() > 0) {
			whereClause += " and (s.text like :textSearch)";
		}

		sql += whereClause;
		sqlCount += whereClause;

		Query q = manager.createQuery(sql, EnrolmentClassDto.class);
		Query qCount = manager.createQuery(sqlCount);

		if (textSearch != null && textSearch.length() > 0) {
			q.setParameter("textSearch", '%' + textSearch + '%');
			qCount.setParameter("textSearch", '%' + textSearch + '%');
		}

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<EnrolmentClassDto> page = new PageImpl<EnrolmentClassDto>(q.getResultList(), pageable, numberResult);
		return page;
	}

	@Override
	public List<EnrolmentClassDto> getListObject(EnrolmentClassDto searchDto, int pageIndex, int pageSize) {
		return null;
	}

	@Override
	public EnrolmentClassDto getObjectById(Long id) {
		return new EnrolmentClassDto(enrolmentClassRepository.getOne(id));
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
		if(dto == null) {
			return false;
		}
		EnrolmentClass domain = null;
		if(dto.getId() != null) {
			domain = enrolmentClassRepository.getOne(dto.getId());
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
		
		if(dto.getSchoolId() != null) {
			domain.setSchoolId(dto.getSchoolId());
		}
		
		domain = enrolmentClassRepository.save(domain);
		
		return false;
	}

	@Override
	public boolean deleteObject(Long id) {
		if(id == null) {
			return false;
		}
		EnrolmentClass domain = enrolmentClassRepository.getOne(id);
		if(domain == null) {
			return false;
		}
		enrolmentClassRepository.delete(domain);
		return true;
	}

}
