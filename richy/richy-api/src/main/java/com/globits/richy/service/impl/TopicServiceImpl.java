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

import com.globits.richy.test;
import com.globits.richy.domain.Topic;
import com.globits.richy.dto.TopicDto;
import com.globits.richy.dto.TopicForListAllDto;
import com.globits.richy.repository.TopicRepository;
import com.globits.richy.service.TopicService;
import com.globits.security.domain.User;
import com.globits.security.repository.UserRepository;

@Service
public class TopicServiceImpl implements TopicService {
	@Autowired
	EntityManager manager;
	@Autowired
	TopicRepository topicRepository;
	@Autowired
	UserRepository userRepository;
	
	@Override
	public Page<TopicDto> getPageObject(TopicDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();
		String contentSearch = searchDto.getContentSearch();
		
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User modifiedUser = null;
		if (authentication != null) {
			modifiedUser = (User) authentication.getPrincipal();
		}

		String sql = "select new com.globits.richy.dto.TopicDto(s) from Topic s where (1=1)";
		String sqlCount = "select count(s.id) from Topic s where (1=1)";
		String whereClause = "";
		
		if(modifiedUser!= null && modifiedUser.getId() != null) {
			whereClause += " and s.user.id = :userId ";
		}

		if (textSearch != null && textSearch.length() > 0) {
			whereClause += " and (s.name like :textSearch)";
		}
		
		if (contentSearch != null && contentSearch.length() > 0) {
			whereClause += " and (s.content like :contentSearch or s.contentHtml like :contentSearch)";
		}
		
		if(searchDto.getWebsite() != null) {
			whereClause += " and (s.website = :website) ";
		}

		sql += whereClause;
		sqlCount += whereClause;
		
		sql += " order by s.createDate DESC ";

		Query q = manager.createQuery(sql, TopicDto.class);
		Query qCount = manager.createQuery(sqlCount);

		if (textSearch != null && textSearch.length() > 0) {
			q.setParameter("textSearch", '%' + textSearch + '%');
			qCount.setParameter("textSearch", '%' + textSearch + '%');
		}
		
		if (contentSearch != null && contentSearch.length() > 0) {
			q.setParameter("contentSearch", '%' + contentSearch + '%');
			qCount.setParameter("contentSearch", '%' + contentSearch + '%');
		}
		
		if(modifiedUser!= null && modifiedUser.getId() != null) {
			q.setParameter("userId",  modifiedUser.getId() );
			qCount.setParameter("userId",  modifiedUser.getId());
		}
		
		if(searchDto.getWebsite() != null) {
			q.setParameter("website",searchDto.getWebsite());
			qCount.setParameter("website",searchDto.getWebsite());
		}
		
		if(searchDto.getUserId() != null) {
			q.setParameter("userId", searchDto.getUserId());
			qCount.setParameter("userId", searchDto.getUserId());
		}
		

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<TopicDto> page = new PageImpl<TopicDto>(q.getResultList(), pageable, numberResult);
		return page;
	}

	@Override
	public List<TopicDto> getListObject() {
		return topicRepository.getListObject();
	}
	
	@Override
	public List<TopicForListAllDto> getAllTopics(TopicDto searchDto) {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User modifiedUser = null;
		if (authentication != null) {
			modifiedUser = (User) authentication.getPrincipal();
		}

		String sql = "select new com.globits.richy.dto.TopicForListAllDto(s) from Topic s where (1=1)";
		String whereClause = "";
		
		if(modifiedUser!= null && modifiedUser.getId() != null) {
			whereClause += " and s.user.id = :userId ";
		}
		
		if(searchDto.getWebsite() != null) {
			whereClause += " and (s.website = :website) ";
		}

		sql += whereClause;
		
		sql += " order by s.createDate DESC ";

		Query q = manager.createQuery(sql, TopicForListAllDto.class);
		
		if(modifiedUser!= null && modifiedUser.getId() != null) {
			q.setParameter("userId",  modifiedUser.getId() );
		}
		
		if(searchDto.getWebsite() != null) {
			q.setParameter("website",searchDto.getWebsite());
		}
		
		if(searchDto.getUserId() != null) {
			q.setParameter("userId", searchDto.getUserId());
		}

		return q.getResultList();
	}

	@Override
	public TopicDto getObjectById(Long id) {
		return new TopicDto(topicRepository.getOne(id),true);
	}

	@Override
	public TopicDto saveObject(TopicDto dto) {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User modifiedUser = null;
		LocalDateTime currentDate = LocalDateTime.now();
		String currentUserName = "Unknown User";
		
		TopicDto ret = new TopicDto();
		String message = "Successfully";
		
		if (authentication != null) {
			modifiedUser = (User) authentication.getPrincipal();
			currentUserName = modifiedUser.getUsername();
		}
		
		
		
		if(dto == null) {
			return ret;
		}
		Topic domain = null;
		if(dto.getId() != null) {
			domain = topicRepository.getOne(dto.getId());
		}
		if(domain != null) {
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(currentDate);
		}
		if(domain == null) {
			domain = new Topic();
			domain.setCreateDate(currentDate);
			domain.setCreatedBy(currentUserName);
			
			//1 người chỉ được 150 topic mà thôi
			Long numberOfTopics = (long) 0;
			if(modifiedUser.getId() != null) {
				numberOfTopics = topicRepository.countByUserId(modifiedUser.getId());
				if(numberOfTopics > 7000) {
					ret.setMessage("You can only create no more than 7000 topics");
					return ret;
				}
			}
		}
		
		if(dto.getUserId() != null) {
			User user = userRepository.getOne(dto.getUserId());
			if(user != null) {
				domain.setUser(user);
			}
		}
		
		if(test.isShortEnoughString(dto.getName())) {
			domain.setName(dto.getName());
		}else {
			message = "The name of the topic should be less than 100 characters";
		}
		
		domain.setWebsite(dto.getWebsite());
		domain.setContent(dto.getContent());
		domain.setContentHtml(dto.getContentHtml());
		
		domain = topicRepository.save(domain);
		
		ret = new TopicDto(domain);
		ret.setMessage(message);
		
		return ret;
	}

	@Override
	public boolean deleteObject(Long id) {
		if(id == null) {
			return false;
		}
		Topic domain = topicRepository.getOne(id);
		if(domain == null) {
			return false;
		}
		topicRepository.delete(domain);
		return true;
	}

}
