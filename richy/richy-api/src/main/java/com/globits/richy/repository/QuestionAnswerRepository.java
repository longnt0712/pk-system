package com.globits.richy.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.Answer;
import com.globits.richy.domain.Category;
import com.globits.richy.domain.QuestionAnswer;
@Repository
public interface QuestionAnswerRepository extends JpaRepository<QuestionAnswer, Long> {
	@Query("select qa.answer from QuestionAnswer qa where qa.question.id = ?1")
	List<Answer> getQuestionAnswerBy(Long questionId);

	@Query("select qa from QuestionAnswer qa join fetch qa.answer join fetch qa.question slot "
			+ "join fetch slot.parent pack join pack.parent passage join passage.parent test "
			+ "where qa.id in :slotIds and qa.isCorrect = true and pack.type = 19 and test.id = :testId "
			+ "and test.parent is null and test.testFormat = 'COMPREHENSIVE' and test.status = 7")
	List<QuestionAnswer> findStudyMistakeSlots(@Param("testId") Long testId, @Param("slotIds") List<Long> slotIds);
}
