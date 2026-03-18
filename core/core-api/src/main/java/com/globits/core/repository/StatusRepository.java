package com.globits.core.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.core.domain.Status;

@Repository
public interface StatusRepository extends JpaRepository<Status, Long> {
	@Query("select u from Status u where u.code = ?1")
	List<Status> findByCode(String code);
}
