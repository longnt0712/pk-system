package com.globits.richy.repository;

import com.globits.richy.domain.AttendanceConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AttendanceConfigRepository extends JpaRepository<AttendanceConfig, Integer> { }
