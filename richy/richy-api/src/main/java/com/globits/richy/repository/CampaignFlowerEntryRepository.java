package com.globits.richy.repository;
import java.util.List;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import com.globits.richy.domain.CampaignFlowerEntry;
public interface CampaignFlowerEntryRepository extends JpaRepository<CampaignFlowerEntry, Long> {
    List<CampaignFlowerEntry> findByCampaignIdAndStudentIdAndDateBetween(Long campaignId, Long studentId, String first, String last);
    CampaignFlowerEntry findByCampaignIdAndStudentIdAndDateAndItemKey(Long campaignId, Long studentId, String date, String itemKey);
    @Modifying
    @Query("delete from CampaignFlowerEntry e where e.campaignId = :campaignId")
    void deleteCampaignEntries(@Param("campaignId") Long campaignId);
}
