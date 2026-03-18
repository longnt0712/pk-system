package com.globits.richy.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.Passage;
@Repository
public interface PassageRepository extends JpaRepository<Passage, Long> {
	
}
