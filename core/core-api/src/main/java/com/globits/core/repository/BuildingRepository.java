package com.globits.core.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.core.domain.Building;
import com.globits.core.domain.Department;
import com.globits.core.dto.BuildingDto;

@Repository
public interface BuildingRepository extends JpaRepository<Building, Long> {
	@Query("select new com.globits.core.dto.BuildingDto(b) from Building b")
	Page<BuildingDto> getListByPage(Pageable pageable);
	@Query("select new com.globits.core.dto.BuildingDto(b) from Building b where b.id=?1")
	BuildingDto getBuildingById(Long id);
	@Query("select new com.globits.core.dto.BuildingDto(b) from Building b")
	List<BuildingDto> getAllBuildings();
	@Query("select b from Building b where b.code = ?1")
	List<Building> findByCode(String code);
}
