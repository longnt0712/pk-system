package com.globits.richy.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.Brand;
import com.globits.richy.domain.Folder;
import com.globits.richy.dto.BrandDto;
import com.globits.richy.dto.FolderDto;
@Repository
public interface BrandRepository extends JpaRepository<Brand, Long> {
	@Query("select new com.globits.richy.dto.BrandDto(u) from Brand u where u.url = ?1")
	BrandDto findByUrl(String url);
	
	@Query("select new com.globits.richy.dto.BrandDto(u) from Brand u ")
	List<BrandDto> brandDtos();
	
//	@Query("select new com.globits.richy.dto.BrandDto(u) from Brand u where u.parent = null")
//	List<BrandDto> brandParentDtos();
	
	@Query("select new com.globits.richy.dto.BrandDto(u) from Brand u where u.parent = null and u.website = ?1")
	List<BrandDto> brandParentDtosByWebsite(Integer website);
	
	@Query("select new com.globits.richy.dto.BrandDto(u) from Brand u where u.parent.id = ?1 ")
	List<BrandDto> brandDtos(Long parentId);
}
