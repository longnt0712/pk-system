package com.globits.core.service.impl;

import java.io.Serializable;

import javax.persistence.EntityManager;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import com.globits.core.domain.BaseObject;
import com.globits.core.service.GenericService;

@Transactional
public class GenericServiceImpl<T extends BaseObject, Idt extends Serializable> implements GenericService<T, Idt> {
	@Autowired
	public JpaRepository<T, Idt> repository;
	@Autowired
	public EntityManager manager;

	@Override
	public T delete(Idt id) {
		T result = repository.findOne(id);
		if (result != null) {
			repository.delete(id);
		}
		return result;
	}

	@Override
	public T save(T t) {
		// Authentication authentication =
		// SecurityContextHolder.getContext().getAuthentication();
		// User modifiedUser = null;

		// Date currentDate = new Date();
		// String currentUserName = "Unknown User";

		// if (authentication != null) {
		// modifiedUser = (User) authentication.getPrincipal();
		// if (modifiedUser != null) {
		// currentUserName = modifiedUser.getUsername();
		// }
		// }

		// t.setCreateDate(currentDate);
		// t.setCreatedBy(currentUserName);

		T result = repository.save(t);
		return result;
	}

	@Override
	public Page<T> getList(int pageIndex, int pageSize) {
		Pageable pageable = new PageRequest(pageIndex - 1, pageSize);
		return repository.findAll(pageable);
	}

	@Override
	public T findById(Idt id) {
		return repository.findOne(id);
	}
}
