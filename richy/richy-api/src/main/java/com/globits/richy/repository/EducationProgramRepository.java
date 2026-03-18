package com.globits.richy.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.Answer;
import com.globits.richy.domain.EducationProgram;
import com.globits.richy.domain.StudentMark;
@Repository
public interface EducationProgramRepository extends JpaRepository<EducationProgram, Long> {
//	@Query("select u from EducationProgram u where u.id = ?1")
//	EducationProgram findEducationProgramBy(Long educationProgramId);
}
