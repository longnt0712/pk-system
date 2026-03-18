package com.globits.core.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.core.domain.GlobalProperty;

@Repository
public interface GlobalPropertyRepository extends JpaRepository<GlobalProperty, Long> {
	@Query("select u from GlobalProperty u where u.property = ?1")
	GlobalProperty findByProperty(String property);

}
