package com.globits.richy.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.AllSizes;
@Repository
public interface AllSizesRepository extends JpaRepository<AllSizes, Long> {
	
}
