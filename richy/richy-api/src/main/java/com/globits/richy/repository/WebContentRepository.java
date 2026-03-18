package com.globits.richy.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.Folder;
import com.globits.richy.domain.WebContent;
import com.globits.richy.dto.FolderDto;
@Repository
public interface WebContentRepository extends JpaRepository<WebContent, Long> {
//	@Query("select new com.globits.richy.dto.WebContentDto(u) from WebContent u where u.url = ?1")
//	FolderDto findByUrl(String url);
}
