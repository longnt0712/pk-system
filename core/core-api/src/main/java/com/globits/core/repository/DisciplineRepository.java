package com.globits.core.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.core.domain.Discipline;;

@Repository
public interface DisciplineRepository extends JpaRepository<Discipline, Long> {
	@Query("select u from Discipline u where u.code = ?1")
	List<Discipline> findByCode(String code);
}
