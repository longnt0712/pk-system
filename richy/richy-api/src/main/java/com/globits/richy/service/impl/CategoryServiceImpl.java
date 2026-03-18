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
import com.globits.richy.domain.Category;
import com.globits.richy.dto.CategoryDto;
import com.globits.richy.repository.BodyRepository;
import com.globits.richy.repository.CategoryRepository;
import com.globits.richy.service.CategoryService;
import com.globits.security.domain.User;

@Service
public class CategoryServiceImpl implements CategoryService {
	@Autowired
	EntityManager manager;
	@Autowired
	BodyRepository bodyRepository;
	@Autowired
	CategoryRepository categoryRepository;

	@Override
	public Page<CategoryDto> getPageObject(CategoryDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.CategoryDto(s) from Category s where (1=1)";
		String sqlCount = "select count(s.id) from Body s where (1=1)";
		String whereClause = "";

		if (textSearch != null && textSearch.length() > 0) {
			whereClause += " and (s.text like :textSearch)";
		}

		sql += whereClause;
		sqlCount += whereClause;

		Query q = manager.createQuery(sql, CategoryDto.class);
		Query qCount = manager.createQuery(sqlCount);

		if (textSearch != null && textSearch.length() > 0) {
			q.setParameter("textSearch", '%' + textSearch + '%');
			qCount.setParameter("textSearch", '%' + textSearch + '%');
		}

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<CategoryDto> page = new PageImpl<CategoryDto>(q.getResultList(), pageable, numberResult);
		return page;
	}

	@Override
	public List<CategoryDto> getListObject(CategoryDto searchDto, int pageIndex, int pageSize) {
		return null;
	}

	@Override
	public CategoryDto getObjectById(Long id) {
		return new CategoryDto(categoryRepository.getOne(id));
	}

	@Override
	public boolean saveObject(CategoryDto dto) {
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
		Category domain = null;
		if(dto.getId() != null) {
			domain = categoryRepository.getOne(dto.getId());
		}
		if(domain != null) {
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(currentDate);
		}
		if(domain == null) {
			domain = new Category();
			domain.setCreateDate(currentDate);
			domain.setCreatedBy(currentUserName);
		}
		domain.setName(dto.getName());
		domain.setCode(dto.getCode());
		domain.setOrdinalCategory(dto.getOrdinalCategory());
		
		domain = categoryRepository.save(domain);
		return false;
	}

	@Override
	public boolean deleteObject(Long id) {
		if(id == null) {
			return false;
		}
		categoryRepository.delete(id);
		return true;
	}
}
