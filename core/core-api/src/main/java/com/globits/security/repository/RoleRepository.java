package com.globits.security.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.security.domain.Role;

@Repository
public interface RoleRepository extends JpaRepository<Role, Long> {
	Role findByName(String name);

	@Query("select u from Role u  where u.name like '%ROLE_STUDENT%'")
	Page<Role> findByRoleStudent(Pageable pageable);
	
	@Query("select u from Role u  where u.name like '%ROLE_STAFF%'")
	Page<Role> findByRoleStaff(Pageable pageable);
	
}
