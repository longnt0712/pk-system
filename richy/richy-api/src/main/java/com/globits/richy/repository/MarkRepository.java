package com.globits.richy.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.Answer;
import com.globits.richy.domain.Mark;
import com.globits.richy.dto.MarkDto;
@Repository
public interface MarkRepository extends JpaRepository<Mark, Long> {
	@Query("select u from Mark u where u.educationProgram.id = ?1 ")
	List<Mark> findMarkBy(Long educationProgramId);
}
