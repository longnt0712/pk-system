package com.globits.richy.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import com.globits.richy.domain.EnrolmentClassScheduleDay;

@Repository
public interface EnrolmentClassScheduleDayRepository extends JpaRepository<EnrolmentClassScheduleDay, Long> {
    EnrolmentClassScheduleDay findByEnrolmentClassIdAndScheduleDate(Long enrolmentClassId, String scheduleDate);
    List<EnrolmentClassScheduleDay> findByEnrolmentClassIdAndScheduleDateBetweenOrderByScheduleDateAsc(
            Long enrolmentClassId, String fromDate, String toDate);
}
