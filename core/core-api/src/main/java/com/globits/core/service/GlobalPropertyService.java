package com.globits.core.service;

import org.springframework.data.domain.Page;

import com.globits.core.domain.GlobalProperty;

public interface GlobalPropertyService {

	Page<GlobalProperty> findByPage(int pageIndex, int pageSize);

	public GlobalProperty save(GlobalProperty globalProperty) throws RuntimeException;

	public GlobalProperty updateGlobalProperty(GlobalProperty user) throws RuntimeException;

	GlobalProperty findByProperty(String property);

	public GlobalProperty delete(String property) throws RuntimeException;
}