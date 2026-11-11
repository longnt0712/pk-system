package com.globits.richy.repository;

import java.util.List;
import javax.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.TopicCategory;
@Repository
public interface TopicCategoryRepository extends JpaRepository<TopicCategory, Long> {
	List<TopicCategory> findByOwnerIdIsNull();

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select category from TopicCategory category where category.ownerId is null order by category.id")
	List<TopicCategory> lockSharedHierarchy();

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select category from TopicCategory category where category.ownerId = :ownerId order by category.id")
	List<TopicCategory> lockPrivateHierarchy(@Param("ownerId") Long ownerId);
}
