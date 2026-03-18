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

import com.globits.richy.domain.QuestionTopic;
import com.globits.richy.dto.QuestionTopicDto;
import com.globits.richy.repository.TopicRepository;
import com.globits.richy.repository.CategoryQuestionRepository;
import com.globits.richy.repository.CategoryRepository;
import com.globits.richy.repository.QuestionTopicRepository;
import com.globits.richy.repository.QuestionRepository;
import com.globits.richy.repository.QuestionTypeRepository;
import com.globits.richy.service.QuestionTopicService;
import com.globits.security.domain.User;

@Service
public class QuestionTopicServiceImpl implements QuestionTopicService {
	@Autowired
	EntityManager manager;
	@Autowired
	CategoryQuestionRepository categoryQuestionRepository;
	@Autowired
	CategoryRepository categoryRepository;
	@Autowired
	QuestionRepository questionRepository;
	@Autowired
	QuestionTypeRepository questionTypeRepository;
	@Autowired
	QuestionTopicRepository questionTopicRepository;
	@Autowired
	TopicRepository TopicRepository;
	

	@Override
	public Page<QuestionTopicDto> getPageObject(QuestionTopicDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.QuestionTopicDto(s) from QuestionTopic s where (1=1)";
		String sqlCount = "select count(s.id) from QuestionTopic s where (1=1)";
		String whereClause = "";

		if (textSearch != null && textSearch.length() > 0) {
			whereClause += " and (s.question.question like :textSearch or s.Topic.Topic like : textSearch)";
		}

		sql += whereClause;
		sqlCount += whereClause;

		Query q = manager.createQuery(sql, QuestionTopicDto.class);
		Query qCount = manager.createQuery(sqlCount);

		if (textSearch != null && textSearch.length() > 0) {
			q.setParameter("textSearch", '%' + textSearch + '%');
			qCount.setParameter("textSearch", '%' + textSearch + '%');
		}

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<QuestionTopicDto> page = new PageImpl<QuestionTopicDto>(q.getResultList(), pageable, numberResult);
		return page;
	}

	@Override
	public List<QuestionTopicDto> getListObject(QuestionTopicDto searchDto, int pageIndex, int pageSize) {
		return null;
	}

	@Override
	public QuestionTopicDto getObjectById(Long id) {
		return new QuestionTopicDto(questionTopicRepository.getOne(id));
	}

	@Override
	public boolean saveObject(QuestionTopicDto dto) {
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
		QuestionTopic domain = null;
		if(dto.getId() != null) {
			domain = questionTopicRepository.getOne(dto.getId());
		}
		if(domain != null) {
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(currentDate);
		}
		if(domain == null) {
			domain = new QuestionTopic();
			domain.setCreateDate(currentDate);
			domain.setCreatedBy(currentUserName);
		}
		if(dto.getQuestion() != null && dto.getQuestion().getId() != null) {
			domain.setQuestion(questionRepository.getOne(dto.getQuestion().getId()));
		}
		if(dto.getTopic() != null && dto.getTopic().getId() != null) {
			domain.setTopic(TopicRepository.getOne(dto.getTopic().getId()));
		}
		domain = questionTopicRepository.save(domain);
		return false;
	}

	@Override
	public boolean deleteObject(Long id) {
		if(id == null) {
			return false;
		}
		questionTopicRepository.delete(id);
		return true;
	}

}
