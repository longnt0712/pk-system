package com.globits.core.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.core.domain.Ethnics;

@Repository
public interface EthnicsRepository extends JpaRepository<Ethnics, Long> {
	@Query("select e from Ethnics e   where  e.code=?1")
	Ethnics findByCode(String code);
	
	@Query("select e from Ethnics e   where  e.code=?1")
	List<Ethnics> findListByCode(String code);
}
