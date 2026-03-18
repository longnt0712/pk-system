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
import com.globits.richy.domain.Folder;
import com.globits.richy.dto.FolderDto;
import com.globits.richy.repository.FolderRepository;
import com.globits.richy.service.FolderService;
import com.globits.security.domain.User;

@Service
public class FolderServiceImpl implements FolderService {
	@Autowired
	EntityManager manager;
	@Autowired
	FolderRepository folderRepository;

	@Override
	public Page<FolderDto> getPageObject(FolderDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.FolderDto(s) from Folder s where (1=1)";
		String sqlCount = "select count(s.id) from Folder s where (1=1)";
		String whereClause = "";

		if (textSearch != null && textSearch.length() > 0) {
			whereClause += " and (s.text like :textSearch)";
		}
		
		if (searchDto.getWebsite() != null) {
			whereClause += " and (s.website = :website)";
		}

		sql += whereClause;
		sqlCount += whereClause;

		Query q = manager.createQuery(sql, FolderDto.class);
		Query qCount = manager.createQuery(sqlCount);

		if (textSearch != null && textSearch.length() > 0) {
			q.setParameter("textSearch", '%' + textSearch + '%');
			qCount.setParameter("textSearch", '%' + textSearch + '%');
		}
		
		if (searchDto.getWebsite() != null) {
			q.setParameter("website", searchDto.getWebsite());
			qCount.setParameter("website", searchDto.getWebsite() );
		}

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<FolderDto> page = new PageImpl<FolderDto>(q.getResultList(), pageable, numberResult);
		return page;
	}

	@Override
	public List<FolderDto> getListObject(FolderDto searchDto, int pageIndex, int pageSize) {
		return null;
	}

	@Override
	public FolderDto getObjectById(Long id) {
		return new FolderDto(folderRepository.getOne(id));
	}

	
	public FolderDto findByUrl(String url) {
		return folderRepository.findByUrl(url);
	}
	
	@Override
	public boolean saveObject(FolderDto dto) {
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
		Folder domain = null;
		if(dto.getId() != null) {
			domain = folderRepository.getOne(dto.getId());
		}
		if(domain != null) {
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(currentDate);
		}
		if(domain == null) {
			domain = new Folder();
			domain.setCreateDate(currentDate);
			domain.setCreatedBy(currentUserName);
		}
		
		domain.setCode(dto.getCode());
		domain.setName(dto.getName());
		domain.setUrl(dto.getUrl());
		domain.setType(dto.getType());
		domain.setWebsite(dto.getWebsite());
		if(dto.getParent() != null && dto.getParent().getId() != null) {
			Folder f = folderRepository.getOne(dto.getParent().getId());
			if(f != null) {
				domain.setParent(f);
			}
		}
		
		domain = folderRepository.save(domain);
		
		return false;
	}

	@Override
	public boolean deleteObject(Long id) {
		if(id == null) {
			return false;
		}
		Folder domain = folderRepository.getOne(id);
		if(domain == null) {
			return false;
		}
		folderRepository.delete(domain);
		return true;
	}

}
