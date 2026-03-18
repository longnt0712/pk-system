package com.globits.richy.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.Product;
@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
//	@Query("select sum(u.quantity) from Product u where u.bill.id = ?1 ")
//	Integer getQuantity(Long billId);
	
	@Query("select u.id from Product u")
	List<Long> getIds();
}
