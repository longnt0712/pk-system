package com.globits.richy.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.Category;
import com.globits.richy.domain.Question;
import com.globits.richy.dto.QuestionImportExistingDto;
@Repository
public interface QuestionRepository extends JpaRepository<Question, Long> {
	@Query("select count(u.id) from Question u where u.user.id = ?1")
	Long countByUserId(Long userId);
	
	@Query("select u from Question u where u.question = ?1 and u.user.id = ?2")
	List<Question> findByQuestion(String question, Long userId);
	
	@Query("select new com.globits.richy.dto.QuestionImportExistingDto("
	        + "q.id, q.question, q.pronounce, q.motherTongue) "
	        + "from Question q "
	        + "where q.user.id = ?1 "
	        + "and q.questionType.id = ?2")
	List<QuestionImportExistingDto> findForExcelImport(
	        Long userId,
	        Long questionTypeId
	);
//	@Query("select u from Question u where u.question = ?1 and u.user.id = ?2")
//	List<Question> findByQuestion(String question, Long userId);
	
//	@Query("select u.user.id from QuestionDto u")
//	List<Long> getListUserId();
}
