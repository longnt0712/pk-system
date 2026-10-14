package com.globits.richy.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.Category;
import com.globits.richy.domain.Question;
import com.globits.richy.dto.QuestionImportExistingDto;
import com.globits.richy.dto.QuestionForTestsDto;
@Repository
public interface QuestionRepository extends JpaRepository<Question, Long> {
	@Query("select count(u.id) from Question u where u.user.id = ?1")
	Long countByUserId(Long userId);
	
	@Query("select u from Question u where u.question = ?1 and u.user.id = ?2")
	List<Question> findByQuestion(String question, Long userId);
	
	@Query("select new com.globits.richy.dto.QuestionImportExistingDto("
	        + "q.id, q.question, q.pronounce, q.motherTongue, q.level) "
	        + "from Question q "
	        + "where q.user.id = ?1 "
	        + "and q.questionType.id = ?2")
	List<QuestionImportExistingDto> findForExcelImport(
	        Long userId,
	        Long questionTypeId
	);
	@Query("select new com.globits.richy.dto.QuestionForTestsDto(q.id, q.title, q.pronounce, q.status, q.testFormat, f) from Question q left join q.testFolder f "
	        + "where q.questionType.id = 11 and q.status = 7 and (q.testFormat is null or q.testFormat <> 'DAILY_LISTENING') order by lower(q.title), q.id")
	List<QuestionForTestsDto> findPublishedIeltsTests();
	@Query("select new com.globits.richy.dto.QuestionForTestsDto(q.id, "
	        + "case when q.questionType.id = 6 then q.question else q.title end, q.pronounce, q.status, q.testFormat, f) "
	        + "from Question q left join q.testFolder f where q.questionType.id = 6 "
	        + "or (q.questionType.id = 11 and q.testFormat = 'DAILY_LISTENING' and q.status = 7) order by q.id")
	List<QuestionForTestsDto> findAssignableDailyListeningTests();
	@Query("select distinct test.id, task.type from Question task join task.parent part join part.parent test "
	        + "where test.questionType.id = 11 and test.status = 7 and test.testFormat = 'WRITING' and task.type in (16, 17)")
	List<Object[]> findPublishedWritingTaskTypes();

//	@Query("select u from Question u where u.question = ?1 and u.user.id = ?2")
//	List<Question> findByQuestion(String question, Long userId);
	
//	@Query("select u.user.id from QuestionDto u")
//	List<Long> getListUserId();
}
