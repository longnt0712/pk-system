package com.globits.core.service.impl;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.globits.core.domain.GlobalProperty;
import com.globits.core.repository.GlobalPropertyRepository;
import com.globits.core.service.GlobalPropertyService;

@Transactional
@Service
public class GlobalPropertyServiceImpl implements GlobalPropertyService {
	@Autowired
	private GlobalPropertyRepository globalPropertyRepository;

	public Page<GlobalProperty> findByPage(int pageIndex, int pageSize) {
		Pageable pageable = new PageRequest(pageIndex - 1, pageSize);
		return globalPropertyRepository.findAll(pageable);
	}

	public GlobalProperty findByProperty(String property) {
		return globalPropertyRepository.findByProperty(property);
	}

	public GlobalProperty save(GlobalProperty userDto) throws RuntimeException {

		// String currentUser = "Unknown User";
		// Date currentDate = new Date();

		// Authentication authentication =
		// SecurityContextHolder.getContext().getAuthentication();
		// User modifiedUser = null;
		// if (authentication != null) {
		// modifiedUser = (User) authentication.getPrincipal();
		// if (modifiedUser != null) {
		// currentUser = modifiedUser.getUsername();
		// }
		// }

		GlobalProperty glbal = new GlobalProperty();
		glbal.setDescription(userDto.getDescription());
		glbal.setPropertyName(userDto.getPropertyName());
		glbal.setPropertyValue(userDto.getPropertyValue());

		// glbal.setCreateDate(currentDate);
		// glbal.setCreatedBy(currentUser);

		glbal.setProperty(userDto.getProperty());
		glbal = globalPropertyRepository.save(glbal);

		return new GlobalProperty(glbal);

		// return userRepository.save(user);
	}

	public GlobalProperty delete(String property) throws RuntimeException {
		GlobalProperty user = globalPropertyRepository.findByProperty(property);
		globalPropertyRepository.delete(user);
		return user;
	}

	@Override
	public GlobalProperty updateGlobalProperty(GlobalProperty userDto) throws RuntimeException {
		// String currentUser = "Unknown User";
		// Authentication authentication =
		// SecurityContextHolder.getContext().getAuthentication();
		// User modifiedUser = null;
		// if (authentication != null) {
		// modifiedUser = (User) authentication.getPrincipal();
		// if (modifiedUser != null) {
		// currentUser = modifiedUser.getUsername();
		// }
		// }

		GlobalProperty updateUser = globalPropertyRepository.findByProperty(userDto.getProperty());
		if (updateUser != null) {

			// updateUser.setModifyDate(new Date());
			// updateUser.setModifiedBy(currentUser);

			if (userDto.getDescription() != null) {
				updateUser.setDescription(userDto.getDescription());
			}
			if (userDto.getPropertyName() != null) {
				updateUser.setPropertyName(userDto.getPropertyName());
			}
			if (userDto.getPropertyValue() != null) {
				updateUser.setPropertyValue(userDto.getPropertyValue());
			}
			if (userDto.getProperty() != null) {
				updateUser.setProperty(userDto.getProperty());
			}

			updateUser = globalPropertyRepository.save(updateUser);
			return new GlobalProperty(updateUser);
		}
		return null;
	}
}
