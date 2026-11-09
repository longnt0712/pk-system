package com.globits.richy.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.globits.richy.domain.EnrolmentClassScheduleDay;
import com.globits.richy.dto.EnrolmentClassCalendarDayDto;

@Repository
public interface EnrolmentClassScheduleDayRepository extends JpaRepository<EnrolmentClassScheduleDay, Long> {
    @Query("select new com.globits.richy.dto.EnrolmentClassCalendarDayDto(d.id, d.scheduleDate, "
            + "d.sessionStartTime, d.sessionEndTime, d.dayOff, d.movedFromDate, d.movedToDate, "
            + "(select count(topic.id) from EnrolmentClassScheduleDay classDay join classDay.classTopics topic where classDay.id = d.id), "
            + "(select count(topic.id) from EnrolmentClassScheduleDay homeworkDay join homeworkDay.homeworkTopics topic where homeworkDay.id = d.id), "
            + "(select count(task.id) from EnrolmentClassScheduleTask task where task.scheduleDay.id = d.id)) from EnrolmentClassScheduleDay d "
            + "where d.enrolmentClass.id = :classId and d.scheduleDate between :fromDate and :toDate order by d.scheduleDate")
    List<EnrolmentClassCalendarDayDto> findCalendarDays(@Param("classId") Long classId,
            @Param("fromDate") String fromDate, @Param("toDate") String toDate);

    @Query("select d.scheduleDate, d.sessionStartTime, d.sessionEndTime, d.movedToDate, d.dayOff from EnrolmentClassScheduleDay d where d.enrolmentClass.id = :classId")
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
