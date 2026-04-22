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
import com.globits.richy.domain.TopicCategory;
import com.globits.richy.dto.TopicCategoryDto;
import com.globits.richy.repository.TopicCategoryRepository;
import com.globits.richy.service.TopicCategoryService;
import com.globits.security.domain.User;

@Service
public class TopicCategoryServiceImpl implements TopicCategoryService {
	@Autowired
	EntityManager manager;
	@Autowired
	TopicCategoryRepository topicCategoryRepository;

	@Override
	public Page<TopicCategoryDto> getPageObject(TopicCategoryDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

//		String textSearch = searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.TopicCategoryDto(s) from TopicCategory s where (1=1)";
		String sqlCount = "select count(s.id) from TopicCategory s where (1=1)";
		String whereClause = "";

//		if (textSearch != null && textSearch.length() > 0) {
//			whereClause += " and (s.text like :textSearch)";
//		}

		sql += whereClause;
		sqlCount += whereClause;

		Query q = manager.createQuery(sql, TopicCategoryDto.class);
		Query qCount = manager.createQuery(sqlCount);

//		if (textSearch != null && textSearch.length() > 0) {
//			q.setParameter("textSearch", '%' + textSearch + '%');
//			qCount.setParameter("textSearch", '%' + textSearch + '%');
//		}

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<TopicCategoryDto> page = new PageImpl<TopicCategoryDto>(q.getResultList(), pageable, numberResult);
		return page;
	}

//	@Override
//	public List<TopicCategoryDto> getListObject(TopicCategoryDto searchDto, int pageIndex, int pageSize) {
//		return null;
//	}

	@Override
	public TopicCategoryDto getObjectById(Long id) {
		return new TopicCategoryDto(topicCategoryRepository.getOne(id));
	}

	@Override
	public boolean saveObject(TopicCategoryDto dto) {
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
		TopicCategory domain = null;
		if(dto.getId() != null) {
			domain = topicCategoryRepository.getOne(dto.getId());
		}
		if(domain != null) {
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(currentDate);
		}
		if(domain == null) {
			domain = new TopicCategory();
			domain.setCreateDate(currentDate);
			domain.setCreatedBy(currentUserName);
		}
		
		domain.setName(dto.getName());
		domain = topicCategoryRepository.save(domain);
		
		return false;
	}

	@Override
	public boolean deleteObject(Long id) {
		if(id == null) {
			return false;
		}
		TopicCategory domain = topicCategoryRepository.getOne(id);
		if(domain == null) {
			return false;
		}
		topicCategoryRepository.delete(domain);
		return true;
	}

}
