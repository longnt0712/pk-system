package com.globits.core.service;

import org.springframework.data.domain.Page;

import com.globits.core.domain.Person;

public interface PersonService extends GenericService<Person, Long> {

	Person getPersonWithAddress(Long personId);

	Person savePerson(Person person);

	Person getFullPersonInfo(Long personId);

	Page<Person> getListByPage(int pageIndex, int pageSize);
}
