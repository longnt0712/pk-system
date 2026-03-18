package com.globits.core.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.core.domain.Reward;

@Repository
public interface RewardRepository extends JpaRepository<Reward, Long> {
	@Query("select u from Reward u where u.code = ?1")
	List<Reward> findByCode(String code);
}
