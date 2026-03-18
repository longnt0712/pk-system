package com.globits.core.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.core.domain.Religion;

@Repository
public interface ReligionRepository extends JpaRepository<Religion, Long> {
	@Query("select e from Religion e   where  e.code=?1")
	Religion findByCode(String code);
	
	@Query("select e from Religion e   where  e.code=?1")
	List<Religion> findListByCode(String code);
}
