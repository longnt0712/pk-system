package com.globits.richy.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.Topic;
import com.globits.richy.domain.QuestionTopic;
@Repository
public interface QuestionTopicRepository extends JpaRepository<QuestionTopic, Long> {
	@Query("select qt.topic from QuestionTopic qt where qt.question.id = ?1")
	List<Topic> getQuestionTopicBy(Long questionId);
	
	@Query("select qt.question.id from QuestionTopic qt where qt.topic.id in ?1")
	List<Long> getListIdQuestionByListIdTopic(List<Long> ids);
	
	@Query("select distinct qt.question.id from QuestionTopic qt where qt.topic.id in ?1")
	List<Long> getListIdQuestionByListIdTopicDistinct(List<Long> ids);
}
