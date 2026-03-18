package com.globits.core.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.core.domain.Country;

@Repository
public interface CountryRepository extends JpaRepository<Country, Long> {
	@Query("select e from Country e   where  e.code=?1")
	Country findByCode(String code);
	
	@Query("select e from Country e   where  e.code=?1")
	List<Country> findListByCode(String code);
}
