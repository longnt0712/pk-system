package com.globits.richy.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.Body;
@Repository
public interface BodyRepository extends JpaRepository<Body, Long> {
	@Query("select cs from Body cs where cs.text = ?1")
	List<Body> searchEqualText(String textSearch);
}
