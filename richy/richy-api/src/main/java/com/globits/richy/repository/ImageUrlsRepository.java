package com.globits.richy.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.ImageUrls;
@Repository
public interface ImageUrlsRepository extends JpaRepository<ImageUrls, Long> {
	
}
