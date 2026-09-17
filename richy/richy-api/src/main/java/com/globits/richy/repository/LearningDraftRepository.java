package com.globits.richy.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.globits.richy.domain.LearningDraft;

@Repository
public interface LearningDraftRepository extends JpaRepository<LearningDraft, Long> {
    LearningDraft findByUser_IdAndDraftKey(Long userId, String draftKey);
    List<LearningDraft> findByUser_IdOrderBySavedAtDesc(Long userId);
}
