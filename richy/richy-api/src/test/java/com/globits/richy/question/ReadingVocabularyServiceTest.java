package com.globits.richy.question;

import com.globits.richy.domain.Question;
import com.globits.richy.domain.QuestionType;
import com.globits.richy.domain.Topic;
import com.globits.richy.domain.TopicCategory;
import com.globits.richy.dto.ReadingVocabularyLessonDto;
import com.globits.richy.service.impl.ReadingVocabularyService;
import com.globits.richy.service.impl.TopicCategoryVisibilityService;
import com.globits.security.domain.User;
import org.junit.Before;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;

import javax.persistence.EntityManager;
import javax.persistence.LockModeType;
import javax.persistence.TypedQuery;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;

import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class ReadingVocabularyServiceTest {
    private final ReadingVocabularyService service = new ReadingVocabularyService();
    private final EntityManager manager = mock(EntityManager.class);
    private final TopicCategoryVisibilityService visibility = mock(TopicCategoryVisibilityService.class);
    private final Question reading = new Question();

    @Before
    public void setup() {
        ReflectionTestUtils.setField(service, "em", manager);
        ReflectionTestUtils.setField(service, "categoryVisibility", visibility);
        reading.setStatus(7);
        QuestionType type = new QuestionType();
        type.setId(11L);
        reading.setQuestionType(type);
        when(manager.find(Question.class, 80L)).thenReturn(reading);
        when(manager.find(Question.class, 80L, LockModeType.PESSIMISTIC_WRITE)).thenReturn(reading);
    }

    @Test
    public void returnsOnlyPublishedSharedLessonsAvailableToTheStudent() {
        Topic passage = topic(1L, 10L);
        Topic otherFolder = topic(2L, 20L);
        Topic hidden = topic(3L, 10L);
        hidden.setIsShow(false);
        Topic personal = topic(4L, 10L);
        personal.getTopicCategory().setOwnerId(22L);
        reading.getReadingVocabularyLessons().addAll(Arrays.asList(passage, otherFolder, hidden, personal));
        when(visibility.getAllowedCategoryIdsForCurrentStudent()).thenReturn(Collections.singleton(10L));

        List<ReadingVocabularyLessonDto> lessons = service.getLessons(80L);
        assertEquals(1, lessons.size());
        assertEquals(Long.valueOf(1), lessons.get(0).getId());
        assertEquals(Long.valueOf(10), lessons.get(0).getTopicCategory().getId());
        assertEquals(Long.valueOf(26), lessons.get(0).getSourceUserId());
    }

    @Test
    @SuppressWarnings("unchecked")
    public void saveReplacesLinksInOneCallAndAllowsRemovingAll() {
        reading.getReadingVocabularyLessons().add(topic(90L, 10L));
        Topic passage = topic(1L, 10L);
        Topic summary = topic(2L, 20L);
        TypedQuery<Topic> query = mock(TypedQuery.class);
        when(manager.createQuery(anyString(), eq(Topic.class))).thenReturn(query);
        when(query.setParameter("ids", new HashSet<>(Arrays.asList(1L, 2L)))).thenReturn(query);
        when(query.getResultList()).thenReturn(Arrays.asList(passage, summary));

        assertEquals(2, service.saveLessons(80L, Arrays.asList(1L, 2L, 1L)).size());
        assertEquals(new HashSet<>(Arrays.asList(passage, summary)), reading.getReadingVocabularyLessons());
        assertTrue(service.saveLessons(80L, Collections.emptyList()).isEmpty());
        assertTrue(reading.getReadingVocabularyLessons().isEmpty());
    }

    private static Topic topic(Long id, Long categoryId) {
        Topic lesson = new Topic();
        lesson.setId(id);
        lesson.setName("Bài " + id);
        User source = new User();
        source.setId(26L);
        source.setUsername("english");
        lesson.setUser(source);
        TopicCategory category = new TopicCategory();
        category.setId(categoryId);
        category.setName("Khối " + categoryId);
        lesson.setTopicCategory(category);
        return lesson;
    }
}
