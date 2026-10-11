package com.globits.richy.attendance;

import com.globits.richy.domain.PersonDate;
import com.globits.richy.dto.AttendanceConfigDto;
import com.globits.richy.dto.PersonDateDto;
import com.globits.richy.repository.PersonDateRepository;
import com.globits.richy.service.AttendanceConfigService;
import com.globits.richy.service.impl.PersonDateServiceImpl;
import com.globits.security.domain.User;
import com.globits.security.dto.UserDto;
import java.util.Arrays;
import java.util.TimeZone;
import org.joda.time.DateTime;
import org.joda.time.DateTimeUtils;
import org.joda.time.DateTimeZone;
import org.joda.time.LocalDateTime;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class PersonDateQrAttendanceTest {
    private PersonDateServiceImpl service;
    private PersonDateRepository repository;
    private AttendanceConfigDto config;
    private PersonDate row;
    private DateTimeZone originalJodaZone;
    private TimeZone originalJavaZone;

    @Before public void setup() {
        originalJodaZone = DateTimeZone.getDefault(); originalJavaZone = TimeZone.getDefault();
        DateTimeZone.setDefault(DateTimeZone.UTC); TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
        service = new PersonDateServiceImpl();
        repository = mock(PersonDateRepository.class);
        ReflectionTestUtils.setField(service, "personDateRepository", repository);
        AttendanceConfigService settings = mock(AttendanceConfigService.class);
        ReflectionTestUtils.setField(service, "attendanceConfigService", settings);
        config = new AttendanceConfigDto(null);
        when(settings.getConfig()).thenAnswer(call -> config);
        row = new PersonDate(); row.setId(7L); row.setSchoolId(2);
        row.setCreateDate(new LocalDateTime(2026, 10, 11, 0, 0)); row.setStatusMass(2); row.setStatusClass(2); row.setExtraClass(2);
        User user = new User(); user.setId(10L); user.setUsername("HS001"); row.setUser(user);
        when(repository.findForQrByUserDateAndSchool(anyString(), anyInt(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(Arrays.asList(row));
        when(repository.save(any(PersonDate.class))).thenAnswer(call -> call.getArguments()[0]);
        when(repository.getOne(7L)).thenReturn(row);
        at("08:00:00");
    }

    @After public void cleanup() {
        DateTimeUtils.setCurrentMillisSystem(); DateTimeZone.setDefault(originalJodaZone); TimeZone.setDefault(originalJavaZone);
    }

    private void at(String vietnamTime) {
        DateTimeUtils.setCurrentMillisFixed(DateTime.parse("2026-10-11T" + vietnamTime + "+07:00").getMillis());
    }

    private PersonDateDto request(int type, int status) {
        PersonDateDto dto = new PersonDateDto(); dto.setSchoolId(2);
        UserDto user = new UserDto(); user.setUsername("HS001"); dto.setUser(user);
        if (type == 1) dto.setStatusMass(status);
        if (type == 2) dto.setStatusClass(status);
        if (type == 3) dto.setExtraClass(status);
        return dto;
    }

    private PersonDateDto scan(int type) { return service.saveByQr(request(type, 1), "2026-10-11"); }

    private void rejectScan(int type) {
        try { scan(type); fail("QR must be closed for this type"); }
        catch (IllegalArgumentException expected) { verify(repository, never()).save(any(PersonDate.class)); }
    }

    @Test public void massIsOnTimeBeforeFiveMinutesEvenWhenServerUsesUtc() {
        at("08:04:59"); PersonDateDto saved = scan(1);
        assertEquals(Integer.valueOf(1), saved.getStatusMass());
        assertEquals(new LocalDateTime(2026, 10, 11, 8, 4, 59), row.getTimeGoToChurch());
        assertEquals(DateTimeUtils.currentTimeMillis(), saved.getTimeGoToChurch().getTime());
        assertEquals(Integer.valueOf(2), row.getStatusClass());
        assertNull(row.getTimeGoToClass());
    }

    @Test public void massIsLateAtExactlyFiveMinutes() {
        at("08:05:00"); assertEquals(Integer.valueOf(3), scan(1).getStatusMass());
        at("08:59:59"); assertEquals(Integer.valueOf(3), scan(1).getStatusMass());
    }

    @Test public void massQrClosesAtExactlyNine() { at("09:00:00"); rejectScan(1); }
    @Test public void classAndExtraQrAreClosedUntilNine() { at("08:59:59"); rejectScan(2); rejectScan(3); }

    @Test public void classAndExtraQrOpenAtExactlyNineWithNoGap() {
        at("09:00:00"); assertEquals(Integer.valueOf(1), scan(2).getStatusClass());
        assertEquals(Integer.valueOf(1), scan(3).getExtraClass());
        assertEquals(Integer.valueOf(2), row.getStatusMass());
    }

    @Test public void classRemainsPresentAfterGraceAndAtEndOfLessonWhenAutomaticLateIsOff() {
        at("11:45:00"); assertEquals(Integer.valueOf(1), scan(2).getStatusClass());
    }

    @Test public void enabledClassLateStartsAtExactlyTheConfiguredGraceBoundary() {
        config.setClassAutoLate(true); at("09:14:59"); assertEquals(Integer.valueOf(1), scan(2).getStatusClass());
        row.setStatusClass(2); row.setTimeGoToClass(null);
        at("09:15:00"); assertEquals(Integer.valueOf(3), scan(2).getStatusClass());
        assertEquals(Integer.valueOf(1), scan(3).getExtraClass());
    }

    @Test public void editedHoursAndSwitchTimeAreUsedOnTheNextScan() {
        config.setMassStartTime("07:30"); config.setMassLateMinutes(10); config.setQrSwitchTime("09:20");
        at("07:40:00"); assertEquals(Integer.valueOf(3), scan(1).getStatusMass());
        at("09:20:00"); rejectScanAfterEarlierSave(1);
        assertEquals(Integer.valueOf(1), scan(2).getStatusClass());
    }

    private void rejectScanAfterEarlierSave(int type) {
        try { scan(type); fail("QR must be closed"); } catch (IllegalArgumentException expected) { }
    }

    @Test public void repeatedQrKeepsFirstAttendanceTimeStatusAndTeacherCorrections() {
        at("08:04:00"); scan(1); LocalDateTime firstTime = row.getTimeGoToChurch();
        at("08:30:00"); config.setMassLateMinutes(0); scan(1);
        assertEquals(Integer.valueOf(1), row.getStatusMass()); assertEquals(firstTime, row.getTimeGoToChurch());
        PersonDateDto manual = request(1, 3); manual.setId(7L);
        service.saveObject(manual); LocalDateTime correctedTime = row.getTimeGoToChurch();
        at("08:40:00"); scan(1);
        assertEquals(Integer.valueOf(3), row.getStatusMass()); assertEquals(correctedTime, row.getTimeGoToChurch());
    }

    @Test public void manualAttendanceDoesNotUseQrTimeOrAutomaticLateRules() {
        at("12:00:00");
        PersonDateDto manual = request(1, 1); manual.setId(7L); service.saveObject(manual);
        assertEquals(Integer.valueOf(1), row.getStatusMass());
        manual = request(2, 3); manual.setId(7L); service.saveObject(manual);
        assertEquals(Integer.valueOf(3), row.getStatusClass());
        manual = request(2, 1); manual.setId(7L); service.saveObject(manual);
        assertEquals(Integer.valueOf(1), row.getStatusClass());
        manual = request(1, 2); manual.setId(7L); service.saveObject(manual);
        assertNull(row.getTimeGoToChurch());
    }

    @Test public void clientsCannotChooseTheirOwnStatusOrMultipleQrTypes() {
        PersonDateDto invalid = request(1, 3);
        try { service.saveByQr(invalid, "2026-10-11"); fail("Server calculates late"); } catch (IllegalArgumentException expected) { }
        invalid = request(1, 1); invalid.setStatusClass(1);
        try { service.saveByQr(invalid, "2026-10-11"); fail("Choose one QR type"); } catch (IllegalArgumentException expected) { }
        verify(repository, never()).save(any(PersonDate.class));
    }
}
