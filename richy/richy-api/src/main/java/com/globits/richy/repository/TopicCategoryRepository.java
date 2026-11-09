package com.globits.richy.repository;

import java.util.List;
import javax.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.TopicCategory;
@Repository
public interface TopicCategoryRepository extends JpaRepository<TopicCategory, Long> {
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select category from TopicCategory category order by category.id")
	List<TopicCategory> lockHierarchy();
}
