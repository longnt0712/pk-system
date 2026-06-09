package com.globits.richy.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.Answer;
import com.globits.richy.domain.EnrolmentClass;
@Repository
public interface EnrolmentClassRepository extends JpaRepository<EnrolmentClass, Long> {
	
}
