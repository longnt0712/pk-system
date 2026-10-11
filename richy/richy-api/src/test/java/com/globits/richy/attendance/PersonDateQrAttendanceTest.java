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
        at("08:04:00"); assertFalse(scan(1).getQrAlreadyRecorded());
        LocalDateTime firstTime = row.getTimeGoToChurch(), firstModified = row.getModifyDate();
        String firstModifiedBy = row.getModifiedBy();
        at("08:30:00"); config.setMassLateMinutes(0); assertTrue(scan(1).getQrAlreadyRecorded());
        assertEquals(Integer.valueOf(1), row.getStatusMass()); assertEquals(firstTime, row.getTimeGoToChurch());
        assertEquals(firstModified, row.getModifyDate()); assertEquals(firstModifiedBy, row.getModifiedBy());
        verify(repository, times(1)).save(any(PersonDate.class));
        PersonDateDto manual = request(1, 3); manual.setId(7L);
        service.saveObject(manual); LocalDateTime correctedTime = row.getTimeGoToChurch();
        at("08:40:00"); assertTrue(scan(1).getQrAlreadyRecorded());
        assertEquals(Integer.valueOf(3), row.getStatusMass()); assertEquals(correctedTime, row.getTimeGoToChurch());
        verify(repository, times(2)).save(any(PersonDate.class));
    }

    @Test public void duplicateNoticeIsSpecificToTheSelectedAttendanceType() {
        at("08:00:00"); assertFalse(scan(1).getQrAlreadyRecorded());
        at("09:00:00"); assertFalse(scan(2).getQrAlreadyRecorded());
        assertFalse(scan(3).getQrAlreadyRecorded());
        LocalDateTime firstClassTime = row.getTimeGoToClass(), firstExtraTime = row.getTimeGoToExtraClass();
        at("09:30:00"); assertTrue(scan(2).getQrAlreadyRecorded());
        assertTrue(scan(3).getQrAlreadyRecorded());
        assertEquals(firstClassTime, row.getTimeGoToClass()); assertEquals(firstExtraTime, row.getTimeGoToExtraClass());
        verify(repository, times(3)).save(any(PersonDate.class));
    }

    @Test public void lateAndChoirAttendanceAreReportedAsAlreadyRecorded() {
        config.setClassAutoLate(true);
        at("09:15:00"); assertFalse(scan(2).getQrAlreadyRecorded());
        at("10:00:00"); PersonDateDto repeated = scan(2);
        assertTrue(repeated.getQrAlreadyRecorded()); assertEquals(Integer.valueOf(3), repeated.getStatusClass());
        assertEquals(new LocalDateTime(2026, 10, 11, 9, 15), row.getTimeGoToClass());
        at("08:00:00"); PersonDateDto choir = request(1, 5); choir.setId(7L); service.saveObject(choir);
        LocalDateTime choirTime = row.getTimeGoToChurch();
        at("08:40:00"); repeated = scan(1);
        assertTrue(repeated.getQrAlreadyRecorded()); assertEquals(Integer.valueOf(5), repeated.getStatusMass());
        assertEquals(choirTime, row.getTimeGoToChurch());
        verify(repository, times(2)).save(any(PersonDate.class));
    }

    @Test public void cancelledAttendanceCanBeScannedAgainAsANewAttendance() {
        at("08:00:00"); scan(1);
        PersonDateDto cancel = request(1, 2); cancel.setId(7L); service.saveObject(cancel);
        at("08:30:00"); PersonDateDto saved = scan(1);
        assertFalse(saved.getQrAlreadyRecorded()); assertEquals(Integer.valueOf(3), saved.getStatusMass());
        assertEquals(new LocalDateTime(2026, 10, 11, 8, 30), row.getTimeGoToChurch());
    }

    @Test public void duplicateFlagIsCalculatedByTheServerAndIncludedInTheQrJsonResponse() throws Exception {
        PersonDateDto dto = request(1, 1); dto.setQrAlreadyRecorded(true);
        assertFalse(service.saveByQr(dto, "2026-10-11").getQrAlreadyRecorded());
        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        assertTrue(mapper.readTree(mapper.writeValueAsString(scan(1))).get("qrAlreadyRecorded").asBoolean());
        assertFalse(mapper.readTree(mapper.writeValueAsString(new PersonDateDto(row))).has("qrAlreadyRecorded"));
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
