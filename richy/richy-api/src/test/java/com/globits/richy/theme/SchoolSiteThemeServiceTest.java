package com.globits.richy.theme;

import com.globits.richy.domain.School;
import com.globits.richy.dto.*;
import com.globits.richy.service.SiteThemeService;
import com.globits.richy.service.impl.*;
import java.util.*;
import javax.persistence.*;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class SchoolSiteThemeServiceTest {
    private SchoolSiteThemeService service;
    private EntityManager em;
    private SchoolAccess access;
    private SiteThemeService legacy;
    private Map<Long,School> rows;
    private String domain;
    @Before public void setup() {
        service = new SchoolSiteThemeService(); em = mock(EntityManager.class);
        access = mock(SchoolAccess.class); legacy = mock(SiteThemeService.class);
        ReflectionTestUtils.setField(service,"em",em);
        ReflectionTestUtils.setField(service,"access",access);
        ReflectionTestUtils.setField(service,"legacy",legacy);
        when(access.isAdmin()).thenReturn(true);
        when(legacy.getIeltsRoomTheme()).thenReturn(new SiteThemeDto("HALLOWEEN"));
        rows = new LinkedHashMap<>();
        for (int i=1;i<=3;i++) {
            School school = new School(); school.setId((long)i); school.setName("School "+i);
            school.setDomain(i==1?"ieltsroom.com":i==2?"tnttphungkhoang.com":"academy.example");
            rows.put((long)i,school);
        }
        TypedQuery<School> current = mock(TypedQuery.class), list = mock(TypedQuery.class);
        when(em.createQuery(contains("s.domain=:domain"),eq(School.class))).thenReturn(current);
        when(em.createQuery(contains("order by s.id"),eq(School.class))).thenReturn(list);
        when(current.setParameter(eq("domain"),any())).thenAnswer(call->{domain=(String)call.getArguments()[1];return current;});
        when(current.getResultList()).thenAnswer(call->{
            List<School> found=new ArrayList<>();
            for(School school:rows.values())if(school.getDomain().equals(domain))found.add(school);
            return found;
        });
        when(list.getResultList()).thenAnswer(call->{
            List<School> found=new ArrayList<>();for(School school:rows.values())if(school.isActive())found.add(school);return found;
        });
        when(em.find(eq(School.class),any(),eq(LockModeType.PESSIMISTIC_WRITE))).thenAnswer(call->rows.get(call.getArguments()[1]));
    }
    @Test public void publicDomainResolutionIsExactUsesSchoolIdentityAndPreservesLegacyChoice() {
        assertEquals("HALLOWEEN",service.forDomain("www.IELTSROOM.com").getTheme());
        assertEquals(Long.valueOf(1),service.forDomain("ieltsroom.com").schoolId);
        assertEquals("NORMAL",service.forDomain("tnttphungkhoang.com").getTheme());
        assertFalse(service.forDomain("ieltsroom.com.evil.example").configured);
        assertEquals("NORMAL",service.forDomain("ieltsroom.com.evil.example").getTheme());
        rows.get(2L).setActive(false);
        assertFalse(service.forDomain("tnttphungkhoang.com").configured);
        rows.get(1L).setActive(false);
        assertFalse(service.forDomain("ieltsroom.com").configured);
        assertEquals("NORMAL",service.forDomain("ieltsroom.com").getTheme());
        rows.get(3L).setSiteTheme("CHRISTMAS");rows.get(3L).setDomain("new-school.example");
        assertEquals("CHRISTMAS",service.forDomain("new-school.example").getTheme());
        assertFalse(service.forDomain("academy.example").configured);
        try {service.forDomain("https://ieltsroom.com/");fail();}catch(IllegalArgumentException expected){}
    }
    @Test public void oneBatchChangesOnlySelectedSchoolsAndKeepsOldIeltsClientsConsistent() {
        List<SchoolSiteThemeDto> result=service.save("CHRISTMAS",Arrays.asList(3L,2L,2L));
        assertEquals(2,result.size()); assertEquals(Long.valueOf(2),result.get(0).schoolId);
        assertNull(rows.get(1L).getSiteTheme());
        assertEquals("CHRISTMAS",service.forDomain("tnttphungkhoang.com").getTheme());
        assertEquals("CHRISTMAS",service.forDomain("academy.example").getTheme());
        verify(legacy,never()).saveIeltsRoomTheme(any());
        service.save("NORMAL",Arrays.asList(1L));
        org.mockito.ArgumentCaptor<SiteThemeDto> choice=org.mockito.ArgumentCaptor.forClass(SiteThemeDto.class);
        verify(legacy).saveIeltsRoomTheme(choice.capture());assertEquals("NORMAL",choice.getValue().getTheme());
        assertEquals("CHRISTMAS",rows.get(2L).getSiteTheme());
    }
    @Test public void forgedInactiveOrMissingTargetsNeverProducePartialUpdates() {
        rows.get(3L).setActive(false);
        for(List<Long> ids:Arrays.asList(Arrays.asList(2L,999L),Arrays.asList(2L,3L),Arrays.asList(0L),Arrays.asList(-1L),Arrays.asList((Long)null),Collections.<Long>emptyList())){
            try{service.save("CHRISTMAS",ids);fail("Invalid batch accepted");}catch(IllegalArgumentException expected){}
            assertNull(rows.get(2L).getSiteTheme());
        }
        try{service.save("christmas",Arrays.asList(2L));fail();}catch(IllegalArgumentException expected){}
        verify(em,never()).flush();verify(legacy,never()).saveIeltsRoomTheme(any());
    }
    @Test public void onlyAdminCanListOrWriteSchoolConfigurationEvenViaDirectServiceCalls() {
        when(access.isAdmin()).thenReturn(false);
        try{service.list();fail();}catch(AccessDeniedException expected){}
        try{service.save("CHRISTMAS",Arrays.asList(2L));fail();}catch(AccessDeniedException expected){}
        verifyZeroInteractions(em);
    }
    @Test public void aSchoolThemeSurvivesCommitAndANewHibernateSession() {
        Configuration mapping=new Configuration().setProperty("hibernate.connection.driver_class","org.h2.Driver")
                .setProperty("hibernate.connection.url","jdbc:h2:mem:school_theme;MODE=MSSQLServer")
                .setProperty("hibernate.dialect","org.hibernate.dialect.H2Dialect")
                .setProperty("hibernate.hbm2ddl.auto","create-drop").addAnnotatedClass(School.class);
        try(SessionFactory factory=mapping.buildSessionFactory()){
            EntityManager writer=factory.createEntityManager();Long id;
            try{writer.getTransaction().begin();School school=new School();school.setName("New school");school.setDomain("school.example");school.setSiteTheme("CHRISTMAS");writer.persist(school);writer.getTransaction().commit();id=school.getId();}finally{writer.close();}
            EntityManager reader=factory.createEntityManager();
            try{assertEquals("CHRISTMAS",reader.find(School.class,id).getSiteTheme());}finally{reader.close();}
        }
    }
}
