package com.globits.richy.service.impl;

import java.util.HashSet;
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
import com.globits.richy.domain.Question;
import com.globits.richy.domain.QuestionAnswer;
import com.globits.richy.dto.QuestionAnswerDto;
import com.globits.richy.dto.QuestionAnswerDto;
import com.globits.richy.repository.AnswerRepository;
import com.globits.richy.repository.CategoryQuestionRepository;
import com.globits.richy.repository.CategoryRepository;
import com.globits.richy.repository.QuestionAnswerRepository;
import com.globits.richy.repository.QuestionRepository;
import com.globits.richy.repository.QuestionTypeRepository;
import com.globits.richy.service.CategoryQuestionService;
import com.globits.richy.service.QuestionAnswerService;
import com.globits.richy.service.QuestionService;
import com.globits.security.domain.User;

@Service
public class QuestionAnswerServiceImpl implements QuestionAnswerService {
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
	QuestionAnswerRepository questionAnswerRepository;
	@Autowired
	AnswerRepository answerRepository;
	

	@Override
	public Page<QuestionAnswerDto> getPageObject(QuestionAnswerDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.QuestionAnswerDto(s) from QuestionAnswer s where (1=1)";
		String sqlCount = "select count(s.id) from QuestionAnswer s where (1=1)";
		String whereClause = "";

		if (textSearch != null && textSearch.length() > 0) {
			whereClause += " and (s.question.question like :textSearch or s.answer.answer like : textSearch)";
		}

		sql += whereClause;
		sqlCount += whereClause;

		Query q = manager.createQuery(sql, QuestionAnswerDto.class);
		Query qCount = manager.createQuery(sqlCount);

		if (textSearch != null && textSearch.length() > 0) {
			q.setParameter("textSearch", '%' + textSearch + '%');
			qCount.setParameter("textSearch", '%' + textSearch + '%');
		}

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<QuestionAnswerDto> page = new PageImpl<QuestionAnswerDto>(q.getResultList(), pageable, numberResult);
		return page;
	}

	@Override
	public List<QuestionAnswerDto> getListObject(QuestionAnswerDto searchDto, int pageIndex, int pageSize) {
		return null;
	}

	@Override
	public QuestionAnswerDto getObjectById(Long id) {
		return new QuestionAnswerDto(questionAnswerRepository.getOne(id));
	}

	@Override
	public boolean saveObject(QuestionAnswerDto dto) {
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
		QuestionAnswer domain = null;
		if(dto.getId() != null) {
			domain = questionAnswerRepository.getOne(dto.getId());
		}
		if(domain != null) {
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(currentDate);
		}
		if(domain == null) {
			domain = new QuestionAnswer();
			domain.setCreateDate(currentDate);
			domain.setCreatedBy(currentUserName);
		}
		if(dto.getQuestion() != null && dto.getQuestion().getId() != null) {
			domain.setQuestion(questionRepository.getOne(dto.getQuestion().getId()));
		}
		if(dto.getAnswer() != null && dto.getAnswer().getId() != null) {
			domain.setAnswer(answerRepository.getOne(dto.getAnswer().getId()));
		}
		domain.setCorrect(dto.isCorrect());
		domain = questionAnswerRepository.save(domain);
		return false;
	}

	@Override
	public boolean deleteObject(Long id) {
		if(id == null) {
			return false;
		}
		questionAnswerRepository.delete(id);
		return true;
	}

}
