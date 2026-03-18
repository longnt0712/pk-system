package com.globits.security.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.globits.security.domain.User;
import com.globits.security.dto.UserDto;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
	@Query("select new User(u.id, u.username, u.email, u.accountNonLocked) from User u where u.username like ?1")
	Page<User> searchByPageBasicInfo(Pageable pageable, String userName);

	@Query("select new User(u.id, u.username, u.email, u.accountNonLocked) from User u")
	Page<User> findByPageBasicInfo(Pageable pageable);

	@Query("select u from User u left join fetch u.roles where u.username = ?1")
	User findByUsername(String username);

	@Query("select u from User u left join fetch u.roles left join fetch u.person where u.username = ?1")
	User findByUsernameAndPerson(String username);

	@Query(value = "select u from User u where u.email=:email")
	User findByEmail(@Param("email") String email);

	@Query("select u from User u left join fetch u.roles where u.id = ?1")
	User findById(Long id);
	
	@Query("select new com.globits.security.dto.UserDto(u) from User u where u.username like %?1%")
	Page<UserDto> findByPageUsername(String username,Pageable pageable);
	
	@Query("select new com.globits.security.dto.UserDto(u,true) from User u where u.active = true")
	List<UserDto> getAllUserWithDisplayNameAndUsername();
	
	@Query("select new com.globits.security.dto.UserDto(u,true) from User u where u.active = true and u.person.displayName like %?1%")
	List<UserDto> getAllUserWithDisplayNameAndUsername(String grade);
	
	@Query("select u from User u where u.person.enrollmentClass = ?1 and u.active = true")
	List<User> getUsersByEnrollmentClass(int enrollmentClass);
	
	@Query("select new com.globits.security.dto.UserDto(u) from User u where u.person.enrollmentClass = ?1 and u.active = true")
	List<UserDto> getUsersDtoByEnrollmentClass(int enrollmentClass);
	
	@Query("select u from User u where u.person.enrollmentClass != null and u.active = true")
	List<User> getUsersByAllEnrollmentClass();
}
