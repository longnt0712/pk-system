package com.globits.core.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.core.domain.Department;
import com.globits.core.domain.TrainingBase;
import com.globits.core.dto.TrainingBaseDto;

@Repository
public interface TrainingBaseRepository extends JpaRepository<TrainingBase, Long> {

	@Query("select new com.globits.core.dto.TrainingBaseDto(b) from TrainingBase b order by b.name asc")
	Page<TrainingBaseDto> getListByPage(Pageable pageable);
	@Query("select new com.globits.core.dto.TrainingBaseDto(b) from TrainingBase b where b.id=?1")
	TrainingBaseDto getTrainingBaseById(Long id);
	
	@Query("select new com.globits.core.dto.TrainingBaseDto(b) from TrainingBase b")
	List<TrainingBaseDto> getTrainingAllBases();
	
	@Query("select u from TrainingBase u where u.code = ?1")
	List<TrainingBase> findByCode(String code);
}
