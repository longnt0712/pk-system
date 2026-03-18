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
import com.globits.richy.domain.CategoryQuestion;
import com.globits.richy.dto.CategoryQuestionDto;
import com.globits.richy.repository.CategoryQuestionRepository;
import com.globits.richy.repository.CategoryRepository;
import com.globits.richy.repository.QuestionRepository;
import com.globits.richy.service.CategoryQuestionService;
import com.globits.security.domain.User;

@Service
public class CategoryQuestionServiceImpl implements CategoryQuestionService {
	@Autowired
	EntityManager manager;
	@Autowired
	CategoryQuestionRepository categoryQuestionRepository;
	@Autowired
	CategoryRepository categoryRepository;
	@Autowired
	QuestionRepository questionRepository;

	@Override
	public Page<CategoryQuestionDto> getPageObject(CategoryQuestionDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.CategoryQuestionDto(s) from CategoryQuestion s where (1=1)";
		String sqlCount = "select count(s.id) from CategoryQuestion s where (1=1)";
		String whereClause = "";

		if (textSearch != null && textSearch.length() > 0) {
			whereClause += " and (s.answer like :textSearch)";
		}

		sql += whereClause;
		sqlCount += whereClause;

		Query q = manager.createQuery(sql, CategoryQuestionDto.class);
		Query qCount = manager.createQuery(sqlCount);

		if (textSearch != null && textSearch.length() > 0) {
			q.setParameter("textSearch", '%' + textSearch + '%');
			qCount.setParameter("textSearch", '%' + textSearch + '%');
		}

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<CategoryQuestionDto> page = new PageImpl<CategoryQuestionDto>(q.getResultList(), pageable, numberResult);
		return page;
	}

	@Override
	public List<CategoryQuestionDto> getListObject(CategoryQuestionDto searchDto, int pageIndex, int pageSize) {
		return null;
	}

	@Override
	public CategoryQuestionDto getObjectById(Long id) {
		return new CategoryQuestionDto(categoryQuestionRepository.getOne(id));
	}

	@Override
	public boolean saveObject(CategoryQuestionDto dto) {
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
		CategoryQuestion domain = null;
		if(dto.getId() != null) {
			domain = categoryQuestionRepository.getOne(dto.getId());
		}
		if(domain != null) {
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(currentDate);
		}
		if(domain == null) {
			domain = new CategoryQuestion();
			domain.setCreateDate(currentDate);
			domain.setCreatedBy(currentUserName);
		}
		if(domain.getCategory() != null && domain.getCategory().getId() != null) {
			domain.setCategory(categoryRepository.getOne(domain.getCategory().getId()));
		}
		if(domain.getQuestion() != null && domain.getQuestion().getId() != null) {
			domain.setQuestion(questionRepository.getOne(domain.getQuestion().getId()));
		}
		
		domain = categoryQuestionRepository.save(domain);
		return false;
	}

	@Override
	public boolean deleteObject(Long id) {
		if(id == null) {
			return false;
		}
		categoryQuestionRepository.delete(id);
		return true;
	}

}
