package com.globits.richy.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.Shoes;
@Repository
public interface ShoesRepository extends JpaRepository<Shoes, Long> {
	
}
