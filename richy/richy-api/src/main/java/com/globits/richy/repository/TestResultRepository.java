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
    @Query("select distinct r from TestResult r "
            + "left join fetch r.user "
            + "left join fetch r.questionAnswerTestResult ar "
            + "left join fetch ar.questionAnswer qa "
            + "left join fetch qa.question q "
            + "left join fetch q.parent "
            + "where r.id = :id")
    TestResult findWritingResultForGrading(@Param("id") Long id);

    @Query("select r from TestResult r where r.user.id = :userId and r.clientAttemptKey = :attemptKey and r.testType = :testType")
    TestResult findAttempt(@Param("userId") Long userId, @Param("attemptKey") String attemptKey,
            @Param("testType") Integer testType);
    @Query("select distinct r.user.id, t.id, r.createDate, r.id, r.testType, r.sourceQuestionId from TestResult r join r.topics t "
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

    @Query("select count(distinct r.id) from TestResult r join r.topics t "
            + "where r.user.id = :studentId and t.id = :topicId and r.testType = 3 "
            + "and r.sourceQuestionId = :sourceQuestionId and r.resultStatus = 'SUCCESS' "
            + "and r.createDate >= :fromDate and r.createDate <= :toDate")
    long countSuccessfulListeningItemAttempts(@Param("studentId") Long studentId, @Param("topicId") Long topicId,
            @Param("sourceQuestionId") Long sourceQuestionId, @Param("fromDate") LocalDateTime fromDate,
            @Param("toDate") LocalDateTime toDate);

    @Query("select count(distinct r.id) from TestResult r where r.user.id = :studentId "
            + "and r.assignmentTaskId = :taskId and r.sourceQuestionId = :testId and r.completedPart = :part and r.testType = :testType "
            + "and (r.testType <> 6 or r.resultStatus = 'SUCCESS') "
            + "and r.createDate >= :fromDate and r.createDate <= :toDate")
    long countIeltsPartAssignmentAttempts(@Param("studentId") Long studentId, @Param("taskId") Long taskId,
            @Param("testId") Long testId,
            @Param("part") Integer part, @Param("testType") Integer testType,
            @Param("fromDate") LocalDateTime fromDate, @Param("toDate") LocalDateTime toDate);

    @Query("select r.user.id, r.sourceQuestionId, r.completedPart, r.createDate, r.id, r.testType, r.assignmentTaskId "
            + "from TestResult r where r.user.id in :students and r.sourceQuestionId in :tests "
            + "and r.completedPart is not null and r.testType in (2, 4, 6) "
            + "and (r.testType <> 6 or r.resultStatus = 'SUCCESS') "
            + "and r.createDate >= :fromDate and r.createDate <= :toDate order by r.createDate asc, r.id asc")
    List<Object[]> findIeltsPartCompletions(@Param("students") List<Long> students, @Param("tests") List<Long> tests,
            @Param("fromDate") LocalDateTime fromDate, @Param("toDate") LocalDateTime toDate);
	
}
