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
import com.globits.richy.domain.Body;
import com.globits.richy.dto.BodyDto;
import com.globits.richy.repository.BodyRepository;
import com.globits.richy.repository.CategoryRepository;
import com.globits.richy.service.BodyService;
import com.globits.security.domain.User;

@Service
public class BodyServiceImpl implements BodyService {
	@Autowired
	EntityManager manager;
	@Autowired
	BodyRepository bodyRepository;
	@Autowired
	CategoryRepository categoryRepository;

	@Override
	public Page<BodyDto> getPageObject(BodyDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.BodyDto(s) from Body s where (1=1)";
		String sqlCount = "select count(s.id) from Body s where (1=1)";
		String whereClause = "";

		if (textSearch != null && textSearch.length() > 0) {
			whereClause += " and (s.text like :textSearch)";
		}

		sql += whereClause;
		sqlCount += whereClause;

		Query q = manager.createQuery(sql, BodyDto.class);
		Query qCount = manager.createQuery(sqlCount);

		if (textSearch != null && textSearch.length() > 0) {
			q.setParameter("textSearch", '%' + textSearch + '%');
			qCount.setParameter("textSearch", '%' + textSearch + '%');
		}

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<BodyDto> page = new PageImpl<BodyDto>(q.getResultList(), pageable, numberResult);
		return page;
	}

	@Override
	public List<BodyDto> getListObject(BodyDto searchDto, int pageIndex, int pageSize) {
		return null;
	}

	@Override
	public BodyDto getObjectById(Long id) {
		return new BodyDto(bodyRepository.getOne(id));
	}

	@Override
	public boolean saveObject(BodyDto dto) {
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
		Body domain = null;
		if(dto.getId() != null) {
			domain = bodyRepository.getOne(dto.getId());
		}
		if(domain != null) {
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(currentDate);
		}
		if(domain == null) {
			domain = new Body();
			domain.setCreateDate(currentDate);
			domain.setCreatedBy(currentUserName);
		}
		domain.setText(dto.getText());
		domain.setRawText(dto.getRawText());
		if(domain.getCategory() != null && domain.getCategory().getId() != null) {
			domain.setCategory(categoryRepository.getOne(domain.getCategory().getId()));
		}
		
		domain = bodyRepository.save(domain);
		return false;
	}

	@Override
	public boolean deleteObject(Long id) {
		if(id == null) {
			return false;
		}
		bodyRepository.delete(id);
		return true;
	}

	@Override
	public boolean saveListObject(BodyDto dto) {
		if(dto == null || dto.getText() == null || dto.getText().length() <= 0) {
			return false;
		}
		String clientText = dto.getText().replaceAll("[.1234567890]", "");
		String[] listClientText = clientText.split("\n");
		for(int i = 0; i < listClientText.length; i++) {
			BodyDto item = new BodyDto();
			String text = listClientText[i].trim();
			text.replaceAll("\\s{2,}", " ").trim();
			item.setText(text);
			//search equal text
			List<Body> domains = bodyRepository.searchEqualText(text);
			if(domains == null || domains.size() <= 0) {
				saveObject(item);
			}
		}
		
		return true;
	}

	@Override
	public List<BodyDto> getRandomAllObject() {
		String sql = "select new com.globits.richy.dto.BodyDto(s) from Body s ORDER BY newid()";

		Query q = manager.createQuery(sql, BodyDto.class);

		List<BodyDto> ret = q.getResultList();
		return ret;
	}

}
