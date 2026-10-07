package com.globits.richy.testresult;

import com.globits.richy.domain.LearningDraft;
import com.globits.richy.domain.TestResult;
import com.globits.richy.dto.LearningDraftDto;
import com.globits.richy.dto.TestResultDto;
import com.globits.richy.repository.LearningDraftRepository;
import com.globits.richy.repository.TestResultRepository;
import com.globits.richy.service.impl.TestResultServiceImpl;
import com.globits.security.domain.User;
import com.globits.security.dto.UserDto;
import com.globits.security.repository.UserRepository;
import java.util.*;
import org.junit.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class IeltsNotePersistenceTest {
    private TestResultServiceImpl service;
    private User user;
    private LearningDraftRepository drafts;
    private TestResultRepository results;
    private UserRepository users;
    private Map<String, LearningDraft> database;
    private long nextResultId = 10L;
    private static final String STUDY_KEY = "ieltsReadingInProgress:7:reading:test:42";
    private static final String STUDY = "{\"sessionMode\":\"STUDY\",\"annotationNotes\":[{\"id\":\"n1\",\"specificNote\":\"Ghi chú tiếng Việt\"}],\"annotations\":[{\"start\":0,\"end\":7,\"highlighted\":true}]}";
    private static final String SERIOUS = "{\"sessionMode\":\"SERIOUS\",\"annotationNotes\":[{\"id\":\"n2\",\"specificNote\":\"Test note\"}],\"annotations\":[]}";

    @Before public void setup() {
        user = new User(); user.setId(7L); user.setUsername("student");
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, "", Collections.emptyList()));
        users = mock(UserRepository.class);
        when(users.findByUsername("student")).thenReturn(user);
        when(users.getOne(7L)).thenReturn(user);
        service = new TestResultServiceImpl();
        drafts = mock(LearningDraftRepository.class);
        results = mock(TestResultRepository.class);
        ReflectionTestUtils.setField(service, "userRepository", users);
        ReflectionTestUtils.setField(service, "learningDraftRepository", drafts);
        ReflectionTestUtils.setField(service, "testResultRepository", results);
        database = new LinkedHashMap<>();
        when(drafts.findByUser_IdAndDraftKey(anyLong(), anyString())).thenAnswer(call -> database.get(call.getArguments()[0] + ":" + call.getArguments()[1]));
        when(drafts.save(any(LearningDraft.class))).thenAnswer(call -> {
            LearningDraft value = (LearningDraft) call.getArguments()[0];
            value.setId(1L);
            database.put(value.getUser().getId() + ":" + value.getDraftKey(), value);
            return value;
        });
        when(drafts.findByUser_IdOrderBySavedAtDesc(anyLong())).thenAnswer(call -> {
            List<LearningDraft> values = new ArrayList<>();
            for (LearningDraft value : database.values()) if (value.getUser().getId().equals(call.getArguments()[0])) values.add(value);
            return values;
        });
        doAnswer(call -> {
            LearningDraft value = (LearningDraft) call.getArguments()[0];
            database.remove(value.getUser().getId() + ":" + value.getDraftKey()); return null;
        }).when(drafts).delete(any(LearningDraft.class));
        when(results.save(any(TestResult.class))).thenAnswer(call -> {
            TestResult value = (TestResult) call.getArguments()[0];
            if (value.getId() == null) { value.setId(nextResultId++); }
            when(results.findOne(value.getId())).thenReturn(value); when(results.getOne(value.getId())).thenReturn(value);
            return value;
        });
    }

    @After public void cleanup() { SecurityContextHolder.clearContext(); }

    private LearningDraftDto draft(String key, String payload) {
        LearningDraftDto dto = new LearningDraftDto(); dto.setDraftKey(key); dto.setDraftType("IELTS"); dto.setPayload(payload); return dto;
    }

    @Test public void serverDraftsRetainNotesAcrossReadsAndSeparateModesAndUsers() {
        service.saveLearningDraft(draft(STUDY_KEY, STUDY));
        service.saveLearningDraft(draft(STUDY_KEY + ":serious", SERIOUS));
        List<LearningDraftDto> loaded = service.getLearningDrafts();
        assertEquals(2, loaded.size());
        assertEquals(STUDY, loaded.get(0).getPayload()); assertEquals(SERIOUS, loaded.get(1).getPayload());
        assertNotNull(loaded.get(0).getSavedAt());
        User other = new User(); other.setId(8L); other.setUsername("other");
        when(users.findByUsername("other")).thenReturn(other);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(other, "", Collections.emptyList()));
        assertTrue(service.getLearningDrafts().isEmpty());
    }

    @Test public void deletingSeriousDraftDoesNotDeleteStudyNotes() {
        service.saveLearningDraft(draft(STUDY_KEY, STUDY));
        service.saveLearningDraft(draft(STUDY_KEY + ":serious", SERIOUS));
        service.deleteLearningDraft(draft(STUDY_KEY + ":serious", SERIOUS));
        assertEquals(1, service.getLearningDrafts().size());
        assertEquals(STUDY, service.getLearningDrafts().get(0).getPayload());
    }

    private TestResultDto submit(String mode, String state) {
        TestResultDto dto = new TestResultDto(); dto.setTestType(4); dto.setUser(new UserDto(user));
        dto.setIeltsSessionMode(mode); dto.setIeltsLearningState(state); dto.setActiveDurationSeconds(120);
        return service.saveObject(dto);
    }

    @Test public void submittedNotesAndHighlightsAreReturnedByResultDetailFromServer() {
        TestResultDto saved = submit("STUDY", STUDY);
        TestResultDto detail = service.getObjectById(saved.getId());
        assertEquals(STUDY, detail.getIeltsLearningState()); assertEquals("STUDY", detail.getIeltsSessionMode());
        assertEquals(Integer.valueOf(120), detail.getActiveDurationSeconds());
        // The historic result does not take notes from the current study draft.
        service.saveLearningDraft(draft(STUDY_KEY, SERIOUS));
        assertEquals(STUDY, service.getObjectById(saved.getId()).getIeltsLearningState());
    }

    @Test public void editingSummaryWithoutAnnotationFieldsPreservesSubmittedSnapshot() {
        TestResultDto summary = submit("STUDY", STUDY);
        summary.setIeltsSessionMode(null); summary.setActiveDurationSeconds(null);
        summary.setIeltsLearningState(null);
        service.saveObject(summary);
        TestResultDto detail = service.getObjectById(summary.getId());
        assertEquals(STUDY, detail.getIeltsLearningState()); assertEquals("STUDY", detail.getIeltsSessionMode());
        assertEquals(Integer.valueOf(120), detail.getActiveDurationSeconds());
    }

    @Test public void seriousSubmissionHasItsOwnSnapshotAndDoesNotChangeStudyResultOrDraft() {
        service.saveLearningDraft(draft(STUDY_KEY, STUDY));
        TestResultDto study = submit("STUDY", STUDY);
        TestResultDto serious = submit("SERIOUS", SERIOUS);
        assertFalse(study.getId().equals(serious.getId()));
        assertEquals(STUDY, service.getObjectById(study.getId()).getIeltsLearningState());
        assertEquals(SERIOUS, service.getObjectById(serious.getId()).getIeltsLearningState());
        assertEquals(STUDY, service.getLearningDrafts().get(0).getPayload());
    }
}
