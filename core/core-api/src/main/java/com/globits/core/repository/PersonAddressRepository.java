package com.globits.core.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.globits.core.domain.PersonAddress;

@Repository
public interface PersonAddressRepository extends JpaRepository<PersonAddress, Long> {

}
