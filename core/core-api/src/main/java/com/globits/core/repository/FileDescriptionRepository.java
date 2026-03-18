package com.globits.core.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.globits.core.domain.FileDescription;
@Repository
public interface FileDescriptionRepository extends JpaRepository<FileDescription, Long> {

}
