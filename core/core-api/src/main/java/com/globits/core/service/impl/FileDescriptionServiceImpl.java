package com.globits.core.service.impl;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.globits.core.domain.FileDescription;
import com.globits.core.service.FileDescriptionService;
@Transactional
@Service
public class FileDescriptionServiceImpl extends GenericServiceImpl<FileDescription, Long> implements FileDescriptionService {

}
