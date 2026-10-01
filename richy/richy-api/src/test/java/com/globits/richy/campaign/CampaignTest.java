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
import com.globits.richy.repository.CampaignFlowerEntryRepository;
import com.globits.richy.rest.*;
import com.globits.richy.service.impl.CampaignService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

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
        @Bean public CampaignFlowerEntryRepository entryRepository() { return mock(CampaignFlowerEntryRepository.class); }
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
    @Test public void imageLinksPersistAndCanBeCleared() {
        identity("ROLE_ADMIN");
        CampaignDto value = dto();
        value.setDesktopLeftImageUrl(" https://example.org/left.jpg ");
        value.setDesktopRightImageUrl("https://example.org/right.jpg?size=large");
        value.setMobileImageUrl("https://example.org/banner.jpg");
        CampaignDto created = controller.create(value);
        assertEquals("https://example.org/left.jpg", created.getDesktopLeftImageUrl());
        assertEquals(value.getDesktopRightImageUrl(), created.getDesktopRightImageUrl());
        assertEquals(value.getMobileImageUrl(), created.getMobileImageUrl());
        Campaign saved = new Campaign(); saved.setId(5L); ReflectionTestUtils.setField(saved, "version", 0L);
        saved.setDesktopLeftImageUrl(created.getDesktopLeftImageUrl());
        saved.setDesktopRightImageUrl(created.getDesktopRightImageUrl()); saved.setMobileImageUrl(created.getMobileImageUrl());
        when(repository.findOne(5L)).thenReturn(saved);
        value.setVersion(0L); value.setDesktopLeftImageUrl(null); value.setDesktopRightImageUrl("   ");
        value.setMobileImageUrl("https://example.org/new-banner.jpg");
        CampaignDto updated = controller.update(5L, value);
        assertNull(updated.getDesktopLeftImageUrl()); assertNull(updated.getDesktopRightImageUrl());
        assertEquals("https://example.org/new-banner.jpg", updated.getMobileImageUrl());
    }
    @Test public void invalidImageLinksNeverPersist() {
        identity("ROLE_EDUCATION_MANAGERMENT");
        List<String> invalid = Arrays.asList("javascript:alert(1)", "data:image/svg+xml,test", "//example.org/image.jpg",
                "ftp://example.org/image.jpg", "https://user:password@example.org/image.jpg", "bad link",
                "https://example.org/" + String.join("", Collections.nCopies(2048, "a")));
        for (String link : invalid) {
            for (int field = 0; field < 3; field++) {
                CampaignDto value = dto();
                if (field == 0) { value.setDesktopLeftImageUrl(link); }
                if (field == 1) { value.setDesktopRightImageUrl(link); }
                if (field == 2) { value.setMobileImageUrl(link); }
                try { service.create(value); fail("Invalid image URL"); } catch (CampaignService.InvalidCampaignException expected) { }
            }
        }
        verify(repository, never()).saveAndFlush(any(Campaign.class));
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
        value.setDesktopLeftImageUrl("https://example.org/left.jpg");
        value.setDesktopRightImageUrl("https://example.org/right.jpg"); value.setMobileImageUrl("https://example.org/banner.jpg");
        when(repository.findOne(5L)).thenReturn(value);
        when(repository.findAll(any(Pageable.class))).thenReturn(new PageImpl<>(Collections.singletonList(value)));
        MockMvc mvc = MockMvcBuilders.standaloneSetup(publicController).build();
        mvc.perform(get("/public/campaigns")).andExpect(status().isOk());
        byte[] response = mvc.perform(get("/public/campaigns/5")).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        JsonNode json = new ObjectMapper().readTree(response);
        assertEquals("https://example.org/left.jpg", json.get("desktopLeftImageUrl").asText());
        assertEquals("https://example.org/right.jpg", json.get("desktopRightImageUrl").asText());
        assertEquals("https://example.org/banner.jpg", json.get("mobileImageUrl").asText());
        mvc.perform(get("/public/campaigns/999")).andExpect(status().isNotFound());
        mvc.perform(post("/public/campaigns").contentType("application/json").content("{}")).andExpect(status().isMethodNotAllowed());
        mvc.perform(put("/public/campaigns/5").contentType("application/json").content("{}")).andExpect(status().isMethodNotAllowed());
        mvc.perform(delete("/public/campaigns/5")).andExpect(status().isMethodNotAllowed());
        verify(repository, never()).saveAndFlush(any(Campaign.class)); verify(repository, never()).delete(any(Campaign.class));
    }
    @Test public void backgroundsPersistTheirOpacityAndRejectOutOfRangeValues() {
        identity("ROLE_EDUCATION_MANAGERMENT");
        CampaignDto value = dto(); value.setMobileImageUrl("https://example.org/background.jpg");
        assertEquals(Integer.valueOf(20), controller.create(value).getFlowerBackgroundOpacity());
        for (int opacity : new int[]{0, 45, 100}) {
            value.setFlowerBackgroundOpacity(opacity);
            assertEquals(Integer.valueOf(opacity), controller.create(value).getFlowerBackgroundOpacity());
        }
        reset(repository);
        for (int opacity : new int[]{-1, 101}) {
            value.setFlowerBackgroundOpacity(opacity);
            try { controller.create(value); fail("Invalid opacity"); } catch (CampaignService.InvalidCampaignException expected) { }
        }
        verify(repository, never()).saveAndFlush(any(Campaign.class));
    }
    @Test public void newestCreatedCampaignsComeFirstInListingsAndSearch() {
        when(repository.findAll(any(Pageable.class))).thenReturn(new PageImpl<Campaign>(Collections.emptyList()));
        when(repository.search(anyString(), any(Pageable.class))).thenReturn(new PageImpl<Campaign>(Collections.emptyList()));
        service.list("", 1, 12); service.list("Mân Côi", 2, 12);
        org.mockito.ArgumentCaptor<Pageable> pages = org.mockito.ArgumentCaptor.forClass(Pageable.class);
        verify(repository).findAll(pages.capture()); verify(repository).search(anyString(), pages.capture());
        for (Pageable page : pages.getAllValues()) {
            assertEquals(Sort.Direction.DESC, page.getSort().getOrderFor("createDate").getDirection());
            assertEquals(Sort.Direction.DESC, page.getSort().getOrderFor("id").getDirection());
            assertNull(page.getSort().getOrderFor("startDate"));
        }
    }
    @Test public void boundedPaginationAndSearch() {
        when(repository.search(anyString(), any(Pageable.class))).thenReturn(new PageImpl<Campaign>(Collections.emptyList()));
        service.list("  MÙA CHAY  ", 2, 12);
        verify(repository).search(eq("%mùa chay%"), any(Pageable.class));
        for (int size : new int[]{0, -1, 51}) {
            try { service.list("", 1, size); fail("Invalid page size"); } catch (CampaignService.InvalidCampaignException expected) { }
        }
    }
    @Test public void opaqueShareCodesAreStableAndResolveOnlyTheirOwnCampaign() throws Exception {
        identity("ROLE_ADMIN");
        CampaignDto first = controller.create(dto());
        CampaignDto second = controller.create(dto());
        assertTrue(first.getShareCode().matches("[a-f0-9]{32}"));
        assertNotEquals(first.getShareCode(), second.getShareCode());
        org.mockito.ArgumentCaptor<Campaign> values = org.mockito.ArgumentCaptor.forClass(Campaign.class);
        verify(repository, times(2)).saveAndFlush(values.capture());
        Campaign saved = values.getAllValues().get(0);
        assertEquals(first.getShareCode(), new CampaignDto(saved, true).getShareCode());
        when(repository.findByUuidKey(saved.getUuidKey())).thenReturn(saved);
        SecurityContextHolder.clearContext();
        MockMvc mvc = MockMvcBuilders.standaloneSetup(publicController).build();
        JsonNode json = new ObjectMapper().readTree(mvc.perform(get("/public/campaigns/by-code/" + first.getShareCode()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray());
        assertEquals(first.getShareCode(), json.get("shareCode").asText());
        for (String invalid : Arrays.asList("1", "abc", "ffffffffffffffffffffffffffffffff", first.getShareCode().toUpperCase(Locale.ROOT))) {
            mvc.perform(get("/public/campaigns/by-code/" + invalid)).andExpect(status().isNotFound());
        }
        identity("ROLE_ADMIN");
        ReflectionTestUtils.setField(saved, "version", 0L); when(repository.findOne(5L)).thenReturn(saved);
        CampaignDto update = dto(); update.setVersion(0L); update.setName("Đổi tên chiến dịch");
        assertEquals(first.getShareCode(), controller.update(5L, update).getShareCode());
    }
    @Test public void legacyCampaignsReceiveShareKeysOnlyOnceAtStartup() {
        Campaign legacy = new Campaign(); legacy.setUuidKey(null); legacy.setId(7L);
        when(repository.missingShareKeys()).thenReturn(Collections.singletonList(legacy));
        service.initializeShareKeys(); assertNotNull(legacy.getUuidKey());
        UUID stable = legacy.getUuidKey(); verify(repository).saveAndFlush(legacy);
        when(repository.missingShareKeys()).thenReturn(Collections.emptyList());
        service.initializeShareKeys(); assertEquals(stable, legacy.getUuidKey());
        verify(repository, times(1)).saveAndFlush(legacy);
    }

    @Test public void cropSettingsPersistForAllImagesAndLegacyCampaignsDefaultToUncropped() {
        identity("ROLE_EDUCATION_MANAGERMENT");
        assertTrue(new CampaignDto(new Campaign(), false).getImageCrops().isEmpty());
        CampaignDto value = dto(); Map<String, CampaignDto.ImageCropDto> crops = new LinkedHashMap<>();
        for (String field : Arrays.asList("desktopLeftImageUrl", "desktopRightImageUrl", "mobileImageUrl")) {
            CampaignDto.ImageCropDto crop = new CampaignDto.ImageCropDto(); crop.setZoom(175); crop.setX(-15); crop.setY(25); crops.put(field,crop);
        }
        value.setImageCrops(crops);CampaignDto saved = controller.create(value);
        assertEquals(3,saved.getImageCrops().size());assertEquals(Integer.valueOf(175),saved.getImageCrops().get("mobileImageUrl").getZoom());
        assertEquals(Integer.valueOf(-15),saved.getImageCrops().get("desktopLeftImageUrl").getX());assertEquals(Integer.valueOf(25),saved.getImageCrops().get("desktopRightImageUrl").getY());
    }
    @Test public void invalidCropSettingsNeverPersist() {
        identity("ROLE_ADMIN"); CampaignDto value = dto();
        CampaignDto.ImageCropDto crop = new CampaignDto.ImageCropDto(); value.setImageCrops(Collections.singletonMap("mobileImageUrl",crop));
        for (int zoom : new int[]{49,301}) {crop.setZoom(zoom);try{controller.create(value);fail("Invalid zoom");}catch(CampaignService.InvalidCampaignException expected){}}
        crop.setZoom(100);for(int x : new int[]{-101,101,Integer.MIN_VALUE}){crop.setX(x);try{controller.create(value);fail("Invalid position");}catch(CampaignService.InvalidCampaignException expected){}}
        crop.setX(0);crop.setY(101);try{controller.create(value);fail("Invalid vertical position");}catch(CampaignService.InvalidCampaignException expected){}
        crop.setY(0);value.setImageCrops(Collections.singletonMap("unknownField",crop));try{controller.create(value);fail("Unknown image");}catch(CampaignService.InvalidCampaignException expected){}
        value.setImageCrops(Collections.singletonMap("mobileImageUrl",null));try{controller.create(value);fail("Missing crop settings");}catch(CampaignService.InvalidCampaignException expected){}
        verify(repository,never()).saveAndFlush(any(Campaign.class));
    }

}
