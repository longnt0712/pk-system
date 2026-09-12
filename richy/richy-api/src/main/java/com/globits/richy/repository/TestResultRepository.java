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
    @Query("select r from TestResult r where r.user.id = :userId and r.clientAttemptKey = :attemptKey and r.testType = 1")
    TestResult findDailyVocabAttempt(@Param("userId") Long userId,@Param("attemptKey") String attemptKey);
    @Query("select distinct r.user.id, t.id, r.createDate, r.id from TestResult r join r.completedVocabularyTopics t "
            + "where r.user.id in :students and t.id in :topics and r.testType = 1 "
            + "and r.vocabularyExperienceAwardedWords > 0 and r.createDate >= :fromDate and r.createDate <= :toDate "
            + "order by r.createDate asc, r.id asc")
    List<Object[]> findVocabularyCompletions(@Param("students") List<Long> students, @Param("topics") List<Long> topics,
            @Param("fromDate") LocalDateTime fromDate, @Param("toDate") LocalDateTime toDate);
	
}
