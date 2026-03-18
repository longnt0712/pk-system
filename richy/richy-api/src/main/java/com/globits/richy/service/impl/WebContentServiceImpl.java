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
import com.globits.richy.domain.WebContent;
import com.globits.richy.dto.WebContentDto;
import com.globits.richy.repository.WebContentRepository;
import com.globits.richy.service.WebContentService;
import com.globits.security.domain.User;

@Service
public class WebContentServiceImpl implements WebContentService {
	@Autowired
	EntityManager manager;
	@Autowired
	WebContentRepository webContentRepository;

	@Override
	public Page<WebContentDto> getPageObject(WebContentDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.WebContentDto(s) from WebContent s where (1=1)";
		String sqlCount = "select count(s.id) from WebContent s where (1=1)";
		String whereClause = "";

		if (textSearch != null && textSearch.length() > 0) {
			whereClause += " and (s.text like :textSearch)";
		}
		
		if(searchDto.getContentFor() != null) {
			whereClause += " and (s.contentFor = :contentFor)";
		}
		
//		if (searchDto.getWebsite() != null) {
//			whereClause += " and (s.website = :website)";
//		}

		sql += whereClause;
		sqlCount += whereClause;
		
		sql += " order by s.contentFor ASC ";

		Query q = manager.createQuery(sql, WebContentDto.class);
		Query qCount = manager.createQuery(sqlCount);

		if (textSearch != null && textSearch.length() > 0) {
			q.setParameter("textSearch", '%' + textSearch + '%');
			qCount.setParameter("textSearch", '%' + textSearch + '%');
		}
		
		if (searchDto.getContentFor() != null) {
			q.setParameter("contentFor", searchDto.getContentFor());
			qCount.setParameter("contentFor", searchDto.getContentFor() );
		}

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<WebContentDto> page = new PageImpl<WebContentDto>(q.getResultList(), pageable, numberResult);
		return page;
	}

	@Override
	public List<WebContentDto> getListObject(WebContentDto searchDto, int pageIndex, int pageSize) {
		return null;
	}

	@Override
	public WebContentDto getObjectById(Long id) {
		return new WebContentDto(webContentRepository.getOne(id));
	}

	
//	public WebContentDto findByUrl(String url) {
//		return webContentRepository.findByUrl(url);
//	}
	
	@Override
	public WebContentDto saveObject(WebContentDto dto) {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User modifiedUser = null;
		LocalDateTime currentDate = LocalDateTime.now();
		String currentUserName = "Unknown User";
		if (authentication != null) {
			modifiedUser = (User) authentication.getPrincipal();
			currentUserName = modifiedUser.getUsername();
		}
		if(dto == null) {
			return null;
		}
		WebContent domain = null;
		if(dto.getId() != null) {
			domain = webContentRepository.getOne(dto.getId());
		}
		if(domain != null) {
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(currentDate);
		}
		if(domain == null) {
			domain = new WebContent();
			domain.setCreateDate(currentDate);
			domain.setCreatedBy(currentUserName);
		}
		
		domain.setHeader(dto.getHeader());
		domain.setText1(dto.getText1());
		domain.setText2(dto.getText2());
		domain.setText3(dto.getText3());
		domain.setText4(dto.getText4());
		domain.setText5(dto.getText5());
		domain.setText6(dto.getText6());
		domain.setText7(dto.getText7());
		domain.setText8(dto.getText8());
		domain.setText9(dto.getText9());
		domain.setText10(dto.getText10());
		domain.setContentFor(dto.getContentFor());
		domain.setPhoto(dto.getPhoto());
		domain.setVideoUrl(dto.getVideoUrl());
		
		domain = webContentRepository.save(domain);
		
		return new WebContentDto(domain);
	}

	@Override
	public boolean deleteObject(Long id) {
		if(id == null) {
			return false;
		}
		WebContent domain = webContentRepository.getOne(id);
		if(domain == null) {
			return false;
		}
		webContentRepository.delete(domain);
		return true;
	}

}
