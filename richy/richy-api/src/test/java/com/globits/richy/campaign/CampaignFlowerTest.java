package com.globits.richy.campaign;

import java.time.*;
import java.util.*;
import javax.persistence.EntityManager;
import javax.persistence.EntityManagerFactory;
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
import com.fasterxml.jackson.databind.*;
import com.globits.core.domain.Person;
import com.globits.security.domain.User;
import com.globits.security.domain.Role;
import com.globits.security.repository.UserRepository;
import com.globits.richy.domain.*;
import com.globits.richy.dto.*;
import com.globits.richy.repository.*;
import com.globits.richy.rest.*;
import com.globits.richy.service.impl.*;

public class CampaignFlowerTest {
    private AnnotationConfigApplicationContext context;
    private CampaignFlowerService service;
    private UserRepository users;
    private CampaignFlowerAccessRepository access;
    private CampaignFlowerEntryRepository entries;
    private CampaignRepository campaigns;
    private final String tokenA = String.join("", Collections.nCopies(43, "a"));
    private final String tokenB = String.join("", Collections.nCopies(43, "b"));
    private final String key = "00000000-0000-4000-8000-000000000001";
    private User studentA, studentB;
    private Campaign campaign;
    private final Map<String, CampaignFlowerEntry> saved = new HashMap<>();
    private final String today = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).toString();
    @Configuration @EnableGlobalMethodSecurity(securedEnabled = true, proxyTargetClass = true)
    static class Config {
        @Bean public CampaignFlowerService service() { return new CampaignFlowerService(); }
        @Bean public EntityManagerFactory entityManagerFactory() {
            EntityManagerFactory factory = mock(EntityManagerFactory.class);
            when(factory.getProperties()).thenReturn(Collections.emptyMap());
            when(factory.createEntityManager()).thenReturn(mock(EntityManager.class));
            return factory;
        }
        @Bean public UserRepository users() { return mock(UserRepository.class); }
        @Bean public EnrolmentClassRepository classes() { return mock(EnrolmentClassRepository.class); }
        @Bean public CampaignRepository campaigns() { return mock(CampaignRepository.class); }
        @Bean public CampaignFlowerAccessRepository access() { return mock(CampaignFlowerAccessRepository.class); }
        @Bean public CampaignFlowerEntryRepository entries() { return mock(CampaignFlowerEntryRepository.class); }
        @Bean public RestPublicCampaignFlowerController publicController() { return new RestPublicCampaignFlowerController(); }
        @Bean public RestCampaignFlowerAccessController privateController() { return new RestCampaignFlowerAccessController(); }
    }
    @Before public void setup() {
        context = new AnnotationConfigApplicationContext(Config.class);
        service = context.getBean(CampaignFlowerService.class); users = context.getBean(UserRepository.class);
        access = context.getBean(CampaignFlowerAccessRepository.class); entries = context.getBean(CampaignFlowerEntryRepository.class);
        campaigns = context.getBean(CampaignRepository.class);
        ReflectionTestUtils.setField(service, "entityManager", mock(EntityManager.class));
        studentA = student(7L, "hs0007"); studentB = student(9L, "hs0009");
        bind(tokenA, studentA); bind(tokenB, studentB);
        EnrolmentClass clazz = new EnrolmentClass(); clazz.setName("Thiếu Nhi 1"); clazz.setSchoolId(2);
        when(context.getBean(EnrolmentClassRepository.class).findOne(12L)).thenReturn(clazz);
        campaign = new Campaign(); campaign.setId(5L); campaign.setName("Mùa hoa thiêng");
        campaign.setStartDate(LocalDate.parse(today).minusDays(2).toString()); campaign.setEndDate(LocalDate.parse(today).plusDays(10).toString());
        SpiritualFlowerItem item = new SpiritualFlowerItem(); item.setItemKey(key); item.setName("Cầu nguyện"); campaign.getFlowerItems().add(item);
        when(campaigns.findOne(5L)).thenReturn(campaign); when(campaigns.activeCampaigns(today)).thenReturn(Collections.singletonList(campaign));
        when(entries.saveAndFlush(any(CampaignFlowerEntry.class))).thenAnswer(call -> {
            CampaignFlowerEntry value = (CampaignFlowerEntry) call.getArguments()[0]; saved.put(entryKey(value.getStudentId(), value.getDate(), value.getItemKey()), value); return value;
        });
        when(entries.findByCampaignIdAndStudentIdAndDateAndItemKey(anyLong(), anyLong(), anyString(), anyString())).thenAnswer(call ->
            saved.get(entryKey((Long)call.getArguments()[1], (String)call.getArguments()[2], (String)call.getArguments()[3])));
        when(entries.findByCampaignIdAndStudentIdAndDateBetween(anyLong(), anyLong(), anyString(), anyString())).thenAnswer(call -> {
            List<CampaignFlowerEntry> result = new ArrayList<>(); Long owner = (Long)call.getArguments()[1];
            String first = (String)call.getArguments()[2], last = (String)call.getArguments()[3];
            for (CampaignFlowerEntry value : saved.values()) {
                if (owner.equals(value.getStudentId()) && value.getDate().compareTo(first) >= 0 && value.getDate().compareTo(last) <= 0) { result.add(value); }
            } return result;
        });
        when(access.saveAndFlush(any(CampaignFlowerAccess.class))).thenAnswer(call -> call.getArguments()[0]);
        SecurityContextHolder.clearContext();
    }
    @After public void cleanup() { SecurityContextHolder.clearContext(); if (context != null) { context.close(); } saved.clear(); }
    private static String entryKey(Long student, String date, String item) { return student + ":" + date + ":" + item; }
    private String addPractice() {
        String next = UUID.randomUUID().toString(); SpiritualFlowerItem item = new SpiritualFlowerItem(); item.setItemKey(next); item.setName("Tham dự Thánh lễ"); campaign.getFlowerItems().add(item); return next;
    }
    @Test public void coloringSpendsOnlyEarnedDailyCreditsAndAllowsChoosingAnyPetal() {
        String other = addPractice();
        try { service.paint(tokenA, 5L, today, other, "#F48FB1"); fail("No credit"); } catch (CampaignService.InvalidCampaignException expected) { }
        service.check(tokenA, 5L, today, key, true);
        CampaignFlowerDto.Garden garden = service.paint(tokenA, 5L, today, other, "#F48FB1");
        assertEquals(1, garden.entries.stream().filter(e -> e.paintColor != null).count());
        assertFalse(saved.get(entryKey(7L, today, other)).isCompleted());
        service.paint(tokenA, 5L, today, other, "#81D4FA");
        assertEquals("#81D4FA", saved.get(entryKey(7L, today, other)).getPaintColor());
        try { service.paint(tokenA, 5L, today, key, "#EF5350"); fail("Overspend"); } catch (CampaignService.InvalidCampaignException expected) { }
        try { service.paint(tokenB, 5L, today, other, "#EF5350"); fail("Other participant's credit"); } catch (CampaignService.InvalidCampaignException expected) { }
        assertEquals(2, service.garden(tokenA, 5L).entries.size()); assertTrue(service.garden(tokenB, 5L).entries.isEmpty());
        verify(access, atLeastOnce()).lockByTokenHash(StudentMarkShareSupport.hashToken(tokenA));
    }
    @Test public void removingCompletionRemovesExcessPaintAndResetRestoresCreditsWithoutErasingChecks() {
        String other = addPractice(); service.check(tokenA, 5L, today, key, true); service.paint(tokenA, 5L, today, other, "#EF5350");
        service.check(tokenA, 5L, today, key, false); assertNull(saved.get(entryKey(7L, today, other)).getPaintColor());
        service.check(tokenA, 5L, today, key, true); service.paint(tokenA, 5L, today, other, "#B39DDB");
        service.check(tokenB, 5L, today, key, true); service.paint(tokenB, 5L, today, key, "#80CBC4");
        CampaignFlowerDto.Garden reset = service.resetPaint(tokenA, 5L);
        assertEquals(1, reset.entries.stream().filter(e -> e.completed).count());
        assertEquals(0, reset.entries.stream().filter(e -> e.paintColor != null).count());
        assertEquals("#80CBC4", saved.get(entryKey(9L, today, key)).getPaintColor());
        service.paint(tokenA, 5L, today, key, "#FFE082");
        assertEquals("#FFE082", saved.get(entryKey(7L, today, key)).getPaintColor());
    }
    @Test public void addingAndReorderingPracticesPreservesColorByStableKey() {
        service.check(tokenA, 5L, today, key, true); service.paint(tokenA, 5L, today, key, "#FFB74D");
        addPractice(); Collections.reverse(campaign.getFlowerItems());
        assertEquals("#FFB74D", service.garden(tokenA, 5L).entries.get(0).paintColor);
        campaign.getFlowerItems().removeIf(item -> key.equals(item.getItemKey()));
        assertTrue(service.garden(tokenA, 5L).entries.isEmpty());
        try { service.paint(tokenA, 5L, today, key, "#FFB74D"); fail("Retired item"); } catch (CampaignService.InvalidCampaignException expected) { }
    }
    @Test public void previousDaysCanSpendExistingCreditButFutureInvalidDatesAndUnapprovedColorsCannot() {
        String yesterday = LocalDate.parse(today).minusDays(1).toString();
        CampaignFlowerEntry previous = new CampaignFlowerEntry(); previous.setCampaignId(5L); previous.setStudentId(7L); previous.setDate(yesterday); previous.setItemKey(key); previous.setCompleted(true);
        saved.put(entryKey(7L, yesterday, key), previous);
        service.paint(tokenA, 5L, yesterday, key, "#EF5350");
        assertEquals("#EF5350", service.garden(tokenA, 5L).entries.get(0).paintColor);
        for (String invalidDate : Arrays.asList("bad", "2026-02-30", LocalDate.parse(today).plusDays(1).toString())) {
            try { service.paint(tokenA, 5L, invalidDate, key, "#EF5350"); fail("Invalid date"); } catch (CampaignService.InvalidCampaignException expected) { }
        }
        for (String color : Arrays.asList(null, "red", "#000000", "url(javascript:alert(1))")) {
            try { service.paint(tokenA, 5L, yesterday, key, color); fail("Invalid palette"); } catch (CampaignService.InvalidCampaignException expected) { }
        }
        try { service.resetPaint("bad", 5L); fail("Invalid QR reset"); } catch (CampaignFlowerService.InvalidStudentQrException expected) { }
    }
    @Test public void gardenHttpDoesNotTrustStudentOrCreditFieldsInTheRequest() throws Exception {
        service.check(tokenA, 5L, today, key, true);
        MockMvc mvc = MockMvcBuilders.standaloneSetup(context.getBean(RestPublicCampaignFlowerController.class)).build();
        String base = "/public/campaign-flower/" + tokenA + "/campaigns/5/garden";
        mvc.perform(put(base + "/" + today + "/" + key).contentType("application/json").content("{\"color\":\"#EF5350\",\"studentId\":9,\"credits\":100}"))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store, max-age=0"));
        assertEquals("#EF5350", saved.get(entryKey(7L, today, key)).getPaintColor()); assertEquals(1, saved.size());
        mvc.perform(post(base + "/reset")).andExpect(status().isOk()); assertTrue(saved.get(entryKey(7L, today, key)).isCompleted());
        mvc.perform(get(base)).andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store, max-age=0"));
    }
    private static User student(Long id, String code) {
        User user = new User(); user.setId(id); user.setUsername(code);
        Role role = new Role(); role.setName("ROLE_STUDENT"); user.getRoles().add(role);
        Person person = new Person(); person.setPatron("Đa Minh"); person.setLastName("Nguyễn Văn"); person.setFirstName("An"); person.setPhoneNumber("private-phone");
        person.setEnrollmentClassId(12); user.setPerson(person); return user;
    }
    private void bind(String token, User student) {
        CampaignFlowerAccess value = new CampaignFlowerAccess(); value.setStudent(student); value.setToken(token); value.setTokenHash(StudentMarkShareSupport.hashToken(token));
        when(access.findByTokenHash(value.getTokenHash())).thenReturn(value); when(access.lockByTokenHash(value.getTokenHash())).thenReturn(value);
    }
    private static void identity(String role) { SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("test", "unused", Collections.singletonList(new SimpleGrantedAuthority(role)))); }
    @Test public void qrCanOnlyBeIssuedByExistingStudentManagers() {
        RestCampaignFlowerAccessController controller = context.getBean(RestCampaignFlowerAccessController.class);
        CampaignFlowerDto.AccessRequest request = new CampaignFlowerDto.AccessRequest(); request.studentCode = studentA.getUsername();
        for (String role : Arrays.asList("ROLE_STUDENT", "ROLE_USER", "ROLE_STAFF", "ROLE_VIEWER")) {
            identity(role);
            try { controller.issue(request); fail("Unauthorized QR issuance"); } catch (AccessDeniedException expected) { }
            try { service.issue(request.studentCode); fail("Unauthorized service issuance"); } catch (AccessDeniedException expected) { }
        }
        verifyZeroInteractions(users);
        when(users.findByUsernameAndPerson("hs0007")).thenReturn(studentA);
        for (String role : Arrays.asList("ROLE_ADMIN", "ROLE_EDUCATION_MANAGERMENT", "ROLE_STUDENT_MANAGERMENT")) {
            identity(role); assertTrue(StudentMarkShareSupport.validToken(controller.issue(request).getBody().token));
        }
    }
    @Test public void redisplayingQrPreservesItsExistingToken() {
        identity("ROLE_ADMIN"); when(users.findByUsernameAndPerson("hs0007")).thenReturn(studentA);
        CampaignFlowerAccess existing = new CampaignFlowerAccess(); existing.setStudent(studentA); existing.setToken(tokenA);
        when(access.findByStudentId(7L)).thenReturn(existing);
        assertEquals(tokenA, service.issue("hs0007").token); verify(access, never()).saveAndFlush(any(CampaignFlowerAccess.class));
    }
    @Test public void eachQrReadsAndWritesOnlyItsOwnStudent() throws Exception {
        service.check(tokenA, 5L, today, key, true); service.check(tokenB, 5L, today, key, false);
        CampaignFlowerDto.Sheet a = service.sheet(tokenA, 5L, 0), b = service.sheet(tokenB, 5L, 0);
        assertTrue(a.entries.get(0).completed); assertFalse(b.entries.get(0).completed); assertEquals(2, saved.size());
        service.check(tokenA, 5L, today, key, false); assertFalse(service.sheet(tokenA, 5L, 0).entries.get(0).completed); assertEquals(2, saved.size());
        assertEquals("Đa Minh", a.student.saintName); assertEquals("Nguyễn Văn An", a.student.fullName);
        assertEquals(Collections.singletonList("Thiếu Nhi 1"), a.student.classes);
        JsonNode studentJson = new ObjectMapper().valueToTree(a.student);
        assertFalse(studentJson.has("phoneNumber")); assertFalse(studentJson.has("password")); assertFalse(studentJson.has("email"));
        verify(entries, atLeastOnce()).findByCampaignIdAndStudentIdAndDateAndItemKey(5L, 7L, today, key);
    }
    @Test public void pastFutureAndNonCampaignCellsCannotBeChanged() {
        for (String day : Arrays.asList(LocalDate.parse(today).minusDays(1).toString(), LocalDate.parse(today).plusDays(1).toString(), "2026-02-30", "bad")) {
            for (boolean checked : new boolean[]{true, false}) {
                try { service.check(tokenA, 5L, day, key, checked); fail("Only today may change"); } catch (CampaignService.InvalidCampaignException expected) { }
            }
        }
        try { service.check(tokenA, 5L, today, "other-item", true); fail("Unknown practice"); } catch (CampaignService.InvalidCampaignException expected) { }
        try { service.check(tokenA, 5L, today, key, null); fail("Missing completion"); } catch (CampaignService.InvalidCampaignException expected) { }
        verify(entries, never()).saveAndFlush(any(CampaignFlowerEntry.class));
    }
    @Test public void invalidQrAndDisabledStudentsCannotReadOrWrite() {
        for (String token : Arrays.asList("hs0007", "bad", tokenA.substring(1), String.join("", Collections.nCopies(43, "z")))) {
            try { service.landing(token); fail("Invalid QR"); } catch (CampaignFlowerService.InvalidStudentQrException expected) { }
            try { service.check(token, 5L, today, key, true); fail("Invalid QR write"); } catch (CampaignFlowerService.InvalidStudentQrException expected) { }
        }
        studentA.setActive(false);
        try { service.sheet(tokenA, 5L, 0); fail("Disabled student"); } catch (CampaignFlowerService.InvalidStudentQrException expected) { }
        try { service.check(tokenA, 5L, today, key, true); fail("Disabled student write"); } catch (CampaignFlowerService.InvalidStudentQrException expected) { }
        verifyZeroInteractions(entries);
    }
    @Test public void publicHttpRequiresQrAndEnforcesTodayOnTheServer() throws Exception {
        MockMvc mvc = MockMvcBuilders.standaloneSetup(context.getBean(RestPublicCampaignFlowerController.class)).build();
        mvc.perform(get("/public/campaign-flower/hs0007")).andExpect(status().isNotFound());
        mvc.perform(get("/public/campaign-flower/" + tokenA)).andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store, max-age=0"));
        String path = "/public/campaign-flower/" + tokenA + "/campaigns/5/entries/";
        mvc.perform(put(path + today + "/" + key).contentType("application/json").content("{\"completed\":true,\"studentId\":9}")).andExpect(status().isOk());
        assertEquals(7L, saved.values().iterator().next().getStudentId().longValue());
        mvc.perform(put(path + LocalDate.parse(today).minusDays(1) + "/" + key).contentType("application/json").content("{\"completed\":false}")).andExpect(status().isBadRequest());
        mvc.perform(get("/public/campaign-flower/" + tokenA + "/campaigns/5").param("week", "-1")).andExpect(status().isBadRequest());
    }
    @Test public void printedStudentCardCanOpenItsOwnSheetWithoutLogin() throws Exception {
        when(users.findByUsernameAndPerson("hs0007")).thenReturn(studentA);
        CampaignFlowerAccess existing = new CampaignFlowerAccess(); existing.setStudent(studentA); existing.setToken(tokenA);
        when(access.findByStudentId(7L)).thenReturn(existing);
        MockMvc mvc = MockMvcBuilders.standaloneSetup(context.getBean(RestPublicCampaignFlowerController.class)).build();
        MvcResult result = mvc.perform(post("/public/campaign-flower/scan").contentType("application/json").content("{\"studentCode\":\"  hs0007  \"}"))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store, max-age=0"))
            .andReturn();
        JsonNode json = new ObjectMapper().readTree(result.getResponse().getContentAsString());
        assertEquals(tokenA, json.get("token").asText());
        assertEquals("Nguyễn Văn An", json.get("student").get("fullName").asText());
        assertEquals(tokenA, service.scan("hs0007").token);
        verify(access, never()).saveAndFlush(any(CampaignFlowerAccess.class));
    }
    @Test public void firstScanCreatesAccessAndUnknownOrInactiveCardsAreRejected() {
        when(users.findByUsernameAndPerson("hs0009")).thenReturn(studentB);
        assertTrue(StudentMarkShareSupport.validToken(service.scan("hs0009").token));
        for (String code : Arrays.asList("", "unknown", "https://example.org/card", String.join("", Collections.nCopies(101, "a")), "hs\n0009")) {
            try { service.scan(code); fail("Invalid card accepted"); } catch (CampaignFlowerService.InvalidStudentQrException expected) { }
        }
        studentB.getRoles().clear();
        assertTrue(StudentMarkShareSupport.validToken(service.scan("hs0009").token));
        studentA.setActive(false); when(users.findByUsernameAndPerson("hs0007")).thenReturn(studentA);
        try { service.scan("hs0007"); fail("Inactive student accepted"); } catch (CampaignFlowerService.InvalidStudentQrException expected) { }
    }
    @Test public void directoryCodesAllowManagersAndOtherRolesToCompleteOnlyTheirOwnFlower() {
        when(users.findByUsernameAndPerson("hs0007")).thenReturn(studentA);
        CampaignFlowerAccess existing = new CampaignFlowerAccess(); existing.setStudent(studentA); existing.setToken(tokenA);
        when(access.findByStudentId(7L)).thenReturn(existing);
        for (String roleName : Arrays.asList("ROLE_ADMIN", "ROLE_EDUCATION_MANAGERMENT", "ROLE_STUDENT_MANAGERMENT", "ROLE_STAFF", "ROLE_VIEWER", "ROLE_USER", "")) {
            studentA.getRoles().clear();
            if (!roleName.isEmpty()) { Role role = new Role(); role.setName(roleName); studentA.getRoles().add(role); }
            assertEquals(tokenA, service.scan("hs0007").token);
            assertEquals("hs0007", service.landing(tokenA).student.studentCode);
            service.check(tokenA, 5L, today, key, true);
            assertTrue(service.sheet(tokenA, 5L, 0).entries.get(0).completed);
            assertEquals(7L, saved.values().iterator().next().getStudentId().longValue());
            assertTrue(service.sheet(tokenB, 5L, 0).entries.isEmpty());
            try { service.check(tokenA, 5L, LocalDate.parse(today).minusDays(1).toString(), key, false); fail("Manager edited yesterday"); }
            catch (CampaignService.InvalidCampaignException expected) { }
        }
    }
}
