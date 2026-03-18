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

import com.globits.richy.domain.EducationProgram;
import com.globits.richy.domain.Mark;
import com.globits.richy.dto.MarkDto;
import com.globits.richy.repository.EducationProgramRepository;
import com.globits.richy.repository.MarkRepository;
import com.globits.richy.service.MarkService;
import com.globits.security.domain.User;

@Service
public class MarkServiceImpl implements MarkService {
	@Autowired
	EntityManager manager;
	@Autowired
	MarkRepository markRepository;
	@Autowired
	EducationProgramRepository educationProgramRepository;
	
	@Override
	public Page<MarkDto> getPageObject(MarkDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.MarkDto(s) from Mark s where (1=1)";
		String sqlCount = "select count(s.id) from Mark s where (1=1)";
		String whereClause = "";

		if (textSearch != null && textSearch.length() > 0) {
			whereClause += " and (s.text like :textSearch)";
		}
		
		if(searchDto != null && searchDto.getEducationProgram() != null && searchDto.getEducationProgram().getId() != null) {
			whereClause += " and (s.educationProgram.id = :educationProgramId) ";
		}

		sql += whereClause;
		sqlCount += whereClause;

		Query q = manager.createQuery(sql, MarkDto.class);
		Query qCount = manager.createQuery(sqlCount);

		if (textSearch != null && textSearch.length() > 0) {
			q.setParameter("textSearch", '%' + textSearch + '%');
			qCount.setParameter("textSearch", '%' + textSearch + '%');
		}
		
		if(searchDto != null && searchDto.getEducationProgram() != null && searchDto.getEducationProgram().getId() != null) {
			q.setParameter("educationProgramId",  searchDto.getEducationProgram().getId() );
			qCount.setParameter("educationProgramId", searchDto.getEducationProgram().getId() );
		}

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<MarkDto> page = new PageImpl<MarkDto>(q.getResultList(), pageable, numberResult);
		return page;
	}

	@Override
	public List<MarkDto> getListObject(MarkDto searchDto, int pageIndex, int pageSize) {
		return null;
	}

	@Override
	public MarkDto getObjectById(Long id) {
		return new MarkDto(markRepository.getOne(id));
	}

	@Override
	public MarkDto saveObject(MarkDto dto) {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User modifiedUser = null;
		LocalDateTime currentDate = LocalDateTime.now();
		String currentUserName = "Unknown User";
		if (authentication != null) {
			modifiedUser = (User) authentication.getPrincipal();
			currentUserName = modifiedUser.getUsername();
		}

		if(dto == null) {
			return dto;
		}
		Mark domain = null;
		String saveType = "...";
		if(dto.getId() != null) {
			domain = markRepository.getOne(dto.getId());
		}
		if(domain != null) {
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(currentDate);
			saveType = "SỬA";
		}
		if(domain == null) {
			domain = new Mark();
			domain.setCreateDate(currentDate);
			domain.setCreatedBy(currentUserName);
			saveType = "THÊM MỚI";
		}
		
		if(dto.getCode() == null) {
			dto.setMessage("Chưa có mã");
			return dto;
		}
		if(dto.getName() == null) {
			dto.setMessage("Chưa có tên");
			return dto;
		}
		if(dto.getCoefficient() == null) {
			dto.setMessage("Chưa có hệ số");
			return dto;
		}
		if(dto.getEducationProgram() == null) {
			dto.setMessage("Chưa có chương trình");
			return dto;
		}
		
		domain.setCode(dto.getCode());
		domain.setName(dto.getName());
		domain.setCoefficient(dto.getCoefficient());
//		domain.setMarkNumber(dto.getMarkNumber());
//		domain.setMarkText(dto.getMarkText());
		if(dto.getEducationProgram() != null && dto.getEducationProgram().getId() != null) {
			EducationProgram educationProgram = educationProgramRepository.getOne(dto.getEducationProgram().getId());
			if(educationProgram != null) {
				domain.setEducationProgram(educationProgram);
			}
		}
		domain.setDescription(dto.getDescription());
		domain = markRepository.save(domain);
		
		MarkDto ret = new MarkDto(domain);
		ret.setMessage(saveType + " THÀNH CÔNG");
		
		return ret;
	}

	@Override
	public boolean deleteObject(Long id) {
		if(id == null) {
			return false;
		}
		Mark domain = markRepository.getOne(id);
		if(domain == null) {
			return false;
		}
		markRepository.delete(domain);
		return true;
	}

}
