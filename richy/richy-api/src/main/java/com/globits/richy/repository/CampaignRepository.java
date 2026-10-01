package com.globits.richy.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.globits.richy.domain.Campaign;

public interface CampaignRepository extends JpaRepository<Campaign, Long> {
    @Query("select c from Campaign c where lower(c.name) like :keyword or lower(c.theme) like :keyword")
    Page<Campaign> search(@Param("keyword") String keyword, Pageable pageable);
}
