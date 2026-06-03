package com.globits.richy.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.Mark;
import com.globits.richy.domain.StudentMark;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
@Repository
public interface StudentMarkRepository extends JpaRepository<StudentMark, Long> {
	@Query("select u from StudentMark u where u.mark.id = ?1 and u.user.id = ?2")
	Optional<StudentMark> findStudentMarkBy(Long markId, Long userId);
	
	@Query("select sm from StudentMark sm " +
		       "where sm.mark.id = :markId and sm.user.id = :userId " +
		       "order by sm.id desc")
		List<StudentMark> findStudentMarksByMarkIdAndUserId(
		        @Param("markId") Long markId,
		        @Param("userId") Long userId
		);
}
