package com.globits.richy.schedule;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.globits.richy.dto.LearningDraftDto;
import com.globits.richy.service.impl.LearningDraftReceipts;
import java.util.*;
import javax.persistence.*;
import org.junit.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class LearningDraftReceiptsTest {
    private final ObjectMapper json = new ObjectMapper();
    private EntityManager em; private TypedQuery<Object[]> query; private List<Object[]> results;
    private Map<String,Object> payload; private LearningDraftDto draft;
    @Before @SuppressWarnings("unchecked") public void setup() throws Exception {
        em=mock(EntityManager.class);query=mock(TypedQuery.class);when(em.createQuery(anyString(),eq(Object[].class))).thenReturn(query);
        when(query.setParameter(anyString(),any())).thenReturn(query);results=new ArrayList<Object[]>();when(query.getResultList()).thenReturn(results);
        payload=new LinkedHashMap<String,Object>();payload.put("userId",7);payload.put("testId",54);payload.put("testMode","COMPREHENSIVE");payload.put("sessionMode","SERIOUS");
        payload.put("assignmentTaskId",19);payload.put("assignmentParts",Arrays.asList(1));payload.put("clientAttemptKey","aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        draft=new LearningDraftDto();draft.setDraftType("IELTS");draft.setDraftKey("ieltsReadingInProgress:7:comprehensive:test:54:serious:task:19:parts:1");
        results.add(row());
    }
    private Object[] row(){return new Object[]{91L,7L,"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",6,54L,19L,null,",1,",1,"SUCCESS","SERIOUS"};}
    private void attach() throws Exception {draft.setPayload(json.writeValueAsString(payload));LearningDraftReceipts.attach(em,7L,Arrays.asList(draft));}
    @Test public void exactSavedAttemptGetsOnlyReceiptMetadataWithoutRewritingDraft() throws Exception {
        attach();assertNotNull(draft.getSavedResult());assertEquals(91L,draft.getSavedResult().get("id"));assertEquals(Arrays.asList(1),draft.getSavedResult().get("completedParts"));
        assertEquals(json.writeValueAsString(payload),draft.getPayload());assertEquals(10,draft.getSavedResult().size());verify(em,never()).remove(any());verify(em,never()).merge(any());
    }
    @Test public void anotherOwnerSourceTaskSectionPartsTypeAttemptOrStudyResultCannotConfirm() throws Exception {
        int[] columns={1,4,5,6,7,3,2,10,9};Object[] wrong={8L,55L,20L,"other-section",",2,",7,"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","STUDY",null};
        for(int i=0;i<columns.length;i++){Object[] row=row();row[columns[i]]=wrong[i];results.clear();results.add(row);draft.setSavedResult(null);attach();assertNull("column "+columns[i],draft.getSavedResult());}
    }
    @Test public void studyForeignOrMalformedDraftsDoNotQueryResults() throws Exception {
        payload.put("sessionMode","STUDY");payload.remove("assignmentTaskId");draft.setDraftKey("ieltsReadingInProgress:7:comprehensive:test:54:study");attach();assertNull(draft.getSavedResult());
        payload.put("sessionMode","SERIOUS");payload.put("userId",8);attach();assertNull(draft.getSavedResult());
        draft.setPayload("not json");LearningDraftReceipts.attach(em,7L,Arrays.asList(draft));verify(em,never()).createQuery(anyString(),eq(Object[].class));
    }
    @Test public void keyedTaskSectionAndAttemptMustAgreeWithPayload() throws Exception {
        for(String suffix:Arrays.asList(":task:20:parts:1",":task:19:parts:1:section:other",":task:19:parts:1:attempt:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")){
            draft.setDraftKey("ieltsReadingInProgress:7:comprehensive:test:54:serious"+suffix);payload.put("assignmentSectionKey","original");attach();assertNull(draft.getSavedResult());
        }
        verify(em,never()).createQuery(anyString(),eq(Object[].class));
    }
    @Test public void fullTestsRequireExactPartNumbersAndFailedReceiptsRemainExplicit() throws Exception {
        payload.remove("assignmentTaskId");payload.put("assignmentParts",Collections.emptyList());payload.put("isPartAssignment",false);payload.put("partNumbers",Arrays.asList(1,2,3));
        draft.setDraftKey("ieltsReadingInProgress:7:comprehensive:test:54:serious");Object[] row=row();row[5]=null;row[7]=",1,2,3,";row[8]=null;row[9]="FAILED";results.clear();results.add(row);
        attach();assertEquals("FAILED",draft.getSavedResult().get("resultStatus"));assertEquals(Arrays.asList(1,2,3),draft.getSavedResult().get("completedParts"));
        payload.remove("partNumbers");draft.setSavedResult(null);attach();assertNull(draft.getSavedResult());
    }
    @Test public void repeatedDraftsUseOneBoundedMetadataQuery() throws Exception {
        draft.setPayload(json.writeValueAsString(payload));List<LearningDraftDto> drafts=new ArrayList<LearningDraftDto>();for(int i=0;i<20;i++)drafts.add(draft);
        LearningDraftReceipts.attach(em,7L,drafts);assertNotNull(draft.getSavedResult());verify(em,times(1)).createQuery(anyString(),eq(Object[].class));
    }
    @Test public void malformedAssignmentPartsCannotFallBackToDifferentFullTestParts() throws Exception {
        payload.put("assignmentParts",Arrays.asList("invalid"));payload.put("partNumbers",Arrays.asList(1));attach();assertNull(draft.getSavedResult());
        payload.put("assignmentParts","1");attach();assertNull(draft.getSavedResult());verify(em,never()).createQuery(anyString(),eq(Object[].class));
    }
}
