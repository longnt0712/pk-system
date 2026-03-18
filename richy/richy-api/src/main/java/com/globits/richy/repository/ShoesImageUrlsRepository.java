package com.globits.richy.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.ShoesImageUrls;
@Repository
public interface ShoesImageUrlsRepository extends JpaRepository<ShoesImageUrls, Long> {
	
}
