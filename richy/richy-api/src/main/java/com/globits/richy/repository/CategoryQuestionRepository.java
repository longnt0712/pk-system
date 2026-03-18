package com.globits.richy.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.CategoryQuestion;
@Repository
public interface CategoryQuestionRepository extends JpaRepository<CategoryQuestion, Long> {
	
}
