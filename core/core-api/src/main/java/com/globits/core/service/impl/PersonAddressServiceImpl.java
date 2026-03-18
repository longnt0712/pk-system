package com.globits.core.service.impl;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.globits.core.domain.PersonAddress;
import com.globits.core.service.PersonAddressService;

@Transactional
@Service
public class PersonAddressServiceImpl extends GenericServiceImpl<PersonAddress, Long> implements PersonAddressService {

}
