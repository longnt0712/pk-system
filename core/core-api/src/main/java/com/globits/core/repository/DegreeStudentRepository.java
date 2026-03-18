package com.globits.core.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.core.domain.DegreeStudent;

@Repository
public interface DegreeStudentRepository extends JpaRepository<DegreeStudent, Long> {
	@Query("select u from DegreeStudent u where u.code = ?1")
	List<DegreeStudent> findByCode(String code);
}
