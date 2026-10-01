package com.globits.richy.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.globits.richy.domain.Campaign;
import java.util.List;

public interface CampaignRepository extends JpaRepository<Campaign, Long> {
    @Query("select c from Campaign c where c.startDate <= :today and c.endDate >= :today order by c.startDate desc, c.id desc")
    List<Campaign> activeCampaigns(@Param("today") String today);
    @Query("select c from Campaign c where lower(c.name) like :keyword or lower(c.theme) like :keyword")
    Page<Campaign> search(@Param("keyword") String keyword, Pageable pageable);
}
