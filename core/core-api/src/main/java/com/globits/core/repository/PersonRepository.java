package com.globits.core.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import com.globits.core.domain.Person;

@Repository
public interface PersonRepository extends JpaRepository<Person, Long> {
	@Query("select p from Person p left join fetch p.address left join fetch p.user where p.id = ?1")
	Person getFullPersonInfo(Long personId);

	@Query("select p from Person p left join fetch p.address where p.id = ?1")
	Person getPersonWithAddress(Long personId);

	@Transactional
	@Query("delete from PersonAddress pa where pa.person.id = ?1")
	int deletePersonAddress(Long personId);
	
	@Query("select u.id from Person u where u.enrollmentClass = ?1")
	List<Person> findPersonByEnrollmentClass(int enrollmentClass);
}
