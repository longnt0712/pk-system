package com.globits.richy.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.Answer;
import com.globits.richy.domain.Category;
import com.globits.richy.domain.QuestionAnswer;
@Repository
public interface QuestionAnswerRepository extends JpaRepository<QuestionAnswer, Long> {
	@Query("select qa.answer from QuestionAnswer qa where qa.question.id = ?1")
	List<Answer> getQuestionAnswerBy(Long questionId);
}
