package com.globits.richy.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.globits.richy.domain.EnrolmentClassScheduleDay;

@Repository
public interface EnrolmentClassScheduleDayRepository extends JpaRepository<EnrolmentClassScheduleDay, Long> {
    @Query("select d.scheduleDate, d.sessionStartTime, d.sessionEndTime, d.movedToDate from EnrolmentClassScheduleDay d where d.enrolmentClass.id = :classId")
    List<Object[]> findScheduleTimeline(@Param("classId") Long classId);
    List<EnrolmentClassScheduleDay> findByEnrolmentClassIdAndMovedDayId(Long classId, Long movedDayId);
    EnrolmentClassScheduleDay findByEnrolmentClassIdAndScheduleDate(Long enrolmentClassId, String scheduleDate);
    EnrolmentClassScheduleDay findTopByEnrolmentClassIdAndScheduleDateGreaterThanOrderByScheduleDateAsc(
            Long enrolmentClassId, String afterDate);
    EnrolmentClassScheduleDay findTopByEnrolmentClassIdAndScheduleDateLessThanOrderByScheduleDateDesc(
            Long enrolmentClassId, String beforeDate);
    List<EnrolmentClassScheduleDay> findByEnrolmentClassIdAndScheduleDateBetweenOrderByScheduleDateAsc(
            Long enrolmentClassId, String fromDate, String toDate);
}
