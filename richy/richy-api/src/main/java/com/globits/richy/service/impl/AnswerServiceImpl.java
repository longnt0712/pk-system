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
import com.globits.richy.domain.Answer;
import com.globits.richy.dto.AnswerDto;
import com.globits.richy.repository.AnswerRepository;
import com.globits.richy.service.AnswerService;
import com.globits.security.domain.User;

@Service
public class AnswerServiceImpl implements AnswerService {
	@Autowired
	EntityManager manager;
	@Autowired
	AnswerRepository answerRepository;

	@Override
	public Page<AnswerDto> getPageObject(AnswerDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.AnswerDto(s) from Answer s where (1=1)";
		String sqlCount = "select count(s.id) from Answer s where (1=1)";
		String whereClause = "";

		if (textSearch != null && textSearch.length() > 0) {
			whereClause += " and (s.text like :textSearch)";
		}

		sql += whereClause;
		sqlCount += whereClause;

		Query q = manager.createQuery(sql, AnswerDto.class);
		Query qCount = manager.createQuery(sqlCount);

		if (textSearch != null && textSearch.length() > 0) {
			q.setParameter("textSearch", '%' + textSearch + '%');
			qCount.setParameter("textSearch", '%' + textSearch + '%');
		}

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<AnswerDto> page = new PageImpl<AnswerDto>(q.getResultList(), pageable, numberResult);
		return page;
	}

	@Override
	public List<AnswerDto> getListObject(AnswerDto searchDto, int pageIndex, int pageSize) {
		return null;
	}

	@Override
	public AnswerDto getObjectById(Long id) {
		return new AnswerDto(answerRepository.getOne(id));
	}

	@Override
	public boolean saveObject(AnswerDto dto) {
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
		Answer domain = null;
		if(dto.getId() != null) {
			domain = answerRepository.getOne(dto.getId());
		}
		if(domain != null) {
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(currentDate);
		}
		if(domain == null) {
			domain = new Answer();
			domain.setCreateDate(currentDate);
			domain.setCreatedBy(currentUserName);
		}
		String answer = "";
		if(dto.getAnswer() != null) {
			answer = dto.getAnswer().trim();
		}
		domain.setAnswer(answer);
		domain.setText(dto.getText());
		domain = answerRepository.save(domain);
		
		return false;
	}

	@Override
	public boolean deleteObject(Long id) {
		if(id == null) {
			return false;
		}
		Answer domain = answerRepository.getOne(id);
		if(domain == null) {
			return false;
		}
		answerRepository.delete(domain);
		return true;
	}

}
