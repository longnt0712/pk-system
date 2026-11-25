package com.globits.richy.question;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.globits.richy.domain.Question;
import com.globits.richy.domain.QuestionTopic;
import com.globits.richy.domain.QuestionType;
import com.globits.richy.domain.Topic;
import com.globits.richy.dto.QuestionImportConfirmDto;
import com.globits.richy.dto.QuestionImportExistingDto;
import com.globits.richy.dto.QuestionImportResultDto;
import com.globits.richy.dto.QuestionImportRowDto;
import com.globits.richy.repository.QuestionRepository;
import com.globits.richy.repository.QuestionTopicRepository;
import com.globits.richy.repository.QuestionTypeRepository;
import com.globits.richy.repository.TopicRepository;
import com.globits.richy.service.impl.QuestionExcelImportServiceImpl;
import com.globits.security.domain.User;
import com.globits.security.repository.UserRepository;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.junit.After;
import org.junit.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class QuestionExcelImportServiceTest {
    @After
    public void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    public void createsDistinctMeaningsInTargetLessonAndSkipsSameMeaningOnRetry() throws Exception {
        User owner = new User();
        owner.setId(26L);
        owner.setUsername("english");
        Topic topic = new Topic();
        topic.setId(3277L);
        topic.setUser(owner);
        QuestionType flashcard = new QuestionType();
        flashcard.setId(6L);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(owner, "",
                AuthorityUtils.createAuthorityList("ROLE_ADMIN")));

        QuestionRepository questions = mock(QuestionRepository.class);
        QuestionTopicRepository links = mock(QuestionTopicRepository.class);
        QuestionTypeRepository types = mock(QuestionTypeRepository.class);
        TopicRepository topics = mock(TopicRepository.class);
        UserRepository users = mock(UserRepository.class);
        QuestionExcelImportServiceImpl service = new QuestionExcelImportServiceImpl();
        ReflectionTestUtils.setField(service, "questionRepository", questions);
        ReflectionTestUtils.setField(service, "questionTopicRepository", links);
        ReflectionTestUtils.setField(service, "questionTypeRepository", types);
        ReflectionTestUtils.setField(service, "topicRepository", topics);
        ReflectionTestUtils.setField(service, "userRepository", users);
        when(topics.findOne(3277L)).thenReturn(topic);
        when(types.findOne(6L)).thenReturn(flashcard);
        when(users.findForVocabularyUpdate(26L)).thenReturn(owner);
        List<QuestionImportExistingDto> existing = new ArrayList<>(Arrays.asList(
                new QuestionImportExistingDto(10L, "get out", null, "đi ra", "A2"),
                new QuestionImportExistingDto(11L, "get out", null, "lấy ra; rút ra", "A1"),
                new QuestionImportExistingDto(12L, "parade", null, "cuộc diễu hành", "B1"),
                new QuestionImportExistingDto(13L, "security", null, "AN   TOÀN", "B2")));
        when(questions.findForExcelImport(26L, 6L)).thenReturn(existing);
        when(questions.save(any(Question.class))).thenAnswer(call -> {
            Question card = (Question) call.getArguments()[0];
            card.setId(100L + existing.size());
            existing.add(new QuestionImportExistingDto(card.getId(), card.getQuestion(),
                    card.getPronounce(), card.getMotherTongue(), card.getLevel()));
            return card;
        });

        List<QuestionImportRowDto> rows = service.preview(sampleExcel(), 3277L).getRows();
        assertTrue(rows.get(0).isCanCreateNew()); // Several existing meanings for this word.
        assertTrue(rows.get(1).isCanCreateNew()); // A single existing meaning still offers the choice.
        assertFalse(rows.get(2).isCanCreateNew());
        rows.forEach(row -> row.setCreateNew(true));
        QuestionImportConfirmDto request = new QuestionImportConfirmDto();
        request.setTopicId(3277L);
        request.setRows(rows);

        ObjectMapper json = new ObjectMapper();
        request = json.readValue(json.writeValueAsBytes(request), QuestionImportConfirmDto.class);
        QuestionImportResultDto result = service.confirm(request);
        assertEquals(2, result.getCreatedCount());
        assertEquals(1, result.getSkippedCount());
        assertEquals(0, result.getUpdatedCount());
        ArgumentCaptor<QuestionTopic> linked = ArgumentCaptor.forClass(QuestionTopic.class);
        verify(links, times(2)).save(linked.capture());
        assertEquals("lan truyền; bị tiết lộ", linked.getAllValues().get(0).getQuestion().getMotherTongue());
        assertEquals("diễu hành", linked.getAllValues().get(1).getQuestion().getMotherTongue());
        for (QuestionTopic link : linked.getAllValues()) {
            assertSame(owner, link.getQuestion().getUser());
            assertSame(topic, link.getTopic());
        }

        QuestionImportResultDto retry = service.confirm(request);
        assertEquals(0, retry.getCreatedCount());
        assertEquals(3, retry.getSkippedCount());
        verify(questions, times(2)).save(any(Question.class));
        verify(links, times(2)).save(any(QuestionTopic.class));
    }

    private MockMultipartFile sampleExcel() throws Exception {
        try (HSSFWorkbook workbook = new HSSFWorkbook(); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet();
            String[][] data = {
                    {"Word", "Pronounce", "First language", "CEFR level"},
                    {"Get out", "/ɡet aʊt/", "lan truyền; bị tiết lộ", "B1"},
                    {"parade", "/pəˈreɪd/", "diễu hành", "B2"},
                    {"security", "", "an toàn", "B2"}
            };
            for (int i = 0; i < data.length; i++) {
                Row row = sheet.createRow(i);
                for (int j = 0; j < data[i].length; j++) {
                    row.createCell(j).setCellValue(data[i][j]);
                }
            }
            workbook.write(bytes);
            return new MockMultipartFile("file", "words.xls", "application/vnd.ms-excel", bytes.toByteArray());
        }
    }
}
