package com.globits.richy.teaching;

import java.lang.reflect.Proxy;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.Before;
import org.junit.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.globits.richy.dto.TeachingPdfSession;
import com.globits.richy.rest.RestTeachingPdfController;
import com.globits.richy.service.EnrolmentClassScheduleException;
import com.globits.richy.service.EnrolmentClassService;
import com.globits.richy.service.impl.TeachingPdfService;

import static org.junit.Assert.*;

public class TeachingPdfServiceTest {
    private TeachingPdfService pdf;
    private Long owner = 7L;
    private final ObjectMapper json = new ObjectMapper();

    @Before
    public void setup() {
        DriverManagerDataSource source = new DriverManagerDataSource(
                "jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MSSQLServer;DB_CLOSE_DELAY=-1", "sa", "");
        source.setDriverClassName("org.h2.Driver");
        JdbcTemplate jdbc = new JdbcTemplate(source);
        jdbc.execute("CREATE SCHEMA dbo");
        jdbc.execute("CREATE TABLE dbo.tbl_class_teaching_pdf (id VARCHAR(36) PRIMARY KEY, owner_id BIGINT, name NVARCHAR(255), content VARBINARY(MAX))");
        jdbc.execute("CREATE TABLE dbo.tbl_class_teaching_pdf_run (id VARCHAR(36) PRIMARY KEY, class_id BIGINT, "
                + "pdf_id VARCHAR(36), revision INT NOT NULL DEFAULT 0, completed BIT NOT NULL DEFAULT 0, progress NVARCHAR(MAX))");
        jdbc.execute("CREATE TABLE dbo.tbl_class_teaching_pdf_day (day_id BIGINT, run_id VARCHAR(36), PRIMARY KEY(day_id, run_id))");
        EnrolmentClassService classes = (EnrolmentClassService) Proxy.newProxyInstance(getClass().getClassLoader(),
                new Class<?>[] {EnrolmentClassService.class}, (proxy, method, args) -> {
                    Long classId = (Long) args[0];
                    if (classId > 2) { throw new AccessDeniedException("Different class"); }
                    boolean next = "2026-11-06".equals(args[1]);
                    long day = classId * 10;
                    return new TeachingPdfSession(owner, next ? day + 1 : day, next ? day : null);
                });
        pdf = new TeachingPdfService(source, classes);
    }

    private String upload() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "Lesson.pdf", "application/pdf",
                "%PDF-1.7".getBytes(StandardCharsets.US_ASCII));
        return pdf.upload(1L, "2026-11-04", file).get("id");
    }

    private JsonNode state(int revision, int page, boolean completed) throws Exception {
        return json.readTree("{\"revision\":" + revision + ",\"completed\":" + completed
                + ",\"state\":{\"page\":" + page + ",\"marks\":[{\"page\":" + page + ",\"note\":\"private note\"}]}}");
    }

    @Test
    public void contentEndpointWritesRawPdfBytesAndDisablesCaching() throws Exception {
        String run = pdf.attach(1L, "2026-11-04", upload(), null).get("id");
        MockHttpServletResponse response = new MockHttpServletResponse();
        new RestTeachingPdfController(pdf).content(1L, "2026-11-04", run, response);

        assertEquals("application/pdf", response.getContentType());
        assertEquals("private, no-store", response.getHeader("Cache-Control"));
        assertArrayEquals("%PDF-1.7".getBytes(StandardCharsets.US_ASCII), response.getContentAsByteArray());
    }

    private int previous(Long classId) {
        return ((List<?>) pdf.list(classId, "2026-11-06").get("previous")).size();
    }

    @Test
    public void samePdfKeepsSeparateProgressByClassAndCarriesForwardWithinItsOwnClass() throws Exception {
        String document = upload();
        String first = pdf.attach(1L, "2026-11-04", document, null).get("id");
        String second = pdf.attach(2L, "2026-11-04", document, null).get("id");
        assertNotEquals(first, second);
        pdf.save(1L, "2026-11-04", first, state(0, 5, false));
        assertNull(pdf.open(2L, "2026-11-04", second).get("progress"));
        assertEquals(1, previous(1L));
        assertEquals(first, pdf.attach(1L, "2026-11-06", null, first).get("id"));
        assertEquals(5, json.readTree((String) pdf.open(1L, "2026-11-06", first).get("progress")).path("page").asInt());
        try {
            pdf.attach(2L, "2026-11-06", null, first);
            fail("A run from a different class must be rejected");
        } catch (EnrolmentClassScheduleException e) { assertEquals(HttpStatus.CONFLICT, e.getStatus()); }
        pdf.save(1L, "2026-11-06", first, state(1, 6, true));
        assertEquals(0, previous(1L));
        assertEquals(Boolean.TRUE, pdf.open(1L, "2026-11-04", first).get("completed"));
    }

    @Test
    public void exactSaveRetryReturnsSameRevisionButCannotOverwriteNewerNotes() throws Exception {
        String run = pdf.attach(1L, "2026-11-04", upload(), null).get("id");
        JsonNode request = state(0, 5, false);
        assertEquals(1, pdf.save(1L, "2026-11-04", run, request).get("revision"));
        assertEquals(1, pdf.save(1L, "2026-11-04", run, request).get("revision"));
        try {
            pdf.save(1L, "2026-11-04", run, state(0, 2, false));
            fail("A different state on an old revision must be rejected");
        } catch (EnrolmentClassScheduleException e) { assertEquals(HttpStatus.CONFLICT, e.getStatus()); }
    }

    @Test
    public void libraryAndFileAreGuardedByTeacherAndClassAccess() throws Exception {
        String document = upload();
        String run = pdf.attach(1L, "2026-11-04", document, null).get("id");
        owner = 8L;
        Map<String, Object> catalog = pdf.list(2L, "2026-11-04");
        assertEquals(Collections.emptyList(), catalog.get("library"));
        try {
            pdf.attach(2L, "2026-11-04", document, null);
            fail("Another teacher cannot attach a private library file");
        } catch (EnrolmentClassScheduleException e) { assertEquals(HttpStatus.NOT_FOUND, e.getStatus()); }
        try {
            pdf.content(3L, "2026-11-04", run);
            fail("File endpoint must enforce class access");
        } catch (AccessDeniedException expected) { assertEquals("Different class", expected.getMessage()); }
    }
}
