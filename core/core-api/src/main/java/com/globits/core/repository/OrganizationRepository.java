package com.globits.core.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.core.domain.Organization;

@Repository
public interface OrganizationRepository extends JpaRepository<Organization, Long> {
	@Query("select u from Organization u where u.id = ?1")
	Organization findById(Long id);

	@Query("select ou.organization from OrganizationUser ou where ou.user.id = ?1")
	List<Organization> findOrganizationByUserId(Long id);
	
	@Query("select d from Organization d where d.parent=null")
	List<Organization> getListOrganizationByTree();
}
