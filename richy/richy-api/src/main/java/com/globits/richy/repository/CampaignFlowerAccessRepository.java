package com.globits.richy.repository;
import javax.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import com.globits.richy.domain.CampaignFlowerAccess;
public interface CampaignFlowerAccessRepository extends JpaRepository<CampaignFlowerAccess, Long> {
    CampaignFlowerAccess findByStudentId(Long studentId);
    CampaignFlowerAccess findByTokenHash(String tokenHash);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from CampaignFlowerAccess a where a.tokenHash = :hash")
    CampaignFlowerAccess lockByTokenHash(@Param("hash") String tokenHash);
}
