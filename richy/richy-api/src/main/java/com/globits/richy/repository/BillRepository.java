package com.globits.richy.repository;

import java.util.List;

import org.joda.time.LocalDateTime;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.Bill;
import com.globits.richy.domain.Brand;
import com.globits.richy.domain.Folder;
import com.globits.richy.dto.BrandDto;
import com.globits.richy.dto.FolderDto;
@Repository
public interface BillRepository extends JpaRepository<Bill, Long> {
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
	
	//type = 1 import
//	@Query("select sum(u.quantity) from Bill u where u.product.id = ?1 and u.type = 1 and u.voided = false ")
//	Long sumQuantityImported(Long productId);
	
	@Query("select sum(s.totalAmount) from Bill s where s.createDate >= ?1 and s.createDate < ?2 ")
	Long totalAmountOfBills(LocalDateTime startDate, LocalDateTime endDate );
}
