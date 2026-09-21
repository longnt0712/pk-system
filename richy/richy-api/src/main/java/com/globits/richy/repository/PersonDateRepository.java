package com.globits.richy.repository;

import java.util.List;

import org.joda.time.LocalDateTime;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.PersonDate;
@Repository
public interface PersonDateRepository extends JpaRepository<PersonDate, Long> {
	@Query("select count(u.id) from PersonDate u where (u.schoolId = ?1 or (u.schoolId is null and ((?1 = 2 and (u.statusMass is not null or u.extraClass is not null)) or (?1 = 1 and u.statusMass is null and u.extraClass is null)))) and u.createDate >= ?2 and u.createDate < ?3")
	Long countPersonDateBySchoolId(Integer schoolId, LocalDateTime startDate, LocalDateTime endDate);
	
	@Query("select u from PersonDate u where u.user.username = ?1 and (u.schoolId = ?2 or (u.schoolId is null and ((?2 = 2 and (u.statusMass is not null or u.extraClass is not null)) or (?2 = 1 and u.statusMass is null and u.extraClass is null)))) and u.createDate >= ?3 and u.createDate < ?4")
	PersonDate getBy(String username, Integer schoolId, LocalDateTime startDate, LocalDateTime endDate);

	@Query("select p from PersonDate p where p.user.id in ?1 and (p.schoolId = ?4 or (p.schoolId is null and ((?4 = 2 and (p.statusMass is not null or p.extraClass is not null)) or (?4 = 1 and p.statusMass is null and p.extraClass is null)))) and p.createDate >= ?2 and p.createDate < ?3 order by p.id asc")
	List<PersonDate> findByUserIdsAndDateAndSchoolId(List<Long> userIds, LocalDateTime startDate, LocalDateTime endDate, Integer schoolId);

	@Query("select p from PersonDate p where p.user.id in ?1 and (p.schoolId = ?4 or (p.schoolId is null and ((?4 = 2 and (p.statusMass is not null or p.extraClass is not null)) or (?4 = 1 and p.statusMass is null and p.extraClass is null)))) and (p.attendanceClassId = ?5 or p.attendanceClassId is null) and p.createDate >= ?2 and p.createDate < ?3 order by p.id asc")
	List<PersonDate> findByUserIdsDateSchoolAndClass(List<Long> userIds, LocalDateTime startDate, LocalDateTime endDate, Integer schoolId, Long classId);

	@Query("select p from PersonDate p where p.user.username = ?1 and (p.schoolId = ?2 or (p.schoolId is null and ((?2 = 2 and (p.statusMass is not null or p.extraClass is not null)) or (?2 = 1 and p.statusMass is null and p.extraClass is null)))) and (p.attendanceClassId = ?3 or p.attendanceClassId is null) and p.createDate >= ?4 and p.createDate < ?5 order by p.id desc")
	List<PersonDate> findForUserDateSchoolAndClass(String username, Integer schoolId, Long classId, LocalDateTime startDate, LocalDateTime endDate);

	@Query("select p from PersonDate p where lower(p.user.username) = lower(?1) and p.user.active = true "
			+ "and (p.schoolId = ?2 or (p.schoolId is null and ((?2 = 2 and (p.statusMass is not null or p.extraClass is not null)) or (?2 = 1 and p.statusMass is null and p.extraClass is null)))) "
			+ "and p.createDate >= ?3 and p.createDate < ?4 order by p.id asc")
	List<PersonDate> findForQrByUserDateAndSchool(String username, Integer schoolId, LocalDateTime startDate, LocalDateTime endDate);
}
