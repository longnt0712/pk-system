package com.globits.richy.attendance;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.globits.richy.domain.AttendanceConfig;
import com.globits.richy.dto.AttendanceConfigDto;
import com.globits.richy.repository.AttendanceConfigRepository;
import com.globits.richy.rest.RestPersonDateController;
import com.globits.richy.service.impl.AttendanceConfigServiceImpl;
import javax.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.Before;
import org.junit.Test;
import org.springframework.security.access.annotation.Secured;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class AttendanceConfigServiceTest {
    private AttendanceConfigServiceImpl service;
    private AttendanceConfigRepository repository;
    private AttendanceConfig stored;

    @Before public void setup() {
        service = new AttendanceConfigServiceImpl();
        repository = mock(AttendanceConfigRepository.class);
        ReflectionTestUtils.setField(service, "repository", repository);
        when(repository.findOne(1)).thenAnswer(call -> stored);
        when(repository.save(any(AttendanceConfig.class))).thenAnswer(call -> {
            stored = (AttendanceConfig) call.getArguments()[0];
            return stored;
        });
    }

    @Test public void defaultScheduleAndSwitchesMatchTheAgreedRules() {
        AttendanceConfigDto config = service.getConfig();
        assertEquals("08:00", config.getMassStartTime());
        assertEquals(Integer.valueOf(5), config.getMassLateMinutes());
        assertTrue(config.getMassAutoLate());
        assertEquals("09:00", config.getClassStartTime());
        assertEquals(Integer.valueOf(15), config.getClassLateMinutes());
        assertFalse(config.getClassAutoLate());
        assertEquals("09:00", config.getQrSwitchTime());
        verify(repository, never()).save(any(AttendanceConfig.class));
    }

    @Test public void editedScheduleSurvivesReloadAndJsonRoundTrip() throws Exception {
        AttendanceConfigDto config = service.getConfig();
        config.setMassStartTime("07:30"); config.setMassLateMinutes(10); config.setMassAutoLate(false);
        config.setClassStartTime("09:15"); config.setClassLateMinutes(20); config.setClassAutoLate(true);
        config.setQrSwitchTime("09:05");
        ObjectMapper mapper = new ObjectMapper();
        service.saveConfig(mapper.readValue(mapper.writeValueAsString(config), AttendanceConfigDto.class));
        assertEquals(Integer.valueOf(1), stored.getId());
        assertNotNull(stored.getModifyDate());
        assertEquals(mapper.writeValueAsString(config), mapper.writeValueAsString(service.getConfig()));
        AttendanceConfigServiceImpl anotherDevice = new AttendanceConfigServiceImpl();
        ReflectionTestUtils.setField(anotherDevice, "repository", repository);
        assertEquals("07:30", anotherDevice.getConfig().getMassStartTime());
        assertTrue(anotherDevice.getConfig().getClassAutoLate());
    }

    private void reject(AttendanceConfigDto config) {
        try { service.saveConfig(config); fail("Invalid schedule must be rejected"); }
        catch (IllegalArgumentException expected) { verify(repository, never()).save(any(AttendanceConfig.class)); }
    }

    @Test public void invalidOrIncompleteTimesAndMinutesAreRejectedBeforeChangingTheDatabase() {
        AttendanceConfigDto config = service.getConfig(); config.setMassStartTime("24:00"); reject(config);
        config = service.getConfig(); config.setClassStartTime("9:00"); reject(config);
        config = service.getConfig(); config.setClassLateMinutes(-1); reject(config);
        config = service.getConfig(); config.setMassLateMinutes(1440); reject(config);
        config = service.getConfig(); config.setMassAutoLate(null); reject(config);
        reject(new AttendanceConfigDto());
        reject(null);
    }

    @Test public void impossibleLateAndSwitchBoundariesAreRejected() {
        AttendanceConfigDto config = service.getConfig(); config.setQrSwitchTime("08:00"); reject(config);
        config = service.getConfig(); config.setMassLateMinutes(60); reject(config);
        config = service.getConfig(); config.setClassStartTime("23:50"); reject(config);
    }

    @Test public void teachersCanReadButOnlyManagersCanWriteTheSharedSchedule() throws Exception {
        String[] readRoles = RestPersonDateController.class.getMethod("getAttendanceConfig").getAnnotation(Secured.class).value();
        String[] writeRoles = RestPersonDateController.class.getMethod("saveAttendanceConfig", AttendanceConfigDto.class).getAnnotation(Secured.class).value();
        assertArrayEquals(new String[] {"ROLE_ADMIN", "ROLE_STUDENT_MANAGERMENT", "ROLE_EDUCATION_MANAGERMENT"}, readRoles);
        assertArrayEquals(new String[] {"ROLE_ADMIN", "ROLE_EDUCATION_MANAGERMENT"}, writeRoles);
    }

    @Test public void sharedSchedulePersistsUsingTheRealHibernateEntityMapping() {
        Configuration mapping = new Configuration()
                .setProperty("hibernate.connection.driver_class", "org.h2.Driver")
                .setProperty("hibernate.connection.url", "jdbc:h2:mem:attendance_config;MODE=MSSQLServer")
                .setProperty("hibernate.dialect", "org.hibernate.dialect.H2Dialect")
                .setProperty("hibernate.hbm2ddl.auto", "create-drop")
                .addAnnotatedClass(AttendanceConfig.class);
        try (SessionFactory factory = mapping.buildSessionFactory()) {
            EntityManager manager = factory.createEntityManager();
            try {
                manager.getTransaction().begin();
                when(repository.findOne(1)).thenAnswer(call -> manager.find(AttendanceConfig.class, 1));
                when(repository.save(any(AttendanceConfig.class))).thenAnswer(call -> manager.merge(call.getArguments()[0]));
                AttendanceConfigDto draft = service.getConfig();
                draft.setClassAutoLate(true); draft.setMassStartTime("07:45"); draft.setClassLateMinutes(20);
                service.saveConfig(draft);
                manager.getTransaction().commit(); manager.clear();
                AttendanceConfigDto reloaded = service.getConfig();
                assertEquals("07:45", reloaded.getMassStartTime());
                assertTrue(reloaded.getClassAutoLate());
                assertEquals(Integer.valueOf(20), reloaded.getClassLateMinutes());
                assertNotNull(manager.find(AttendanceConfig.class, 1).getModifyDate());
                assertEquals(1L, manager.createQuery("select count(c) from AttendanceConfig c", Long.class).getSingleResult().longValue());
            } finally {
                if (manager.getTransaction().isActive()) manager.getTransaction().rollback();
                manager.close();
            }
        }
    }
}
