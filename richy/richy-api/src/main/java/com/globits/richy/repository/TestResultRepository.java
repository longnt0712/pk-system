package com.globits.richy.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import org.joda.time.LocalDateTime;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.globits.richy.domain.TestResult;
@Repository
public interface TestResultRepository extends JpaRepository<TestResult, Long> {
    @Query("select r from TestResult r where r.user.id = :userId and r.clientAttemptKey = :attemptKey and r.testType = :testType")
    TestResult findAttempt(@Param("userId") Long userId, @Param("attemptKey") String attemptKey,
            @Param("testType") Integer testType);
    @Query("select distinct r.user.id, t.id, r.createDate, r.id, r.testType from TestResult r join r.topics t "
            + "where r.user.id in :students and t.id in :topics and r.testType in (1, 3) "
            + "and ((r.testType = 1 and (r.resultStatus is null or r.resultStatus = 'SUCCESS')) "
            + "or (r.testType = 3 and r.resultStatus = 'SUCCESS')) "
            + "and r.createDate >= :fromDate and r.createDate <= :toDate "
            + "order by r.createDate asc, r.id asc")
    List<Object[]> findVocabularyCompletions(@Param("students") List<Long> students, @Param("topics") List<Long> topics,
            @Param("fromDate") LocalDateTime fromDate, @Param("toDate") LocalDateTime toDate);

    @Query("select count(distinct r.id) from TestResult r join r.topics t "
            + "where r.user.id = :studentId and t.id = :topicId and r.testType = :testType "
            + "and ((r.testType = 1 and (r.resultStatus is null or r.resultStatus = 'SUCCESS')) "
            + "or (r.testType <> 1 and r.resultStatus = 'SUCCESS')) "
            + "and r.createDate >= :fromDate and r.createDate <= :toDate")
    long countSuccessfulAssignmentAttempts(@Param("studentId") Long studentId, @Param("topicId") Long topicId,
            @Param("testType") Integer testType, @Param("fromDate") LocalDateTime fromDate,
            @Param("toDate") LocalDateTime toDate);
	
}
