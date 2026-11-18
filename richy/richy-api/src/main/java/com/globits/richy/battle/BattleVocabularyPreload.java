package com.globits.richy.battle;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;

import com.globits.richy.dto.QuestionForGamesDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class BattleVocabularyPreload {
    private static final int QUERY_TIMEOUT_MS = 5000;

    @PersistenceContext
    private EntityManager manager;

    public List<Long> plan(Long ownerId, List<Long> topicIds) {
        if (ownerId == null || topicIds.isEmpty()) { return Collections.emptyList(); }
        return manager.createQuery(
                "select q.id from Question q"
                + " where q.user.id = :owner and q.questionType.id = 6 and q.timeReviewd between 0 and 100"
                + " and q.question is not null and q.motherTongue is not null"
                + " and exists (select link.id from QuestionTopic link where link.question.id = q.id and link.topic.id in :topics)"
                + " order by q.ordinalNumber, q.createDate desc, q.id desc", Long.class)
                .setParameter("owner", ownerId).setParameter("topics", topicIds)
                .setHint("javax.persistence.query.timeout", QUERY_TIMEOUT_MS).getResultList();
    }

    public List<QuestionForGamesDto> loadBatch(Long ownerId, List<Long> ids) {
        if (ids.isEmpty()) { return Collections.emptyList(); }
        List<QuestionForGamesDto> cards = manager.createQuery(
                "select new com.globits.richy.dto.QuestionForGamesDto(q.id, q.question, q.pronounce, q.motherTongue, q.level)"
                + " from Question q where q.id in :ids and q.user.id = :owner and q.questionType.id = 6", QuestionForGamesDto.class)
                .setParameter("ids", ids).setParameter("owner", ownerId)
                .setHint("javax.persistence.query.timeout", QUERY_TIMEOUT_MS).getResultList();
        Map<Long, QuestionForGamesDto> byId = new HashMap<>();
        cards.forEach(card -> byId.put(card.getId(), card));
        List<QuestionForGamesDto> ordered = new ArrayList<>(cards.size());
        for (Long id : ids) {
            QuestionForGamesDto card = byId.get(id);
            if (card != null) { ordered.add(card); }
        }
        return ordered;
    }
}
