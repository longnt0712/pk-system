package com.globits.richy.service.impl;

import java.util.List;

import javax.persistence.EntityManager;
import javax.persistence.Query;

import org.joda.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import com.globits.richy.domain.Bill;
import com.globits.richy.domain.Product;
import com.globits.richy.dto.ProductDto;
import com.globits.richy.repository.BillRepository;
import com.globits.richy.repository.ProductRepository;
import com.globits.richy.service.ProductService;
import com.globits.security.domain.User;

@Service
public class ProductServiceImpl implements ProductService {
	@Autowired
	EntityManager manager;
	@Autowired
	ProductRepository productRepository;
	@Autowired
	BillRepository billRepository;

	@Override
	public Page<ProductDto> getPageObject(ProductDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.ProductDto(s) from Product s where (1=1)";
		String sqlCount = "select count(s.id) from Product s where (1=1)";
		String whereClause = "";

		if (textSearch != null && textSearch.length() > 0) {
			whereClause += " and (s.name like :textSearch or s.code like :textSearch)";
		}
		
		if(searchDto.getImportant() != null) {
			whereClause += " and (s.important = :important)";
		}
		
		if(searchDto.getCategory() != null) {
			whereClause += " and (s.category = :category)";
		}
		
		sql += whereClause + " order by s.important DESC, s.name ASC";
		sqlCount += whereClause;
		

		Query q = manager.createQuery(sql, ProductDto.class);
		Query qCount = manager.createQuery(sqlCount);

		if (textSearch != null && textSearch.length() > 0) {
			q.setParameter("textSearch", '%' + textSearch + '%');
			qCount.setParameter("textSearch", '%' + textSearch + '%');
		}
		
		if(searchDto.getImportant() != null) {
			q.setParameter("important",searchDto.getImportant());
			qCount.setParameter("important",searchDto.getImportant());
		}
		
		if(searchDto.getCategory() != null) {
			q.setParameter("category",searchDto.getCategory());
			qCount.setParameter("category",searchDto.getCategory());
		}

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<ProductDto> page = new PageImpl<ProductDto>(q.getResultList(), pageable, numberResult);
		return page;
	}

	@Override
	public List<ProductDto> getListObject(ProductDto searchDto, int pageIndex, int pageSize) {
		return null;
	}

	@Override
	public ProductDto getObjectById(Long id) {
		return new ProductDto(productRepository.getOne(id));
	}

	@Override
	public boolean saveObject(ProductDto dto) {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User modifiedUser = null;
		LocalDateTime currentDate = LocalDateTime.now();
		String currentUserName = "Unknown User";
		if (authentication != null) {
			modifiedUser = (User) authentication.getPrincipal();
			currentUserName = modifiedUser.getUsername();
		}
		if(dto == null) {
			return false;
		}
		Product domain = null;
		if(dto.getId() != null) {
			domain = productRepository.getOne(dto.getId());
		}
		if(domain != null) {
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(currentDate);
		}
		if(domain == null) {
			domain = new Product();
			domain.setCreateDate(currentDate);
			domain.setCreatedBy(currentUserName);
		}
		
		domain.setName(dto.getName());
		domain.setCode(dto.getCode());
		domain.setDescription(dto.getDescription());
		domain.setImageUrl(dto.getImageUrl());
		if(dto.getImportant() == null || dto.getImportant() <= 0) {
			domain.setImportant(1);
		}else {
			domain.setImportant(dto.getImportant());	
		}
		
		domain.setFirstPrice(dto.getFirstPrice());
		domain.setSecondPrice(dto.getSecondPrice());
		if(dto.getQuantity() == null) {
			dto.setQuantity(0);
		}
		domain.setQuantity(dto.getQuantity());
		domain.setCategory(dto.getCategory());
		
		domain = productRepository.save(domain);
		
		return false;
	}

	@Override
	public boolean deleteObject(Long id) {
		if(id == null) {
			return false;
		}
		Product domain = productRepository.getOne(id);
		if(domain == null) {
			return false;
		}
		productRepository.delete(domain);
		return true;
	}

}
