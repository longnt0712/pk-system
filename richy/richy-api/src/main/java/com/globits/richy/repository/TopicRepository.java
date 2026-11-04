package com.globits.richy.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.Topic;
import com.globits.richy.dto.TopicDto;
import com.globits.richy.dto.TopicForListAllDto;

@Repository
public interface TopicRepository extends JpaRepository<Topic, Long> {
	@Query("select new com.globits.richy.dto.TopicDto(i) from Topic i where i.name = ?1")
	TopicDto getByName(String name);
	
	@Query("select new com.globits.richy.dto.TopicDto(u) from Topic u where u.isShow = true or u.isShow is null")
	List<TopicDto> getListObject();
	
	@Query("select new com.globits.richy.dto.TopicForListAllDto(u) from Topic u where u.isShow = true or u.isShow is null")
	List<TopicForListAllDto> getAllTopics();

	@Query("select new com.globits.richy.dto.TopicForListAllDto(u) from Topic u "
			+ "where u.isShow = true or u.isShow is null order by u.createDate desc, u.id desc")
	List<TopicForListAllDto> getAllTopicsNewestFirst();

	@Query("select new com.globits.richy.dto.TopicForListAllDto(t.id, t.name, category.id, category.name, owner.id, owner.username) "
			+ "from Topic t left join t.topicCategory category left join t.user owner "
			+ "where (t.isShow = true or t.isShow is null) and (category.id = ?1 or (?1 = 0 and category.id is null)) "
			+ "order by t.createDate desc, t.id desc")
	List<TopicForListAllDto> getScheduleTopicsByCategory(Long categoryId);
	
	@Query("select count(i.id) from Topic i where i.user.id = ?1")
	Long countByUserId(Long userId);
}
