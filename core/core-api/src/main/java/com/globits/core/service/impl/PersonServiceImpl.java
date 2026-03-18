package com.globits.core.service.impl;

import java.util.List;

import javax.persistence.EntityManager;
import javax.persistence.TypedQuery;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.globits.core.domain.Person;
import com.globits.core.repository.PersonRepository;
import com.globits.core.service.PersonService;
import com.globits.security.domain.User;

@Transactional
@Service
public class PersonServiceImpl extends GenericServiceImpl<Person, Long> implements PersonService {
	@Autowired
	private PersonRepository personRepository;

	@Autowired
	EntityManager entityManager;

	public Person getPersonWithAddress(Long personId) {
		return personRepository.getPersonWithAddress(personId);
	}

	public Person getFullPersonInfo(Long personId) {
		return personRepository.getFullPersonInfo(personId);
	}

	public Person savePerson(Person person) {
		Person updatePerson = personRepository.getPersonWithAddress(person.getId());
		updatePerson.setAddress(person.getAddress());
		updatePerson.setBirthDate(person.getBirthDate());

		User user = person.getUser();
		if (user != null) {
			User updateUser = updatePerson.getUser();
			updateUser.setAccountNonExpired(user.isAccountNonExpired());
			updateUser.setAccountNonLocked(user.isAccountNonLocked());
			if (user.getRoles() != null)
				updateUser.setRoles(user.getRoles());
			if (user.getUsername() != null)
				updateUser.setUsername(user.getUsername());
			updatePerson.setUser(updateUser);
		}

		return this.save(updatePerson);
	}

	public Page<Person> getListByPage(int pageIndex, int pageSize) {
		Pageable pageable = new PageRequest(pageIndex - 1, pageSize);
		int firstResult = (pageIndex - 1) * pageSize;
		Long total = (Long) entityManager.createQuery("select count(*) from Person").getSingleResult();
		TypedQuery<Person> q = entityManager.createQuery(
				"select new Person(p.id, p.firstName, p.lastName, p.displayName, p.birthDate, p.phoneNumber) from Person p",
				Person.class);
		q.setFirstResult(firstResult);
		q.setMaxResults(pageSize);
		List<Person> list = q.getResultList();
		Page<Person> page = new PageImpl<Person>(list, pageable, total);
		return page;
		// entityManager.("select p.id, p.firstName, p.lastName, p.birthDate from Person
		// p").setRe
	}

}
