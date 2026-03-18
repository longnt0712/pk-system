package com.globits.richy.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.BillShoesSize;
@Repository
public interface BillShoesSizeRepository extends JpaRepository<BillShoesSize, Long> {
//	@Query("select new com.globits.richy.dto.BrandDto(u) from Brand u where u.url = ?1")
//	BrandDto findByUrl(String url);
//	
//	@Query("select new com.globits.richy.dto.BrandDto(u) from Brand u ")
//	List<BrandDto> brandDtos();
//	
//	@Query("select new com.globits.richy.dto.BrandDto(u) from Brand u where u.parent = null")
//	List<BrandDto> brandParentDtos();
//	
//	@Query("select new com.globits.richy.dto.BrandDto(u) from Brand u where u.parent.id = ?1 ")
//	List<BrandDto> brandDtos(Long parentId);
}
