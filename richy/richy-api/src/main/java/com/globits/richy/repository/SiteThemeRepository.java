package com.globits.richy.repository;

import com.globits.richy.domain.SiteTheme;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SiteThemeRepository extends JpaRepository<SiteTheme, String> { }
