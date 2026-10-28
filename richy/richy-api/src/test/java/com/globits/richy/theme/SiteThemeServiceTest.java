package com.globits.richy.theme;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.globits.richy.domain.SiteTheme;
import com.globits.richy.dto.SiteThemeDto;
import com.globits.richy.repository.SiteThemeRepository;
import com.globits.richy.rest.RestSiteThemeController;
import com.globits.richy.service.impl.SiteThemeServiceImpl;
import java.util.Collections;
import javax.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.annotation.Secured;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

public class SiteThemeServiceTest {
    private SiteThemeServiceImpl service;
    private SiteThemeRepository repository;
    private SiteTheme stored;

    @Before public void setup() {
        SecurityContextHolder.clearContext();
        service = new SiteThemeServiceImpl();
        repository = mock(SiteThemeRepository.class);
        ReflectionTestUtils.setField(service, "repository", repository);
        when(repository.findOne("ieltsroom.com")).thenAnswer(call -> stored);
        when(repository.saveAndFlush(any(SiteTheme.class))).thenAnswer(call -> {
            stored = (SiteTheme) call.getArguments()[0];
            return stored;
        });
    }

    @After public void cleanup() { SecurityContextHolder.clearContext(); }

    private void role(String role) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "theme.admin", "unused", Collections.singletonList(new SimpleGrantedAuthority(role))));
    }

    @Test public void publicDefaultIsHalloweenAndReadingNeverCreatesAConfiguration() throws Exception {
        assertEquals("HALLOWEEN", service.getIeltsRoomTheme().getTheme());
        assertEquals("{\"theme\":\"HALLOWEEN\"}", new ObjectMapper().writeValueAsString(service.getIeltsRoomTheme()));
        verify(repository, never()).saveAndFlush(any(SiteTheme.class));
    }

    @Test public void adminSelectionIsSharedAcrossServiceInstancesAndJsonRoundTrips() throws Exception {
        role("ROLE_ADMIN");
        ObjectMapper mapper = new ObjectMapper();
        SiteThemeDto config = mapper.readValue("{\"theme\":\"NORMAL\"}", SiteThemeDto.class);
        assertEquals("NORMAL", service.saveIeltsRoomTheme(config).getTheme());
        assertEquals("ieltsroom.com", stored.getDomainName());
        assertEquals("theme.admin", stored.getModifiedBy());
        assertNotNull(stored.getModifyDate());
        SiteThemeServiceImpl otherDevice = new SiteThemeServiceImpl();
        ReflectionTestUtils.setField(otherDevice, "repository", repository);
        SecurityContextHolder.clearContext();
        assertEquals("NORMAL", otherDevice.getIeltsRoomTheme().getTheme());
        role("ROLE_ADMIN");
        assertEquals("HALLOWEEN", service.saveIeltsRoomTheme(new SiteThemeDto("HALLOWEEN")).getTheme());
        assertEquals("HALLOWEEN", otherDevice.getIeltsRoomTheme().getTheme());
    }

    @Test public void onlyAnAuthenticatedAdminCanWriteEvenWhenServiceIsInvokedDirectly() {
        for (String userRole : new String[] {"ROLE_VIEWER", "ROLE_USER", "ROLE_STAFF", "ROLE_FAIR_PLAY", "ROLE_admin"}) {
            role(userRole);
            try { service.saveIeltsRoomTheme(new SiteThemeDto("NORMAL")); fail("Non-admin write accepted"); }
            catch (AccessDeniedException expected) { }
        }
        SecurityContextHolder.clearContext();
        try { service.saveIeltsRoomTheme(new SiteThemeDto("NORMAL")); fail("Anonymous write accepted"); }
        catch (AccessDeniedException expected) { }
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("admin", "unused"));
        try { service.saveIeltsRoomTheme(new SiteThemeDto("NORMAL")); fail("Unauthenticated write accepted"); }
        catch (AccessDeniedException expected) { }
        verifyZeroInteractions(repository);
    }

    @Test public void invalidOrMissingValuesCannotChangeTheSavedSelection() {
        role("ROLE_ADMIN");
        for (String theme : new String[] {null, "", "halloween", " HALLOWEEN ", "CHRISTMAS", "NORMAL<script>"}) {
            try { service.saveIeltsRoomTheme(new SiteThemeDto(theme)); fail("Invalid theme accepted"); }
            catch (IllegalArgumentException expected) { }
        }
        try { service.saveIeltsRoomTheme(null); fail("Missing config accepted"); }
        catch (IllegalArgumentException expected) { }
        verifyZeroInteractions(repository);
    }

    @Test public void publicEndpointIsAnonymousUncachedAndPublishesOnlyTheSharedTheme() throws Exception {
        RestSiteThemeController controller = new RestSiteThemeController();
        ReflectionTestUtils.setField(controller, "service", service);
        MockMvc mvc = MockMvcBuilders.standaloneSetup(controller).build();
        mvc.perform(get("/public/site-theme/ieltsroom"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store, no-cache, must-revalidate"))
                .andExpect(header().string("Pragma", "no-cache"))
                .andExpect(content().string("{\"theme\":\"HALLOWEEN\"}"));
        mvc.perform(get("/public/site-theme/chapter")).andExpect(status().isNotFound());
        mvc.perform(put("/public/site-theme/ieltsroom").contentType("application/json").content("{\"theme\":\"NORMAL\"}"))
                .andExpect(status().isMethodNotAllowed());
        verify(repository, never()).saveAndFlush(any(SiteTheme.class));
    }

    @Test public void saveEndpointIsAdminOnlyAndRejectsInvalidPayloadWith400() throws Exception {
        assertNull(RestSiteThemeController.class.getMethod("getIeltsRoomTheme").getAnnotation(Secured.class));
        assertArrayEquals(new String[] {"ROLE_ADMIN"}, RestSiteThemeController.class
                .getMethod("saveIeltsRoomTheme", SiteThemeDto.class).getAnnotation(Secured.class).value());
        assertArrayEquals(new String[] {"ROLE_ADMIN"}, SiteThemeServiceImpl.class
                .getMethod("saveIeltsRoomTheme", SiteThemeDto.class).getAnnotation(Secured.class).value());
        role("ROLE_ADMIN");
        RestSiteThemeController controller = new RestSiteThemeController();
        ReflectionTestUtils.setField(controller, "service", service);
        MockMvc mvc = MockMvcBuilders.standaloneSetup(controller).build();
        mvc.perform(put("/api/site-theme/ieltsroom").contentType("application/json").content("{\"theme\":\"NORMAL\"}"))
                .andExpect(status().isOk()).andExpect(content().string("{\"theme\":\"NORMAL\"}"));
        mvc.perform(put("/api/site-theme/ieltsroom").contentType("application/json").content("{\"theme\":\"INVALID\"}"))
                .andExpect(status().isBadRequest());
        assertEquals("NORMAL", stored.getTheme());
        ResponseEntity<?> conflict = controller.concurrentThemeChange(new DataIntegrityViolationException("duplicate singleton"));
        assertEquals(HttpStatus.CONFLICT, conflict.getStatusCode());
    }

    @Test public void savedThemeSurvivesARealHibernateCommitAndASeparateDatabaseSession() {
        role("ROLE_ADMIN");
        Configuration mapping = new Configuration()
                .setProperty("hibernate.connection.driver_class", "org.h2.Driver")
                .setProperty("hibernate.connection.url", "jdbc:h2:mem:site_theme;MODE=MSSQLServer")
                .setProperty("hibernate.dialect", "org.hibernate.dialect.H2Dialect")
                .setProperty("hibernate.hbm2ddl.auto", "create-drop")
                .addAnnotatedClass(SiteTheme.class);
        try (SessionFactory factory = mapping.buildSessionFactory()) {
            EntityManager writer = factory.createEntityManager();
            try {
                writer.getTransaction().begin();
                when(repository.findOne("ieltsroom.com")).thenAnswer(call -> writer.find(SiteTheme.class, "ieltsroom.com"));
                when(repository.saveAndFlush(any(SiteTheme.class))).thenAnswer(call -> {
                    SiteTheme saved = writer.merge((SiteTheme) call.getArguments()[0]); writer.flush(); return saved;
                });
                service.saveIeltsRoomTheme(new SiteThemeDto("NORMAL"));
                writer.getTransaction().commit();
                EntityManager reader = factory.createEntityManager();
                try {
                    SiteTheme reloaded = reader.find(SiteTheme.class, "ieltsroom.com");
                    assertEquals("NORMAL", reloaded.getTheme());
                    assertEquals("theme.admin", reloaded.getModifiedBy());
                    assertNotNull(reloaded.getModifyDate());
                    assertNotNull(reloaded.getRevision());
                    assertEquals(1L, reader.createQuery("select count(t) from SiteTheme t", Long.class).getSingleResult().longValue());
                } finally { reader.close(); }
            } finally {
                if (writer.getTransaction().isActive()) { writer.getTransaction().rollback(); }
                writer.close();
            }
        }
    }
}
