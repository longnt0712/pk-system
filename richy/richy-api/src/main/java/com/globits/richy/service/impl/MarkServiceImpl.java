package com.globits.richy.service.impl;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

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
import org.springframework.transaction.annotation.Transactional;

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
		sql += " order by s.educationProgram.id, "
				+ "coalesce(s.displayOrder, 2147483647), s.createDate, s.id";
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
	public List<MarkDto> getOrderedMarks(Long educationProgramId) {
		List<MarkDto> result = new ArrayList<MarkDto>();
		if (educationProgramId == null) {
			return result;
		}

		List<Mark> marks = markRepository.findMarkBy(educationProgramId);
		if (marks == null) {
			return result;
		}

		for (Mark mark : marks) {
			if (mark != null) {
				result.add(new MarkDto(mark));
			}
		}

		return result;
	}

	@Override
	@Transactional
	public List<MarkDto> reorderMarks(Long educationProgramId, List<Long> orderedMarkIds) {
		List<MarkDto> result = new ArrayList<MarkDto>();
		if (educationProgramId == null) {
			return result;
		}

		List<Mark> currentMarks = markRepository.findMarkBy(educationProgramId);
		if (currentMarks == null || currentMarks.isEmpty()) {
			return result;
		}

		Map<Long, Mark> marksById = new LinkedHashMap<Long, Mark>();
		for (Mark mark : currentMarks) {
			if (mark != null && mark.getId() != null) {
				marksById.put(mark.getId(), mark);
			}
		}

		List<Mark> orderedMarks = new ArrayList<Mark>();
		Set<Long> addedIds = new HashSet<Long>();

		if (orderedMarkIds != null) {
			for (Long markId : orderedMarkIds) {
				Mark mark = marksById.get(markId);
				if (mark != null && addedIds.add(markId)) {
					orderedMarks.add(mark);
				}
			}
		}

		/*
		 * Nếu một đầu điểm vừa được thêm ở tab khác trong lúc người dùng đang kéo,
		 * giữ nó lại và nối xuống cuối thay vì làm mất thứ tự/dữ liệu.
		 */
		for (Mark mark : currentMarks) {
			if (mark != null && mark.getId() != null && addedIds.add(mark.getId())) {
				orderedMarks.add(mark);
			}
		}

		String currentUserName = "Unknown User";
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication != null) {
			currentUserName = authentication.getName();
		}
		LocalDateTime currentDate = LocalDateTime.now();

		for (int i = 0; i < orderedMarks.size(); i++) {
			Mark mark = orderedMarks.get(i);
			mark.setDisplayOrder(i + 1);
			mark.setModifiedBy(currentUserName);
			mark.setModifyDate(currentDate);
			markRepository.save(mark);
			result.add(new MarkDto(mark));
		}

		return result;
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
		boolean isNewDomain = false;
		String saveType = "...";
		if(dto.getId() != null) {
			domain = markRepository.getOne(dto.getId());
		}
		Long originalEducationProgramId = null;
		if (domain != null && domain.getEducationProgram() != null) {
			originalEducationProgramId = domain.getEducationProgram().getId();
		}
		if(domain != null) {
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(currentDate);
			saveType = "SỬA";
		}
		if(domain == null) {
			domain = new Mark();
			isNewDomain = true;
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
				boolean educationProgramChanged = !isNewDomain
						&& (originalEducationProgramId == null
						|| !originalEducationProgramId.equals(educationProgram.getId()));
				if (isNewDomain || educationProgramChanged) {
					Integer maxDisplayOrder = markRepository
							.findMaxDisplayOrderByEducationProgramId(educationProgram.getId());
					domain.setDisplayOrder(maxDisplayOrder == null ? 1 : maxDisplayOrder + 1);
				} else if (dto.getDisplayOrder() != null) {
					domain.setDisplayOrder(dto.getDisplayOrder());
				}
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
