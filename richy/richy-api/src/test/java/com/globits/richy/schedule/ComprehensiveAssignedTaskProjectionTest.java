package com.globits.richy.schedule;

import com.globits.richy.dto.*;
import com.globits.richy.repository.TestResultRepository;
import com.globits.richy.service.impl.EnrolmentClassServiceImpl;
import java.util.*;
import org.joda.time.LocalDateTime;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

/** Exercises the same projection that produces the student's separate assignment cards. */
public class ComprehensiveAssignedTaskProjectionTest {
    private EnrolmentClassScheduleTaskDto task(int required){
        EnrolmentClassScheduleTaskDto task=new EnrolmentClassScheduleTaskDto();task.setId(10L);task.setTitle("200 questions");task.setActivityType("COMPREHENSIVE");task.setIeltsTestId(20L);task.setIeltsTestTitle("Original test");task.setRequiredAttempts(required);
        List<ComprehensiveAssignmentSectionDto> sections=new ArrayList<ComprehensiveAssignmentSectionDto>();for(int part=1;part<=4;part++){ComprehensiveAssignmentSectionDto section=new ComprehensiveAssignmentSectionDto();section.setKey("section-000"+part);section.setNumber(part);section.setFirstOrdinal((part-1)*50+1);section.setLastOrdinal(part*50);section.setDurationMinutes(part==2?0:30);List<Long> ids=new ArrayList<Long>();for(long id=(part-1)*50+1;id<=part*50;id++)ids.add(id);section.setQuestionIds(ids);sections.add(section);}task.setComprehensiveSections(sections);return task;
    }
    private List<StudentAssignedTaskDto> project(EnrolmentClassScheduleTaskDto task,int...counts){
        EnrolmentClassServiceImpl service=new EnrolmentClassServiceImpl();TestResultRepository results=mock(TestResultRepository.class);ReflectionTestUtils.setField(service,"testResultRepository",results);
        LocalDateTime start=LocalDateTime.now().minusDays(1),end=start.plusDays(3);for(int i=0;i<counts.length;i++)when(results.countComprehensiveSectionAssignmentAttempts(7L,10L,20L,"section-000"+(i+1),start,end)).thenReturn((long)counts[i]);
        List<StudentAssignedTaskDto> out=new ArrayList<StudentAssignedTaskDto>();ReflectionTestUtils.invokeMethod(service,"appendComprehensiveSectionAssignments",out,task,7L,1L,"Class","2026-10-29",start,end);return out;
    }
    @Test public void completedSectionStaysVisibleBesideThreeUnfinishedSectionsAndTaskProgressIs25(){
        List<StudentAssignedTaskDto> cards=project(task(1),1,0,0,0);assertEquals(4,cards.size());Set<String> keys=new HashSet<String>();
        for(StudentAssignedTaskDto card:cards){assertEquals(Long.valueOf(10),card.getTaskId());assertEquals(25,card.getTaskProgressPercent());assertEquals(Integer.valueOf(50),card.getSectionQuestionCount());keys.add(card.getAssignmentSectionKey());}assertEquals(4,keys.size());assertEquals(0,cards.get(0).getRemainingAttempts());assertEquals(1,cards.get(1).getRemainingAttempts());assertEquals(Integer.valueOf(0),cards.get(1).getComprehensiveTimeLimitMinutes());assertEquals(Integer.valueOf(51),cards.get(1).getSectionFirstOrdinal());
    }
    @Test public void repeatedPassesAreCappedPerSectionAndAllSectionsCompleteHidesTheTask(){
        List<StudentAssignedTaskDto> cards=project(task(2),9,2,1,0);assertEquals(4,cards.size());assertEquals(63,cards.get(0).getTaskProgressPercent());assertEquals(2,cards.get(0).getCompletedAttempts());assertEquals(1,cards.get(2).getRemainingAttempts());assertTrue(project(task(1),9,3,2,1).isEmpty());
    }
    @Test public void teacherManualDoneKeepsExistingPrecedence(){
        EnrolmentClassScheduleTaskDto task=task(1);EnrolmentClassTaskProgressDto done=new EnrolmentClassTaskProgressDto();done.setStudentUserId(7L);done.setStatus("DONE");done.setAutomatic(false);task.getStudentProgress().add(done);assertTrue(project(task,0,0,0,0).isEmpty());
    }
}
