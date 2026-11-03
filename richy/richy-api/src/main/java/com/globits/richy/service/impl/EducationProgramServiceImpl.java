package com.globits.richy.service.impl;

import java.util.List;

import javax.persistence.EntityManager;
import javax.persistence.Query;
import javax.persistence.LockModeType;

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
import com.globits.richy.dto.EducationProgramDto;
import com.globits.richy.repository.EducationProgramRepository;
import com.globits.richy.service.EducationProgramService;
import com.globits.security.domain.User;

@Service
public class EducationProgramServiceImpl implements EducationProgramService {
	@Autowired
	EntityManager manager;
	@Autowired
	EducationProgramRepository educationProgramRepository;

	@Override
	public Page<EducationProgramDto> getPageObject(EducationProgramDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto == null ? null : searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.EducationProgramDto(s) from EducationProgram s where (1=1)";
		String sqlCount = "select count(s.id) from EducationProgram s where (1=1)";
		String whereClause = "";
        Long schoolId = searchDto == null ? null : searchDto.getSchoolId();
        java.util.Set<Long> permittedSchools = searchDto == null ? null : searchDto.getPermittedSchoolIds();
        if (permittedSchools != null && permittedSchools.isEmpty()) {
            return new PageImpl<>(java.util.Collections.<EducationProgramDto>emptyList(), pageable, 0);
        }
        if (schoolId != null) {
            if (schoolId <= 0) { throw new IllegalArgumentException("School không hợp lệ."); }
            whereClause += " and s.schoolId = :schoolId";
        }
        if (permittedSchools != null) { whereClause += " and s.schoolId in (:permittedSchools)"; }

		if (textSearch != null && textSearch.length() > 0) {
			whereClause += " and (s.name like :textSearch or s.code like :textSearch)";
		}

		sql += whereClause + " order by s.createDate desc, s.id desc";
		sqlCount += whereClause;

		Query q = manager.createQuery(sql, EducationProgramDto.class);
		Query qCount = manager.createQuery(sqlCount);
        if (schoolId != null) { q.setParameter("schoolId", schoolId); qCount.setParameter("schoolId", schoolId); }
        if (permittedSchools != null) {
            q.setParameter("permittedSchools", permittedSchools);
            qCount.setParameter("permittedSchools", permittedSchools);
        }

		if (textSearch != null && textSearch.length() > 0) {
			q.setParameter("textSearch", '%' + textSearch + '%');
			qCount.setParameter("textSearch", '%' + textSearch + '%');
		}

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<EducationProgramDto> page = new PageImpl<EducationProgramDto>(q.getResultList(), pageable, numberResult);
		return page;
	}

	@Override
	public List<EducationProgramDto> getListObject(EducationProgramDto searchDto, int pageIndex, int pageSize) {
		return null;
	}

	@Override
	public EducationProgramDto getObjectById(Long id) {
		return new EducationProgramDto(educationProgramRepository.getOne(id));
	}

	@Override
	@Transactional
	public boolean saveObject(EducationProgramDto dto) {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User modifiedUser = null;
		LocalDateTime currentDate = LocalDateTime.now();
		String currentUserName = "Unknown User";
		if (authentication != null && authentication.getPrincipal() instanceof User) {
			modifiedUser = (User) authentication.getPrincipal();
			currentUserName = modifiedUser.getUsername();
		}
		if(dto == null) {
			return false;
		}
		List<EducationProgram> programs = lockPrograms();
		EducationProgram domain = null;
		if(dto.getId() != null) {
			for (EducationProgram program : programs) if (dto.getId().equals(program.getId())) { domain = program; break; }
			if (domain == null) return false;
		}
		if(domain != null) {
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(currentDate);
		}
		if(domain == null) {
			domain = new EducationProgram();
			domain.setCreateDate(currentDate);
			domain.setCreatedBy(currentUserName);
			domain.setMain(false);
		}
        Long schoolId = dto.getSchoolId() == null ? domain.getSchoolId() : dto.getSchoolId();
        com.globits.richy.domain.School school = schoolId == null ? null : manager.find(com.globits.richy.domain.School.class, schoolId);
        if (school == null || !school.isActive()) { throw new IllegalArgumentException("Chọn School đang hoạt động cho chương trình."); }
        if (!java.util.Objects.equals(domain.getSchoolId(), schoolId)) {
            if (domain.getId() != null && manager.createQuery(
                    "select count(m) from StudentMark m where m.mark.educationProgram.id=:program", Long.class)
                    .setParameter("program", domain.getId()).getSingleResult() > 0) {
                throw new IllegalArgumentException("Chương trình đã có điểm học sinh và cần giữ nguyên School.");
            }
            domain.setMain(false);
        }
        domain.setSchoolId(schoolId);
		if (Boolean.TRUE.equals(dto.getMain())) clearOtherMain(programs, domain.getId(), schoolId);
		if (dto.getMain() != null) domain.setMain(dto.getMain());
		
		domain.setCode(dto.getCode());
		domain.setName(dto.getName());
		domain.setDescription(dto.getDescription());
		domain = educationProgramRepository.save(domain);
		manager.flush();
		
		return true;
	}

	private List<EducationProgram> lockPrograms() {
		return manager.createQuery("select p from EducationProgram p order by p.id", EducationProgram.class)
				.setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultList();
	}

	private void clearOtherMain(List<EducationProgram> programs, Long selectedId, Long schoolId) {
		for (EducationProgram program : programs) {
			if (java.util.Objects.equals(program.getSchoolId(), schoolId) && Boolean.TRUE.equals(program.getMain()) && !program.getId().equals(selectedId)) program.setMain(false);
		}
		// Clear the old flag before setting the new one, including when a unique filtered index is present.
		manager.flush();
	}

	@Override
	@Transactional
	public EducationProgramDto setMain(Long id) {
		List<EducationProgram> programs = lockPrograms();
		EducationProgram selected = null;
		for (EducationProgram program : programs) if (program.getId().equals(id)) { selected = program; break; }
		if (selected == null) throw new IllegalArgumentException("Không tìm thấy chương trình đào tạo.");
        if (selected.getSchoolId() == null) { throw new IllegalArgumentException("Chọn School cho chương trình trước khi đặt Main."); }
		clearOtherMain(programs, id, selected.getSchoolId());
		selected.setMain(true);
		manager.flush();
		return new EducationProgramDto(selected);
	}

	@Override
	@Transactional
	public boolean deleteObject(Long id) {
		if(id == null) {
			return false;
		}
		EducationProgram domain = educationProgramRepository.getOne(id);
		if(domain == null) {
			return false;
		}
		educationProgramRepository.delete(domain);
		return true;
	}

}
