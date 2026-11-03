package com.globits.richy.result;

import com.globits.richy.domain.TestResult;
import com.globits.richy.dto.TestResultDto;
import com.globits.richy.repository.TestResultRepository;
import com.globits.richy.service.impl.TestResultServiceImpl;
import com.globits.security.domain.*;
import com.globits.security.dto.UserDto;
import com.globits.security.repository.UserRepository;
import java.util.*;
import javax.persistence.*;
import org.joda.time.LocalDateTime;
import org.junit.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class TestResultVisibilityTimingTest {
    private TestResultServiceImpl service;private User reader,other;private EntityManager em;private Query query,count;private TestResultRepository results;
    private User user(long id,String...roles){User user=new User();user.setId(id);user.setUsername("user"+id);Set<Role> values=new HashSet<>();for(String name:roles){Role r=new Role();r.setName(name);values.add(r);}user.setRoles(values);return user;}
    @Before public void setup(){
        reader=user(7,"ROLE_VIEWER","ROLE_USER");other=user(8,"ROLE_VIEWER");
        service=new TestResultServiceImpl();UserRepository users=mock(UserRepository.class);when(users.findByUsername("user7")).thenAnswer(i->reader);
        em=mock(EntityManager.class);query=mock(TypedQuery.class);count=mock(Query.class);results=mock(TestResultRepository.class);
        when(em.createQuery(anyString(),eq(TestResultDto.class))).thenReturn((TypedQuery)query);when(em.createQuery(anyString())).thenReturn(count);
        when(query.getResultList()).thenReturn(Collections.emptyList());when(count.getResultList()).thenReturn(Collections.emptyList());when(count.getSingleResult()).thenReturn(0L);
        ReflectionTestUtils.setField(service,"manager",em);ReflectionTestUtils.setField(service,"userRepository",users);ReflectionTestUtils.setField(service,"testResultRepository",results);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("user7","",Collections.emptyList()));
    }
    @After public void clear(){SecurityContextHolder.clearContext();}
    @Test public void learnerCannotForgeAnotherStudentOrRemoveUserFilter(){
        for(UserDto target:new UserDto[]{null,new UserDto(other)}){TestResultDto search=new TestResultDto();search.setUser(target);service.getPageObject(search,1,15);assertEquals(reader.getId(),search.getUser().getId());}
        verify(query,times(2)).setParameter("userId",7L);verify(count,times(2)).setParameter("userId",7L);
    }
    @Test public void calendarAlsoUsesAuthoritativeLearner(){TestResultDto search=new TestResultDto();search.setUser(new UserDto(other));service.getStudyCalendar(search);verify(count).setParameter("userId",7L);}
    @Test public void staffCanStillUseStudentFilter(){reader=user(7,"ROLE_STAFF");TestResultDto search=new TestResultDto();search.setUser(new UserDto(other));service.getPageObject(search,1,15);verify(query).setParameter("userId",8L);}
    @Test public void directForeignResultIsDeniedBeforeDtoDetails(){TestResult row=new TestResult();row.setId(91L);row.setUser(other);when(results.findOne(91L)).thenReturn(row);try{service.getObjectById(91L);fail("foreign result");}catch(AccessDeniedException expected){assertNotNull(expected.getMessage());}}
    private TestResult row(Integer elapsed,String remaining,String state){TestResult row=new TestResult();row.setId(91L);row.setCreateDate(LocalDateTime.now());row.setTestType(7);row.setIeltsSessionMode("SERIOUS");row.setActiveDurationSeconds(elapsed);row.setTestTime(remaining);row.setIeltsLearningState(state);return row;}
    @Test public void legacyCountdownIsConvertedOnlyWhenElapsedEvidenceExists(){
        assertEquals("20:06 / 60:00",new TestResultDto(row(1206,"39:54",null)).getTestTimeDisplay());
        assertEquals("— / Chưa rõ",new TestResultDto(row(null,"59:58",null)).getTestTimeDisplay());
        TestResult ambiguous=row(1206,"20:06",null);ambiguous.setTestType(6);assertEquals("20:06 / Chưa rõ",new TestResultDto(ambiguous).getTestTimeDisplay());
    }
    @Test public void newSnapshotPreservesExactBudgetAndOvertime(){
        TestResult row=row(4500,"75:00","{\"timing\":{\"elapsedSeconds\":4500,\"limitSeconds\":1200,\"untimed\":false}}");
        assertEquals("75:00 / 20:00",new TestResultDto(row).getTestTimeDisplay());
        assertEquals("75:00 / 20:00",new TestResultDto(row,true).getTestTimeDisplay());
    }
    @Test public void untimedAndLegacyStudyNeverInventATimeLimit(){
        TestResult row=row(1206,"20:06","{\"timing\":{\"elapsedSeconds\":1206,\"limitSeconds\":null,\"untimed\":true}}");
        assertEquals("20:06 / Không giới hạn",new TestResultDto(row).getTestTimeDisplay());
        row.setIeltsLearningState(null);row.setIeltsSessionMode("STUDY");assertEquals("20:06 / Không giới hạn",new TestResultDto(row).getTestTimeDisplay());
    }
}
