package com.globits.richy.campaign;

import java.util.*;
import org.junit.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import org.springframework.context.annotation.*;
import org.springframework.data.domain.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.method.configuration.EnableGlobalMethodSecurity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.globits.richy.domain.Campaign;
import com.globits.richy.dto.CampaignDto;
import com.globits.richy.repository.CampaignRepository;
import com.globits.richy.rest.*;
import com.globits.richy.service.impl.CampaignService;

/** Exercises the actual method-security proxies, validation and public HTTP mappings. */
public class CampaignTest {
    private AnnotationConfigApplicationContext context;
    private CampaignRepository repository;
    private CampaignService service;
    private RestCampaignController controller;
    private RestPublicCampaignController publicController;

    @Configuration
    @EnableGlobalMethodSecurity(securedEnabled = true, proxyTargetClass = true)
    static class Config {
        @Bean public CampaignRepository repository() { return mock(CampaignRepository.class); }
        @Bean public CampaignService service() { return new CampaignService(); }
        @Bean public RestCampaignController controller() { return new RestCampaignController(); }
        @Bean public RestPublicCampaignController publicController() { return new RestPublicCampaignController(); }
    }
    @Before public void setup() {
        context = new AnnotationConfigApplicationContext(Config.class);
        repository = context.getBean(CampaignRepository.class);
        service = context.getBean(CampaignService.class);
        controller = context.getBean(RestCampaignController.class);
        publicController = context.getBean(RestPublicCampaignController.class);
        when(repository.saveAndFlush(any(Campaign.class))).thenAnswer(call -> {
            Campaign value = (Campaign) call.getArguments()[0];
            value.setId(5L); ReflectionTestUtils.setField(value, "version", 0L); return value;
        });
    }
    @After public void cleanup() { SecurityContextHolder.clearContext(); context.close(); }
    private static void identity(String... roles) {
        List<SimpleGrantedAuthority> authorities = new ArrayList<>();
        for (String role : roles) { authorities.add(new SimpleGrantedAuthority(role)); }
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("test", "unused", authorities));
    }
    private static CampaignDto dto() {
        CampaignDto dto = new CampaignDto();
        dto.setName("Chiến dịch thử nghiệm"); dto.setTheme("Hoa thiêng");
        dto.setStartDate("2026-12-28"); dto.setEndDate("2027-01-03");
        CampaignDto.FlowerItemDto item = new CampaignDto.FlowerItemDto(); item.setName("Cầu nguyện"); item.setInstructions("Đọc kinh mỗi ngày");
        dto.setFlowerItems(Collections.singletonList(item)); return dto;
    }
    private static void denied(Runnable write) {
        try { write.run(); fail("Write should require Admin or Education Management"); }
        catch (AccessDeniedException | AuthenticationCredentialsNotFoundException expected) { }
    }
    @Test public void otherRolesCannotWrite() {
        for (String role : Arrays.asList("ROLE_USER", "ROLE_VIEWER", "ROLE_STUDENT", "ROLE_STAFF", "ROLE_STUDENT_MANAGERMENT")) {
            identity(role);
            denied(() -> controller.create(dto()));
            denied(() -> controller.update(5L, dto()));
            denied(() -> controller.delete(5L));
            denied(() -> service.create(dto()));
            denied(() -> service.update(5L, dto()));
            denied(() -> service.delete(5L));
        }
        verifyZeroInteractions(repository);
    }
    @Test public void anonymousCannotWrite() {
        SecurityContextHolder.clearContext();
        denied(() -> controller.create(dto())); denied(() -> controller.update(5L, dto())); denied(() -> controller.delete(5L));
        verifyZeroInteractions(repository);
    }
    @Test public void educationManagerCanCreateUpdateAndDelete() {
        identity("ROLE_EDUCATION_MANAGERMENT");
        assertCanCreateUpdateAndDelete();
    }
    @Test public void adminAloneCanCreateUpdateAndDelete() {
        identity("ROLE_ADMIN");
        assertCanCreateUpdateAndDelete();
    }
    private void assertCanCreateUpdateAndDelete() {
        CampaignDto created = controller.create(dto());
        assertEquals("Đọc kinh mỗi ngày", created.getFlowerItems().get(0).getInstructions());
        Campaign saved = new Campaign(); saved.setId(5L); ReflectionTestUtils.setField(saved, "version", 0L);
        when(repository.findOne(5L)).thenReturn(saved);
        CampaignDto update = dto(); update.setVersion(0L); update.setName("Đã sửa");
        assertEquals("Đã sửa", controller.update(5L, update).getName());
        controller.delete(5L); verify(repository).delete(saved);
    }
    @Test public void invalidDatesAndMissingFlowerItemsNeverPersist() {
        identity("ROLE_EDUCATION_MANAGERMENT");
        for (String end : Arrays.asList("2026-12-27", "2027-02-30", "bad", "2027-2-01", "0000-01-01")) {
            CampaignDto value = dto(); value.setEndDate(end);
            try { service.create(value); fail("Invalid calendar date"); } catch (CampaignService.InvalidCampaignException expected) { }
        }
        CampaignDto value = dto(); value.setFlowerItems(Collections.emptyList());
        try { service.create(value); fail("Missing spiritual flower"); } catch (CampaignService.InvalidCampaignException expected) { }
        value = dto(); value.getFlowerItems().get(0).setName("   ");
        try { service.create(value); fail("Blank practice"); } catch (CampaignService.InvalidCampaignException expected) { }
        verify(repository, never()).saveAndFlush(any(Campaign.class));
    }
    @Test public void staleEditCannotOverwriteNewerCampaign() {
        identity("ROLE_EDUCATION_MANAGERMENT");
        Campaign saved = new Campaign(); saved.setId(5L); ReflectionTestUtils.setField(saved, "version", 2L);
        when(repository.findOne(5L)).thenReturn(saved);
        CampaignDto old = dto(); old.setVersion(1L);
        try { controller.update(5L, old); fail("Stale update"); } catch (CampaignService.CampaignConflictException expected) { }
        verify(repository, never()).saveAndFlush(any(Campaign.class));
    }
    @Test public void missingCampaignReturnsNotFoundRatherThanCreatingAnother() {
        identity("ROLE_EDUCATION_MANAGERMENT");
        try { service.update(999L, dto()); fail("Missing campaign"); } catch (CampaignService.CampaignNotFoundException expected) { }
        try { service.get(999L); fail("Missing campaign"); } catch (CampaignService.CampaignNotFoundException expected) { }
        verify(repository, never()).saveAndFlush(any(Campaign.class));
    }
    @Test public void publicHttpRoutesAreAnonymousAndReadOnly() throws Exception {
        SecurityContextHolder.clearContext();
        Campaign value = new Campaign(); value.setId(5L); value.setName("Chiến dịch công khai");
        value.setStartDate("2026-12-28"); value.setEndDate("2027-01-03");
        when(repository.findOne(5L)).thenReturn(value);
        when(repository.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(Collections.singletonList(value)));
        MockMvc mvc = MockMvcBuilders.standaloneSetup(publicController).build();
        mvc.perform(get("/public/campaigns")).andExpect(status().isOk());
        mvc.perform(get("/public/campaigns/5")).andExpect(status().isOk());
        mvc.perform(get("/public/campaigns/999")).andExpect(status().isNotFound());
        mvc.perform(post("/public/campaigns").contentType("application/json").content("{}")).andExpect(status().isMethodNotAllowed());
        mvc.perform(put("/public/campaigns/5").contentType("application/json").content("{}")).andExpect(status().isMethodNotAllowed());
        mvc.perform(delete("/public/campaigns/5")).andExpect(status().isMethodNotAllowed());
        verify(repository, never()).saveAndFlush(any(Campaign.class)); verify(repository, never()).delete(any(Campaign.class));
    }
    @Test public void boundedPaginationAndSearch() {
        when(repository.search(anyString(), any(Pageable.class))).thenReturn(new PageImpl<Campaign>(Collections.emptyList()));
        service.list("  MÙA CHAY  ", 2, 12);
        verify(repository).search(eq("%mùa chay%"), any(Pageable.class));
        for (int size : new int[]{0, -1, 51}) {
            try { service.list("", 1, size); fail("Invalid page size"); } catch (CampaignService.InvalidCampaignException expected) { }
        }
    }
}
