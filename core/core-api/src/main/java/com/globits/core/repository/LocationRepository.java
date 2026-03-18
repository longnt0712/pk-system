package com.globits.core.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.core.domain.Location;

@Repository
public interface LocationRepository extends JpaRepository<Location, Long> {
	@Query("select l from Location l where l.code = ?1")
	List<Location> findByCode(String code);
}
