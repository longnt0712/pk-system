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

import com.globits.richy.domain.AllSizes;
import com.globits.richy.dto.AllSizesDto;
import com.globits.richy.repository.AllSizesRepository;
import com.globits.richy.service.AllSizesService;
import com.globits.security.domain.User;

@Service
public class AllSizesServiceImpl implements AllSizesService {
	@Autowired
	EntityManager manager;
	@Autowired
	AllSizesRepository allSIzesRepository;

	@Override
	public Page<AllSizesDto> getPageObject(AllSizesDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

//		String textSearch = searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.AllSizesDto(s) from AllSizes s where (1=1)";
		String sqlCount = "select count(s.id) from AllSizes s where (1=1)";
		String whereClause = "";

//		if (textSearch != null && textSearch.length() > 0) {
//			whereClause += " and (s.name like :textSearch or s.code like :textSearch)";
//		}
		
		if(searchDto.getWebsite() != null) {
			whereClause += " and (s.website = :website)";
		}
		
		sql += whereClause + " order by s.important";
		sqlCount += whereClause;
		

		Query q = manager.createQuery(sql, AllSizesDto.class);
		Query qCount = manager.createQuery(sqlCount);

//		if (textSearch != null && textSearch.length() > 0) {
//			q.setParameter("textSearch", '%' + textSearch + '%');
//			qCount.setParameter("textSearch", '%' + textSearch + '%');
//		}
		
		if(searchDto.getWebsite() != null) {
			q.setParameter("website",searchDto.getWebsite());
			qCount.setParameter("website",searchDto.getWebsite());
		}
		
		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<AllSizesDto> page = new PageImpl<AllSizesDto>(q.getResultList(), pageable, numberResult);
		return page;
	}

	@Override
	public List<AllSizesDto> getListObject(AllSizesDto searchDto, int pageIndex, int pageSize) {
		return null;
	}

	@Override
	public AllSizesDto getObjectById(Long id) {
		return new AllSizesDto(allSIzesRepository.getOne(id));
	}

	@Override
	public boolean saveObject(AllSizesDto dto) {
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
		AllSizes domain = null;
		if(dto.getId() != null) {
			domain = allSIzesRepository.getOne(dto.getId());
		}
		if(domain != null) {
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(currentDate);
		}
		if(domain == null) {
			domain = new AllSizes();
			domain.setCreateDate(currentDate);
			domain.setCreatedBy(currentUserName);
		}
		
		domain.setSizeVn(dto.getSizeVn());
		domain.setWebsite(dto.getWebsite());
		domain.setImportant(dto.getImportant());
		domain = allSIzesRepository.save(domain);
		
		return false;
	}

	@Override
	public boolean deleteObject(Long id) {
		if(id == null) {
			return false;
		}
		AllSizes domain = allSIzesRepository.getOne(id);
		if(domain == null) {
			return false;
		}
		allSIzesRepository.delete(domain);
		return true;
	}

}
