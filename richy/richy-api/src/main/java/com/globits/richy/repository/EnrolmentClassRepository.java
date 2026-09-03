package com.globits.richy.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.EnrolmentClass;
@Repository
public interface EnrolmentClassRepository extends JpaRepository<EnrolmentClass, Long> {
	List<EnrolmentClass> findByParentId(Long parentId);

	long countByParentId(Long parentId);

	@Query("select c.id from EnrolmentClass c where c.schoolId = :schoolId")
	List<Long> findIdsBySchoolId(@Param("schoolId") Integer schoolId);
}
