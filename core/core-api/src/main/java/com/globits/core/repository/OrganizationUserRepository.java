package com.globits.core.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.core.domain.Organization;
import com.globits.core.domain.OrganizationUser;

@Repository
public interface OrganizationUserRepository extends JpaRepository<OrganizationUser, Long> {
	@Query("select u from OrganizationUser u where u.id = ?1")
	OrganizationUser findById(Long id);

}
