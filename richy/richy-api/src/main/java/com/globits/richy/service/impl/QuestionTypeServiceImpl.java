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
import org.springframework.transaction.annotation.Transactional;

import com.globits.core.domain.Organization;
import com.globits.core.domain.Person;
import com.globits.core.dto.OrganizationDto;
import com.globits.core.dto.PersonDto;
import com.globits.core.repository.OrganizationRepository;
import com.globits.richy.domain.Answer;
import com.globits.richy.domain.QuestionType;
import com.globits.richy.dto.QuestionTypeDto;
import com.globits.richy.repository.QuestionTypeRepository;
import com.globits.richy.service.AnswerService;
import com.globits.richy.service.QuestionTypeService;
import com.globits.security.domain.User;

@Service
public class QuestionTypeServiceImpl implements QuestionTypeService {
	@Autowired
	EntityManager manager;
	@Autowired
	QuestionTypeRepository questionTypeRepository;

	@Override
	public Page<QuestionTypeDto> getPageObject(QuestionTypeDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.QuestionTypeDto(s) from QuestionType s where (1=1)";
		String sqlCount = "select count(s.id) from QuestionType s where (1=1)";
		String whereClause = "";

		if (textSearch != null && textSearch.length() > 0) {
			whereClause += " and (s.name like :textSearch)";
		}

		sql += whereClause;
		sqlCount += whereClause;

		Query q = manager.createQuery(sql, QuestionTypeDto.class);
		Query qCount = manager.createQuery(sqlCount);

		if (textSearch != null && textSearch.length() > 0) {
			q.setParameter("textSearch", '%' + textSearch + '%');
			qCount.setParameter("textSearch", '%' + textSearch + '%');
		}

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<QuestionTypeDto> page = new PageImpl<QuestionTypeDto>(q.getResultList(), pageable, numberResult);
		return page;
	}

	@Override
	public List<QuestionTypeDto> getListObject(QuestionTypeDto searchDto, int pageIndex, int pageSize) {
		return null;
	}

	@Override
	public QuestionTypeDto getObjectById(Long id) {
		return new QuestionTypeDto(questionTypeRepository.getOne(id));
	}

	@Override
	public boolean saveObject(QuestionTypeDto dto) {
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
		QuestionType domain = null;
		if(dto.getId() != null) {
			domain = questionTypeRepository.getOne(dto.getId());
		}
		if(domain != null) {
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(currentDate);
		}
		if(domain == null) {
			domain = new QuestionType();
			domain.setCreateDate(currentDate);
			domain.setCreatedBy(currentUserName);
		}
		domain.setName(dto.getName());
		domain.setCode(dto.getCode());
		domain = questionTypeRepository.save(domain);
		return false;
	}

	@Override
	public boolean deleteObject(Long id) {
		if(id == null) {
			return false;
		}
		questionTypeRepository.delete(id);
		return true;
	}

}
