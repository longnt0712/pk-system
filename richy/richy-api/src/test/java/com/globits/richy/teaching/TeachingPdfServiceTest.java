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
        jdbc.execute("CREATE TABLE dbo.tbl_class_teaching_pdf (id VARCHAR(36) PRIMARY KEY, owner_id BIGINT, "
                + "name NVARCHAR(255), content VARBINARY(MAX), folder_id VARCHAR(36), library_deleted BIT NOT NULL DEFAULT 0)");
        jdbc.execute("CREATE TABLE dbo.tbl_class_teaching_pdf_folder (id VARCHAR(36) PRIMARY KEY, owner_id BIGINT, parent_id VARCHAR(36), name NVARCHAR(200))");
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

    private MockMultipartFile lessonFile() {
        return new MockMultipartFile("file", "Lesson.pdf", "application/pdf",
                "%PDF-1.7".getBytes(StandardCharsets.US_ASCII));
    }

    private String upload() throws Exception {
        return pdf.upload(1L, "2026-11-04", lessonFile(), null).get("id");
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
    public void removingLibraryItemsKeepsTeachingRunsAndRequiresAnEmptyFolder() throws Exception {
        String date = "2026-11-04";
        String parent = pdf.saveFolder(1L, date, null, null, "Class").get("id");
        String child = pdf.saveFolder(1L, date, null, parent, "Week").get("id");
        String file = pdf.upload(1L, date, lessonFile(), child).get("id");
        String run = pdf.attach(1L, date, file, null).get("id");
        pdf.save(1L, date, run, state(0, 5, false));

        for (String folder : new String[]{parent, child}) {
            try {
                pdf.deleteFolder(1L, date, folder);
                fail("Cannot delete a folder containing a file or a subfolder");
            } catch (EnrolmentClassScheduleException expected) { assertEquals(HttpStatus.CONFLICT, expected.getStatus()); }
        }
        owner = 8L;
        try {
            pdf.deleteFile(1L, date, file);
            fail("Cannot delete another teacher's file");
        } catch (EnrolmentClassScheduleException expected) { assertEquals(HttpStatus.NOT_FOUND, expected.getStatus()); }
        try {
            pdf.deleteFolder(1L, date, child);
            fail("Cannot delete another teacher's folder");
        } catch (EnrolmentClassScheduleException expected) { assertEquals(HttpStatus.NOT_FOUND, expected.getStatus()); }
        owner = 7L;

        assertEquals(file, pdf.deleteFile(1L, date, file).get("id"));
        assertEquals(file, pdf.deleteFile(1L, date, file).get("id"));
        assertEquals(child, pdf.deleteFolder(1L, date, child).get("id"));
        assertEquals(parent, pdf.deleteFolder(1L, date, parent).get("id"));
        assertEquals(Collections.emptyList(), pdf.list(1L, date).get("library"));
        assertEquals(Collections.emptyList(), pdf.list(1L, date).get("folders"));
        assertEquals("Lesson.pdf", pdf.open(1L, date, run).get("name"));
        assertEquals(5, json.readTree((String) pdf.open(1L, date, run).get("progress")).path("page").asInt());
        assertArrayEquals("%PDF-1.7".getBytes(StandardCharsets.US_ASCII), pdf.content(1L, date, run));
        assertEquals(run, pdf.attach(1L, "2026-11-06", null, run).get("id"));
        try {
            pdf.attach(2L, date, file, null);
            fail("Cannot newly attach a removed library PDF");
        } catch (EnrolmentClassScheduleException expected) { assertEquals(HttpStatus.NOT_FOUND, expected.getStatus()); }
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
    public void authorizedEditorsCanPollTheSameRunWithoutReceivingUnchangedProgress() throws Exception {
        String run = pdf.attach(1L, "2026-11-04", upload(), null).get("id");
        pdf.save(1L, "2026-11-04", run, state(0, 5, false));
        owner = 8L;
        assertEquals(8L, pdf.open(1L, "2026-11-04", run).get("editorId"));
        RestTeachingPdfController controller = new RestTeachingPdfController(pdf);
        assertEquals("no-store", controller.changes(1L, "2026-11-04", run, 0).getHeaders().getFirst("Cache-Control"));
        Map<String, Object> changes = controller.changes(1L, "2026-11-04", run, 0).getBody();
        assertEquals(1, changes.get("revision"));
        assertEquals(5, json.readTree((String) changes.get("progress")).path("page").asInt());
        assertNull(pdf.changes(1L, "2026-11-04", run, 1).get("progress"));
        pdf.save(1L, "2026-11-04", run, state(1, 5, true));
        assertEquals(true, pdf.changes(1L, "2026-11-04", run, 1).get("completed"));
        try {
            pdf.changes(2L, "2026-11-04", run, 0);
            fail("Polling must stay within the class and date linked to this run");
        } catch (EnrolmentClassScheduleException e) { assertEquals(HttpStatus.NOT_FOUND, e.getStatus()); }
        try {
            pdf.changes(3L, "2026-11-04", run, 0);
            fail("Polling must enforce class permissions");
        } catch (AccessDeniedException expected) { assertEquals("Different class", expected.getMessage()); }
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
    public void foldersOrganizeExistingPdfsWithoutChangingTheirAttachedProgress() throws Exception {
        String document = upload();
        String run = pdf.attach(1L, "2026-11-04", document, null).get("id");
        pdf.save(1L, "2026-11-04", run, state(0, 5, false));
        String root = pdf.saveFolder(1L, "2026-11-04", null, null, "Grade 9").get("id");
        String child = pdf.saveFolder(1L, "2026-11-04", null, root, "Week 3").get("id");

        List<?> files = (List<?>) pdf.list(1L, "2026-11-04").get("library");
        assertNull(((Map<?, ?>) files.get(0)).get("folderId"));
        assertEquals(child, pdf.updateFile(1L, "2026-11-04", document, child, "Renamed.pdf").get("folderId"));
        assertEquals("Renamed.pdf", pdf.open(1L, "2026-11-04", run).get("name"));
        assertEquals(5, json.readTree((String) pdf.open(1L, "2026-11-04", run).get("progress")).path("page").asInt());
        assertEquals(child, pdf.upload(1L, "2026-11-04", lessonFile(), child).get("folderId"));
        assertNull(pdf.updateFile(1L, "2026-11-04", document, null, "Renamed.pdf").get("folderId"));

        try {
            pdf.saveFolder(1L, "2026-11-04", root, child, "Grade 9");
            fail("A folder cannot be moved inside its descendant");
        } catch (EnrolmentClassScheduleException e) { assertEquals(HttpStatus.BAD_REQUEST, e.getStatus()); }
        assertNull(pdf.saveFolder(1L, "2026-11-04", child, null, "Week 3").get("parentId"));
        owner = 8L;
        assertEquals(Collections.emptyList(), pdf.list(1L, "2026-11-04").get("folders"));
        try {
            pdf.upload(1L, "2026-11-04", lessonFile(), child);
            fail("Cannot upload into another teacher's folder");
        } catch (EnrolmentClassScheduleException e) { assertEquals(HttpStatus.NOT_FOUND, e.getStatus()); }
        try {
            pdf.updateFile(1L, "2026-11-04", document, null, "Other.pdf");
            fail("Cannot rename another teacher's file");
        } catch (EnrolmentClassScheduleException e) { assertEquals(HttpStatus.NOT_FOUND, e.getStatus()); }
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
