package com.globits.richy.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.Answer;
import com.globits.richy.domain.QuestionAnswerTestResult;
@Repository
public interface QuestionAnswerTestResultRepository extends JpaRepository<QuestionAnswerTestResult, Long> {
	@Query("delete from QuestionAnswerTestResult u where u.testResult.id = ?1")
	boolean deleteByTestResultId(Long testResultId);
}
