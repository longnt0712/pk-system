package com.globits.richy.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import com.globits.richy.domain.EnrolmentClassWeeklySession;

@Repository
public interface EnrolmentClassWeeklySessionRepository extends JpaRepository<EnrolmentClassWeeklySession, Long> {
    List<EnrolmentClassWeeklySession> findByEnrolmentClassIdOrderByDisplayOrderAscDayOfWeekAscStartTimeAsc(
            Long enrolmentClassId);
}
