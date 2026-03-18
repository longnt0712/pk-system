package com.globits.richy.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.Topic;
import com.globits.richy.dto.TopicDto;

@Repository
public interface TopicRepository extends JpaRepository<Topic, Long> {
	@Query("select new com.globits.richy.dto.TopicDto(i) from Topic i where i.name = ?1")
	TopicDto getByName(String name);
	
	@Query("select new com.globits.richy.dto.TopicDto(u) from Topic u")
	List<TopicDto> getListObject();
	
	@Query("select count(i.id) from Topic i where i.user.id = ?1")
	Long countByUserId(Long userId);
}
