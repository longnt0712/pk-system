package com.globits.richy.repository;

import java.util.List;

import org.joda.time.LocalDateTime;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.PersonDate;
@Repository
public interface PersonDateRepository extends JpaRepository<PersonDate, Long> {
	@Query("select count(u.id) from PersonDate u where u.createDate >= ?1 and u.createDate <= ?2")
	Long countPersonDateBy(LocalDateTime startDate, LocalDateTime endDate);
	
	@Query("select u from PersonDate u where u.user.username = ?1 and u.createDate >= ?2 and u.createDate <= ?3")
	PersonDate getBy(String username,LocalDateTime startDate, LocalDateTime endDate);
}
