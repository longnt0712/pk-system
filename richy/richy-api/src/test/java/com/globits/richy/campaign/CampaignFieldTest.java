package com.globits.richy.campaign;

import java.sql.*;
import java.time.*;
import java.util.*;
import javax.persistence.EntityManager;
import javax.persistence.EntityManagerFactory;
import javax.persistence.Query;
import org.hibernate.Session;
import org.hibernate.SessionFactory;
import org.junit.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import org.springframework.context.annotation.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.*;
import org.springframework.security.config.annotation.method.configuration.EnableGlobalMethodSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.globits.richy.domain.*;
import com.globits.richy.dto.*;
import com.globits.richy.repository.*;
import com.globits.richy.rest.*;
import com.globits.richy.service.impl.*;
import com.globits.security.domain.Role;

/** In-memory fixtures only. No application bootstrap, datasource or production credentials. */
public class CampaignFieldTest {
    private AnnotationConfigApplicationContext context;
    private CampaignFieldService service;
    private CampaignRepository campaigns;
    private CampaignFlowerEntryRepository entries;
    private Connection db;
    private SessionFactory nativeFactory;
    private Session nativeSession;
    private Campaign campaign;
    private final List<CampaignFlowerEntry> colors=new ArrayList<>();
    private final List<String> sqlQueries=new ArrayList<>();
    private final String key="00000000-0000-4000-8000-000000000001";
    @Configuration @EnableGlobalMethodSecurity(securedEnabled=true,proxyTargetClass=true)
    static class Config {
        @Bean public CampaignFieldService service(){return new CampaignFieldService();}
        @Bean public CampaignFieldRepository field(){return new CampaignFieldRepository();}
        @Bean public EntityManagerFactory entityManagerFactory(){
            EntityManagerFactory factory=mock(EntityManagerFactory.class);
            when(factory.getProperties()).thenReturn(Collections.emptyMap());
            when(factory.createEntityManager()).thenReturn(mock(EntityManager.class));return factory;
        }
        @Bean public CampaignRepository campaigns(){return mock(CampaignRepository.class);}
        @Bean public CampaignFlowerEntryRepository entries(){return mock(CampaignFlowerEntryRepository.class);}
        @Bean public RestCampaignFieldController controller(){return new RestCampaignFieldController();}
    }
    @Before public void setup() throws Exception {
        Class.forName("org.h2.Driver");
        String databaseUrl="jdbc:h2:mem:field"+UUID.randomUUID()+";MODE=MSSQLServer";
        db=DriverManager.getConnection(databaseUrl,"sa","");
        // Exercise Hibernate's native result discovery, including duplicate alias validation.
        Properties properties=new Properties();
        properties.setProperty("hibernate.connection.driver_class","org.h2.Driver");
        properties.setProperty("hibernate.connection.url",databaseUrl);
        properties.setProperty("hibernate.connection.username","sa");
        properties.setProperty("hibernate.connection.password","");
        properties.setProperty("hibernate.dialect","org.hibernate.dialect.H2Dialect");
        nativeFactory=new org.hibernate.cfg.Configuration().setProperties(properties).buildSessionFactory();
        nativeSession=nativeFactory.openSession();
        execute("create table tbl_user(id bigint primary key,active int,account_non_locked int,account_non_expired int)");
        execute("create table tbl_person(user_id bigint,patron varchar(100),last_name varchar(100),first_name varchar(100),display_name varchar(100),class_id bigint)");
        // Use the application's actual column mapping, not the Java property name.
        String roleNameColumn=Role.class.getDeclaredField("name").getAnnotation(javax.persistence.Column.class).name();
        execute("create table tbl_role(id bigint,"+roleNameColumn+" varchar(150))");
        execute("create table tbl_user_role(user_id bigint,role_id bigint)");
        execute("create table tbl_enrolment_class(id bigint,name varchar(100),school_id int)");
        execute("create table tbl_user_enrolment_class(user_id bigint,enrolment_class_id bigint)");
        execute("create table tbl_campaign_flower_entry(campaign_id bigint,student_id bigint,entry_date varchar(10),item_key varchar(36),completed int)");
        execute("insert into tbl_role values(1,'ROLE_STUDENT'),(2,'ROLE_ADMIN'),(3,'ROLE_EDUCATION_MANAGERMENT'),(4,'ROLE_STUDENT_MANAGERMENT'),(5,'ROLE_VIEWER'),(6,'ROLE_STAFF')");
        execute("insert into tbl_enrolment_class values(12,'Thiếu 1',2),(13,'Ấu 1',2),(99,'IELTS',1)");
        participant(1,1,12,1);participant(2,1,13,1);participant(3,2,12,1);participant(4,3,12,1);participant(5,4,12,1);
        participant(6,1,99,1);participant(7,5,99,1);participant(8,1,12,0);participant(9,6,12,1);participant(10,1,null,1);
        participant(11,1,12,1);execute("insert into tbl_user_role values(11,2)");
        execute("insert into tbl_user_enrolment_class values(1,12),(1,13)");
        check(1,"2026-10-01",key,true);check(1,"2026-10-02",key,true);check(2,"2026-10-01",key,true);
        check(3,"2026-10-01",key,true);check(6,"2026-10-01",key,true);
        check(2,"2026-10-01","retired",true);check(2,"2026-10-03",key,true);
        context=new AnnotationConfigApplicationContext(Config.class);
        service=context.getBean(CampaignFieldService.class); campaigns=context.getBean(CampaignRepository.class);entries=context.getBean(CampaignFlowerEntryRepository.class);
        ReflectionTestUtils.setField(service,"clock",Clock.fixed(Instant.parse("2026-10-02T05:00:00Z"),ZoneId.of("Asia/Ho_Chi_Minh")));
        EntityManager em=mock(EntityManager.class);
        ReflectionTestUtils.setField(context.getBean(CampaignFieldRepository.class),"entityManager",em);
        when(em.createNativeQuery(anyString())).thenAnswer(call->nativeQuery((String)call.getArguments()[0]));
        campaign=new Campaign();campaign.setId(5L);campaign.setName("Cùng Mẹ, em yêu mến Chúa");campaign.setStartDate("2026-10-01");campaign.setEndDate("2026-10-31");
        SpiritualFlowerItem item=new SpiritualFlowerItem();item.setItemKey(key);item.setName("Lần hạt");campaign.getFlowerItems().add(item);
        when(campaigns.findOne(5L)).thenReturn(campaign);
        when(entries.findByCampaignIdAndStudentIdInAndDateBetween(anyLong(),anyList(),anyString(),anyString())).thenAnswer(call->{
            List<Long> ids=(List<Long>)call.getArguments()[1];String start=(String)call.getArguments()[2],end=(String)call.getArguments()[3];List<CampaignFlowerEntry> result=new ArrayList<>();
            for(CampaignFlowerEntry value:colors){if(ids.contains(value.getStudentId()) && value.getDate().compareTo(start)>=0 && value.getDate().compareTo(end)<=0){result.add(value);}}return result;
        });
        SecurityContextHolder.clearContext();
    }
    @After public void cleanup() throws Exception {SecurityContextHolder.clearContext();if(context!=null){context.close();}if(nativeSession!=null){nativeSession.close();}if(nativeFactory!=null){nativeFactory.close();}if(db!=null){db.close();}colors.clear();sqlQueries.clear();}
    private void execute(String sql) throws Exception {try(Statement s=db.createStatement()){s.execute(sql);}}
    private void participant(int id,int role,Integer classId,int active) throws Exception {
        execute("insert into tbl_user values("+id+","+active+",1,1)");
        execute("insert into tbl_person values("+id+",'Đa Minh','Nguyễn','Em "+id+"','',"+classId+")");
        execute("insert into tbl_user_role values("+id+","+role+")");
    }
    private void check(int id,String date,String item,boolean completed) throws Exception {
        execute("insert into tbl_campaign_flower_entry values(5,"+id+",'"+date+"','"+item+"',"+(completed?1:0)+")");
        CampaignFlowerEntry entry=new CampaignFlowerEntry();entry.setStudentId((long)id);entry.setCampaignId(5L);entry.setDate(date);entry.setItemKey(item);entry.setCompleted(completed);colors.add(entry);
    }
    private Query nativeQuery(String sql) {
        sqlQueries.add(sql);
        // H2 has no SQL Server collation syntax. All binding and result discovery use real Hibernate.
        return nativeSession.createNativeQuery(sql.replace(" collate Latin1_General_CI_AI",""));
    }
    private void login(String role){SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("reviewer","",Collections.singletonList(new SimpleGrantedAuthority(role))));}
    private List<Long> ids(CampaignFieldDto dto){List<Long> result=new ArrayList<>();for(CampaignFieldDto.Garden g:dto.gardens){result.add(g.id);}return result;}
    @Test public void publicListIsStudentOnlyIncludesZeroAndExcludesOtherSchoolAndMixedManagerRoles(){
        CampaignFieldDto dto=service.students(5L,null,"","",6);assertEquals(Arrays.asList(1L,2L,10L),ids(dto));assertEquals(2,dto.gardens.get(0).completedCount);assertEquals(1,dto.gardens.get(1).completedCount);assertEquals(0,dto.gardens.get(2).completedCount);
        assertEquals(Arrays.asList("Thiếu 1","Ấu 1"),dto.gardens.get(0).classes);assertEquals("Đa Minh",dto.gardens.get(0).saintName);assertEquals("Nguyễn Em 1",dto.gardens.get(0).fullName);
        login("ROLE_ADMIN");assertEquals(Arrays.asList(1L,2L,10L),ids(service.students(5L,null,"","",6)));
    }
    @Test public void privateListRequiresAdminOrEitherManager(){
        for(String role:Arrays.asList("ROLE_STUDENT","ROLE_STAFF")){login(role);try{service.managed(5L,null,"","",6);fail();}catch(AccessDeniedException expected){}}
        SecurityContextHolder.clearContext();try{service.managed(5L,null,"","",6);fail();}catch(org.springframework.security.core.AuthenticationException expected){}catch(AccessDeniedException expected){}
        for(String role:Arrays.asList("ROLE_ADMIN","ROLE_EDUCATION_MANAGERMENT","ROLE_STUDENT_MANAGERMENT")){login(role);assertTrue(ids(service.managed(5L,null,"","",12)).containsAll(Arrays.asList(3L,4L,5L,11L)));}
    }
    @Test public void classFilterSupportsMultipleClassesAndRejectsForeignClasses(){
        assertEquals(Arrays.asList(1L,2L),ids(service.students(5L,13L,"","",6)));
        try{service.students(5L,99L,"","",6);fail();}catch(CampaignService.InvalidCampaignException expected){}
    }
    @Test public void cursorIsBoundedAndReachesTheZeroCreditGarden(){
        CampaignFieldDto first=service.students(5L,null,"","",1);assertEquals(Arrays.asList(1L),ids(first));assertTrue(first.hasMore);assertEquals("2:1",first.nextCursor);
        CampaignFieldDto second=service.students(5L,null,"",first.nextCursor,1);assertEquals(Arrays.asList(2L),ids(second));
        CampaignFieldDto third=service.students(5L,null,"",second.nextCursor,1);assertEquals(Arrays.asList(10L),ids(third));assertFalse(third.hasMore);
        assertTrue(sqlQueries.stream().anyMatch(sql->sql.startsWith("select top 2 ")));
    }
    @Test public void invalidFiltersAndOtherCampaignsAreRejectedBeforeQueries(){
        for(String cursor:Arrays.asList("-1:1","1:0","1:9999999999999999999","1:1 OR 1=1")){try{service.students(5L,null,"",cursor,6);fail();}catch(CampaignService.InvalidCampaignException expected){}}
        try{service.students(5L,null,"","",100);fail();}catch(CampaignService.InvalidCampaignException expected){}
        campaign.setName("Other");try{service.students(5L,null,"","",6);fail();}catch(CampaignService.InvalidCampaignException expected){}
        assertTrue(sqlQueries.isEmpty());
    }
    @Test public void searchIsBoundAndWildcardCharactersAreLiteral(){
        assertEquals(Arrays.asList(1L,10L),ids(service.students(5L,null,"Em 1","",6)));
        assertTrue(service.students(5L,null,"%' OR 1=1 --","",6).gardens.isEmpty());
        assertTrue(sqlQueries.get(sqlQueries.size()-1).contains("like :search escape"));assertFalse(sqlQueries.get(sqlQueries.size()-1).contains("OR 1=1 --"));
    }
    @Test public void publicColorReadCapsPaintToCurrentDailyCreditsAndNeverWrites() throws Exception {
        String secondKey="00000000-0000-4000-8000-000000000002";
        SpiritualFlowerItem second=new SpiritualFlowerItem();second.setItemKey(secondKey);second.setName("Thánh lễ");campaign.getFlowerItems().add(second);
        check(1,"2026-10-01",secondKey,false);colors.get(colors.size()-1).setPaintColor("#80CBC4");
        colors.get(0).setPaintColor("#F48FB1");colors.get(3).setPaintColor("#EF5350");
        CampaignFlowerEntry retired=new CampaignFlowerEntry();retired.setStudentId(1L);retired.setDate("2026-10-01");retired.setItemKey("retired");retired.setCompleted(false);retired.setPaintColor("#80CBC4");colors.add(retired);
        CampaignFieldDto dto=service.students(5L,null,"","",6);assertEquals(1,dto.gardens.get(0).colors.size());assertEquals(key,dto.gardens.get(0).colors.get(0).itemKey);
        verify(entries,never()).save(any(CampaignFlowerEntry.class));verify(entries,never()).saveAndFlush(any(CampaignFlowerEntry.class));
    }
    @Test public void publicHttpIgnoresRoleOverrideAndSerializesNoCredentialFields() throws Exception {
        login("ROLE_ADMIN");MockMvc mvc=MockMvcBuilders.standaloneSetup(context.getBean(RestCampaignFieldController.class)).build();
        MvcResult response=mvc.perform(get("/public/campaigns/5/field").param("includeManagers","true")).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store, max-age=0")).andReturn();
        String json=response.getResponse().getContentAsString();assertFalse(json.contains("\"id\":3,"));assertFalse(json.contains("token"));assertFalse(json.contains("username"));assertFalse(json.contains("email"));
        mvc.perform(post("/public/campaigns/5/field")).andExpect(status().isMethodNotAllowed());
    }
}
