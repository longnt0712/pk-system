package com.globits.richy.service.impl;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import javax.persistence.EntityManager;
import javax.persistence.LockModeType;
import javax.persistence.PersistenceContext;

import com.globits.richy.domain.Question;
import com.globits.richy.domain.Topic;
import com.globits.richy.dto.ReadingVocabularyLessonDto;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.ResponseStatus;

@Service
@Transactional(readOnly = true)
public class ReadingVocabularyService {
    private static final int PAGE_SIZE = 30;
    private static final String SHARED_LESSONS =
            " from Topic t join t.topicCategory category where category.ownerId is null"
            + " and t.user is not null and (t.isShow is null or t.isShow = true)";
    private static final Comparator<Topic> TOPIC_ORDER =
            Comparator.comparing(Topic::getName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                    .thenComparing(Topic::getId);

    @PersistenceContext
    private EntityManager em;

    @Autowired
    private TopicCategoryVisibilityService categoryVisibility;

    public List<ReadingVocabularyLessonDto> getLessons(Long testId) {
        Question test = requirePublishedReading(em.find(Question.class, testId));
        Set<Long> allowedCategories = categoryVisibility.getAllowedCategoryIdsForCurrentStudent();
        return test.getReadingVocabularyLessons().stream().filter(ReadingVocabularyService::isSharedLesson)
                .filter(topic -> allowedCategories == null || allowedCategories.contains(topic.getTopicCategory().getId()))
                .sorted(TOPIC_ORDER).map(ReadingVocabularyLessonDto::new).collect(Collectors.toList());
    }

    @Transactional
    public List<ReadingVocabularyLessonDto> saveLessons(Long testId, List<Long> topicIds) {
        if (topicIds == null || topicIds.stream().anyMatch(id -> id == null || id <= 0)) {
            throw new IllegalArgumentException("Danh sách bài từ vựng không hợp lệ.");
        }
        Question test = requirePublishedReading(em.find(Question.class, testId, LockModeType.PESSIMISTIC_WRITE));
        Set<Long> uniqueIds = new HashSet<>(topicIds);
        List<Topic> lessons = new ArrayList<>();
        if (!uniqueIds.isEmpty()) {
            lessons = em.createQuery("select t" + SHARED_LESSONS + " and t.id in :ids", Topic.class)
                    .setParameter("ids", uniqueIds).getResultList();
            if (lessons.size() != uniqueIds.size()) {
                throw new IllegalArgumentException("Một bài đã ẩn, đã xóa hoặc đã chuyển sang nhóm riêng. Hãy chọn lại.");
            }
        }
        test.getReadingVocabularyLessons().retainAll(lessons);
        test.getReadingVocabularyLessons().addAll(lessons);
        return lessons.stream().sorted(TOPIC_ORDER).map(ReadingVocabularyLessonDto::new).collect(Collectors.toList());
    }

    public Page<ReadingVocabularyLessonDto> getOptions(Long categoryId, String search, int page) {
        PageRequest request = new PageRequest(Math.max(1, Math.min(page, 10000)) - 1, PAGE_SIZE);
        String filter = SHARED_LESSONS + " and category.id = :categoryId and lower(t.name) like :name";
        String name = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
        List<ReadingVocabularyLessonDto> options = em.createQuery("select t" + filter + " order by t.name, t.id", Topic.class)
                .setParameter("categoryId", categoryId).setParameter("name", name)
                .setFirstResult(request.getOffset()).setMaxResults(request.getPageSize()).getResultList().stream()
                .map(ReadingVocabularyLessonDto::new).collect(Collectors.toList());
        long total = em.createQuery("select count(t.id)" + filter, Long.class)
                .setParameter("categoryId", categoryId).setParameter("name", name).getSingleResult();
        return new PageImpl<>(options, request, total);
    }

    private static boolean isSharedLesson(Topic topic) {
        return topic.getUser() != null && topic.getTopicCategory() != null && topic.getTopicCategory().getOwnerId() == null
                && !Boolean.FALSE.equals(topic.getIsShow());
    }

    private static Question requirePublishedReading(Question test) {
        if (test == null || test.getParent() != null || test.getStatus() != 7 || test.getQuestionType() == null
                || !Long.valueOf(11).equals(test.getQuestionType().getId())) {
            throw new ReadingTestNotFound();
        }
        String format = test.getTestFormat();
        if ("READING".equals(format) || (!"LISTENING".equals(format) && !"DAILY_LISTENING".equals(format)
                && !"COMPREHENSIVE".equals(format) && !"WRITING".equals(format)
                && (test.getPronounce() == null || test.getPronounce().trim().isEmpty()))) {
            return test;
        }
        throw new ReadingTestNotFound();
    }

    @ResponseStatus(HttpStatus.NOT_FOUND)
    private static class ReadingTestNotFound extends RuntimeException {
        private static final long serialVersionUID = 1L;
    }
}
