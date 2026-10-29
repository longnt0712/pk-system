package com.globits.richy.schedule;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.globits.richy.domain.EnrolmentClassScheduleTask;
import com.globits.richy.domain.Question;
import com.globits.richy.dto.ComprehensiveAssignmentSectionDto;
import com.globits.richy.dto.EnrolmentClassScheduleTaskDto;
import com.globits.richy.dto.TestResultDto;
import com.globits.richy.service.impl.ComprehensiveAssignmentSections;
import java.util.*;
import org.junit.Test;
import static org.junit.Assert.*;

public class ComprehensiveAssignmentSectionsTest {
    private Question question(long id,int ordinal,int type) {
        Question q=new Question(); q.setId(id);q.setOrdinalNumber(ordinal);q.setType(type);q.setSubQuestions(new LinkedHashSet<Question>());return q;
    }
    private Question source(Question...passages) {
        Question q=question(100001,1,0);q.setTestFormat("COMPREHENSIVE");q.setSubQuestions(new LinkedHashSet<Question>(Arrays.asList(passages)));return q;
    }
    private Question pack(int ordinal,int type,int start,int count) {
        Question pack=question(10000+ordinal,ordinal,type);
        // Insert backwards to prove grouping follows authored ordinal order, not Set iteration order.
        for(int i=start+count-1;i>=start;i--){Question q=question(i,i,0);q.setParent(pack);pack.getSubQuestions().add(q);}return pack;
    }
    private Question passage(int ordinal,Question...packs) {
        Question p=question(20000+ordinal,ordinal,0);p.setSubQuestions(new LinkedHashSet<Question>(Arrays.asList(packs)));for(Question q:packs)q.setParent(p);return p;
    }
    private List<Long> flatten(List<ComprehensiveAssignmentSectionDto> sections) {
        List<Long> out=new ArrayList<Long>();for(ComprehensiveAssignmentSectionDto s:sections)out.addAll(s.getQuestionIds());return out;
    }
    @Test public void twoHundredStandaloneQuestionsBecomeFourStableFiftyQuestionSectionsWithoutEditingSource() {
        Question pack=pack(1,1,1,200),passage=passage(1,pack),source=source(passage);List<Question> original=new ArrayList<Question>(pack.getSubQuestions());
        List<ComprehensiveAssignmentSectionDto> sections=ComprehensiveAssignmentSections.plan(source,50,20);
        assertEquals(4,sections.size());for(int i=0;i<4;i++){ComprehensiveAssignmentSectionDto s=sections.get(i);assertEquals(i+1,s.getNumber());assertEquals(50,s.getQuestionCount());assertEquals(i*50+1,s.getFirstOrdinal());assertEquals((i+1)*50,s.getLastOrdinal());assertEquals(Integer.valueOf(20),s.getDurationMinutes());}
        List<Long> expected=new ArrayList<Long>();for(long i=1;i<=200;i++)expected.add(i);assertEquals(expected,flatten(sections));assertEquals(original,new ArrayList<Question>(pack.getSubQuestions()));for(Question q:original)assertSame(pack,q.getParent());
    }
    @Test public void sharedGapGroupsStayTogetherAndChooseTheClosestBoundary() {
        Question gaps=pack(2,11,50,5);Question source=source(passage(1,pack(1,1,1,49),gaps,pack(3,1,55,46)));
        List<ComprehensiveAssignmentSectionDto> sections=ComprehensiveAssignmentSections.plan(source,50,0);
        assertEquals(2,sections.size());assertEquals(49,sections.get(0).getQuestionCount());assertEquals(51,sections.get(1).getQuestionCount());for(long id=50;id<=54;id++)assertTrue(sections.get(1).getQuestionIds().contains(id));assertEquals(Integer.valueOf(0),sections.get(1).getDurationMinutes());assertEquals(100,new HashSet<Long>(flatten(sections)).size());
    }
    @Test public void oversizedSharedPackageAndLinkedHeadingPassageAreNeverCut() {
        Question source=source(passage(1,pack(1,15,1,120),pack(2,1,121,40)));
        List<ComprehensiveAssignmentSectionDto> sections=ComprehensiveAssignmentSections.plan(source,50,null);assertEquals(2,sections.size());assertEquals(120,sections.get(0).getQuestionCount());assertEquals(40,sections.get(1).getQuestionCount());
        source=source(passage(1,pack(1,1,1,40),pack(2,4,41,11)),passage(2,pack(1,1,52,50)));
        sections=ComprehensiveAssignmentSections.plan(source,50,60);assertEquals(2,sections.size());assertEquals(51,sections.get(0).getQuestionCount());assertEquals(50,sections.get(1).getQuestionCount());
    }
    @Test public void snapshotRoundTripsMembershipKeysAndIndividualTimesAndRejectsCorruption() throws Exception {
        Question source=source(passage(1,pack(1,1,1,100)));List<ComprehensiveAssignmentSectionDto> sections=ComprehensiveAssignmentSections.plan(source,50,25);sections.get(1).setDurationMinutes(0);
        EnrolmentClassScheduleTask task=new EnrolmentClassScheduleTask();ComprehensiveAssignmentSections.write(task,sections);String snapshot=task.getComprehensiveSectionsJson();assertTrue(snapshot.contains("\"questionCount\":50"));
        List<ComprehensiveAssignmentSectionDto> restored=ComprehensiveAssignmentSections.read(task);assertEquals(sections.get(0).getKey(),restored.get(0).getKey());assertEquals(sections.get(1).getQuestionIds(),restored.get(1).getQuestionIds());assertEquals(Integer.valueOf(0),restored.get(1).getDurationMinutes());assertNotSame(sections.get(0),restored.get(0));
        assertEquals(restored.get(0).getKey(),ComprehensiveAssignmentSections.find(task,restored.get(0).getKey()).getKey());assertNull(ComprehensiveAssignmentSections.find(task,"unknown"));ComprehensiveAssignmentSections.validateAgainstSource(source,restored);
        restored.get(0).setDurationMinutes(90);assertTrue(ComprehensiveAssignmentSections.sameLayout(sections,restored));restored.get(0).getQuestionIds().remove(0);assertFalse(ComprehensiveAssignmentSections.sameLayout(sections,restored));
        try{ComprehensiveAssignmentSections.validateAgainstSource(source,restored);fail();}catch(IllegalArgumentException expected){}
        task.setComprehensiveSectionsJson("[bad JSON");try{ComprehensiveAssignmentSections.read(task);fail();}catch(IllegalStateException expected){}
    }
    @Test public void omittedFieldsPreserveLegacySemanticsWhileExplicitNullOrUntimedMarkConfiguration() throws Exception {
        ObjectMapper json=new ObjectMapper();EnrolmentClassScheduleTaskDto dto=json.readValue("{\"title\":\"legacy\"}",EnrolmentClassScheduleTaskDto.class);assertFalse(dto.hasComprehensiveConfiguration());
        dto=json.readValue("{\"comprehensiveQuestionLimit\":null,\"comprehensiveTimeLimitMinutes\":0}",EnrolmentClassScheduleTaskDto.class);assertTrue(dto.hasComprehensiveConfiguration());assertNull(dto.getComprehensiveQuestionLimit());assertEquals(Integer.valueOf(0),dto.getComprehensiveTimeLimitMinutes());assertFalse(json.writeValueAsString(dto).contains("comprehensiveConfiguration"));
        EnrolmentClassScheduleTask task=new EnrolmentClassScheduleTask();task.setComprehensiveTimeLimitMinutes(0);dto=new EnrolmentClassScheduleTaskDto(task);assertFalse(dto.hasComprehensiveConfiguration());assertEquals(Integer.valueOf(0),dto.getComprehensiveTimeLimitMinutes());
        TestResultDto result=json.readValue("{\"assignmentSectionKey\":\"section_123456\"}",TestResultDto.class);assertEquals("section_123456",result.getAssignmentSectionKey());
    }
    @Test public void invalidSizesTimesDuplicateAndUnsavedQuestionsAreRejected() {
        Question source=source(passage(1,pack(1,1,1,2)));
        for(int target:new int[]{0,1,1001})try{ComprehensiveAssignmentSections.plan(source,target,10);fail();}catch(IllegalArgumentException expected){}
        for(int time:new int[]{-1,1441})try{ComprehensiveAssignmentSections.plan(source,50,time);fail();}catch(IllegalArgumentException expected){}
        Question duplicate=pack(2,1,2,2);source.getSubQuestions().iterator().next().getSubQuestions().add(duplicate);try{ComprehensiveAssignmentSections.plan(source,50,10);fail();}catch(IllegalArgumentException expected){}
        source=source(passage(1,pack(1,1,1,2)));source.getSubQuestions().iterator().next().getSubQuestions().iterator().next().getSubQuestions().iterator().next().setId(null);try{ComprehensiveAssignmentSections.plan(source,50,10);fail();}catch(IllegalArgumentException expected){}
    }
    @Test public void regroupingTheSameQuestionIdsIntoASharedEditorCannotSplitItAcrossOldSections() {
        Question independent=pack(1,1,1,100),source=source(passage(1,independent));List<ComprehensiveAssignmentSectionDto> assigned=ComprehensiveAssignmentSections.plan(source,50,30);
        assertEquals(2,assigned.size());ComprehensiveAssignmentSections.validateAgainstSource(source,assigned);Set<Long> original=ComprehensiveAssignmentSections.sourceQuestionIds(source);
        independent.setType(11);assertEquals(original,ComprehensiveAssignmentSections.sourceQuestionIds(source));
        try{ComprehensiveAssignmentSections.validateAgainstSource(source,assigned);fail("A shared editor must not span two saved sections even though all question IDs still exist");}catch(IllegalArgumentException expected){assertTrue(expected.getMessage().contains("Nhóm câu hỏi"));}
        List<ComprehensiveAssignmentSectionDto> regrouped=ComprehensiveAssignmentSections.plan(source,50,30);assertEquals(1,regrouped.size());assertEquals(100,regrouped.get(0).getQuestionCount());ComprehensiveAssignmentSections.validateAgainstSource(source,regrouped);
    }
    @Test public void eachHeadingPassageOwnsASectionEvenWhenBothWouldFitTheTarget() {
        Question source=source(passage(1,pack(1,4,1,20)),passage(2,pack(1,4,21,20)));
        List<ComprehensiveAssignmentSectionDto> sections=ComprehensiveAssignmentSections.plan(source,50,30);
        assertEquals(2,sections.size());assertEquals(20,sections.get(0).getQuestionCount());assertEquals(20,sections.get(1).getQuestionCount());
        assertEquals(Long.valueOf(1),sections.get(0).getQuestionIds().get(0));assertEquals(Long.valueOf(21),sections.get(1).getQuestionIds().get(0));
        ComprehensiveAssignmentSections.validateAgainstSource(source,sections);
        ComprehensiveAssignmentSectionDto merged=new ComprehensiveAssignmentSectionDto();merged.setKey(UUID.randomUUID().toString());merged.setNumber(1);merged.setQuestionIds(flatten(sections));merged.setDurationMinutes(30);
        try{ComprehensiveAssignmentSections.validateAgainstSource(source,Collections.singletonList(merged));fail("Two heading passages cannot share a workspace even if the saved ID union is complete");}catch(IllegalArgumentException expected){assertTrue(expected.getMessage().contains("heading"));}
    }
    @Test public void headingPassageCannotBeMergedWithAnOrdinaryTinyTailOrPrefix() {
        for(boolean headingFirst:new boolean[]{true,false}) {
            Question heading=passage(headingFirst?1:2,pack(1,4,1,20)),ordinary=passage(headingFirst?2:1,pack(1,1,21,20));
            Question source=source(heading,ordinary);List<ComprehensiveAssignmentSectionDto> sections=ComprehensiveAssignmentSections.plan(source,50,0);
            assertEquals(2,sections.size());assertEquals(20,sections.get(0).getQuestionCount());assertEquals(20,sections.get(1).getQuestionCount());
            ComprehensiveAssignmentSections.validateAgainstSource(source,sections);
            ComprehensiveAssignmentSectionDto merged=new ComprehensiveAssignmentSectionDto();merged.setKey(UUID.randomUUID().toString());merged.setNumber(1);merged.setQuestionIds(flatten(sections));
            try{ComprehensiveAssignmentSections.validateAgainstSource(source,Collections.singletonList(merged));fail("Heading passages must be isolated from other packages on either side");}catch(IllegalArgumentException expected){assertTrue(expected.getMessage().contains("heading"));}
        }
    }
}
