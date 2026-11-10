package com.globits.richy.service.impl;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import javax.sql.DataSource;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.fasterxml.jackson.databind.JsonNode;
import com.globits.richy.dto.TeachingPdfSession;
import com.globits.richy.service.EnrolmentClassScheduleException;
import com.globits.richy.service.EnrolmentClassService;

@Service
@Transactional
public class TeachingPdfService {
    private static final long MAX_FILE_SIZE = 9L * 1024 * 1024;
    private static final int MAX_PROGRESS_LENGTH = 512 * 1024;
    private final JdbcTemplate jdbc;
    private final EnrolmentClassService classes;

    @Autowired
    public TeachingPdfService(DataSource source, EnrolmentClassService classes) {
        jdbc = new JdbcTemplate(source);
        this.classes = classes;
    }

    private static EnrolmentClassScheduleException error(HttpStatus status, String message) {
        return new EnrolmentClassScheduleException(status, message);
    }

    public Map<String, Object> list(Long classId, String date) {
        TeachingPdfSession session = classes.teachingPdfSession(classId, date, false);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("library", jdbc.queryForList("SELECT id, name, folder_id AS folderId FROM dbo.tbl_class_teaching_pdf "
                + "WHERE owner_id = ? AND library_deleted = 0 ORDER BY name, id", session.ownerId));
        result.put("folders", folders(session.ownerId));
        result.put("current", lessons(session.dayId, false));
        result.put("previous", lessons(session.previousDayId, true));
        return result;
    }

    private List<Map<String, Object>> folders(Long ownerId) {
        return jdbc.queryForList("SELECT id, parent_id AS parentId, name FROM dbo.tbl_class_teaching_pdf_folder "
                + "WHERE owner_id = ? ORDER BY name, id", ownerId);
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public Map<String, String> saveFolder(Long classId, String date, String id, String parentId, String name) {
        Long ownerId = classes.teachingPdfSession(classId, date, false).ownerId;
        name = libraryName(name, 200);
        parentId = emptyToNull(parentId);

        // Read the owner's hierarchy in the same serializable transaction as the update.
        // Two concurrent folder moves must not both validate against the old hierarchy.
        Map<String, String> parents = new LinkedHashMap<>();
        for (Map<String, Object> folder : folders(ownerId)) {
            parents.put((String) folder.get("id"), (String) folder.get("parentId"));
        }
        if (id != null && !parents.containsKey(id)) {
            throw error(HttpStatus.NOT_FOUND, "Không tìm thấy thư mục trong kho của bạn.");
        }
        Set<String> visited = new HashSet<>();
        for (String ancestor = parentId; ancestor != null; ancestor = parents.get(ancestor)) {
            if (!parents.containsKey(ancestor)) {
                throw error(HttpStatus.NOT_FOUND, "Không tìm thấy thư mục đích trong kho của bạn.");
            }
            if (ancestor.equals(id) || !visited.add(ancestor)) {
                throw error(HttpStatus.BAD_REQUEST, "Không thể di chuyển thư mục vào chính nó hoặc thư mục con.");
            }
        }
        try {
            if (id == null) {
                id = UUID.randomUUID().toString();
                jdbc.update("INSERT INTO dbo.tbl_class_teaching_pdf_folder (id, owner_id, parent_id, name) VALUES (?, ?, ?, ?)",
                        id, ownerId, parentId, name);
            } else {
                jdbc.update("UPDATE dbo.tbl_class_teaching_pdf_folder SET parent_id = ?, name = ? WHERE id = ? AND owner_id = ?",
                        parentId, name, id, ownerId);
            }
        } catch (DuplicateKeyException e) {
            throw error(HttpStatus.CONFLICT, "Đã có thư mục cùng tên ở vị trí này.");
        }
        return libraryEntry(id, name, "parentId", parentId);
    }

    public Map<String, String> updateFile(Long classId, String date, String id, String folderId, String name) {
        Long ownerId = classes.teachingPdfSession(classId, date, false).ownerId;
        name = libraryName(name, 255);
        folderId = ownedFolder(ownerId, folderId);
        int changed = jdbc.update("UPDATE dbo.tbl_class_teaching_pdf SET name = ?, folder_id = ? "
                + "WHERE id = ? AND owner_id = ? AND library_deleted = 0",
                name, folderId, id, ownerId);
        if (changed != 1) { throw error(HttpStatus.NOT_FOUND, "PDF không có trong kho của bạn."); }
        return libraryEntry(id, name, "folderId", folderId);
    }

    public Map<String, String> deleteFile(Long classId, String date, String id) {
        Long ownerId = classes.teachingPdfSession(classId, date, false).ownerId;
        int changed = jdbc.update("UPDATE dbo.tbl_class_teaching_pdf SET library_deleted = 1, folder_id = NULL "
                + "WHERE id = ? AND owner_id = ?", id, ownerId);
        if (changed != 1) { throw error(HttpStatus.NOT_FOUND, "PDF không có trong kho của bạn."); }
        return Collections.singletonMap("id", id);
    }

    @Transactional(isolation = Isolation.SERIALIZABLE)
    public Map<String, String> deleteFolder(Long classId, String date, String id) {
        Long ownerId = classes.teachingPdfSession(classId, date, false).ownerId;
        String occupied = "Thư mục còn PDF hoặc thư mục con. Hãy chuyển hoặc xóa các mục bên trong trước.";
        try {
            int removed = jdbc.update("DELETE FROM dbo.tbl_class_teaching_pdf_folder WHERE id = ? AND owner_id = ? "
                    + "AND NOT EXISTS (SELECT 1 FROM dbo.tbl_class_teaching_pdf_folder WHERE parent_id = ? AND owner_id = ?) "
                    + "AND NOT EXISTS (SELECT 1 FROM dbo.tbl_class_teaching_pdf WHERE folder_id = ? AND owner_id = ?)",
                    id, ownerId, id, ownerId, id, ownerId);
            if (removed != 1) {
                ownedFolder(ownerId, id);
                throw error(HttpStatus.CONFLICT, occupied);
            }
        } catch (DataIntegrityViolationException e) {
            throw error(HttpStatus.CONFLICT, occupied);
        }
        return Collections.singletonMap("id", id);
    }

    private String ownedFolder(Long ownerId, String folderId) {
        folderId = emptyToNull(folderId);
        if (folderId != null && jdbc.queryForList("SELECT id FROM dbo.tbl_class_teaching_pdf_folder WHERE id = ? AND owner_id = ?",
                String.class, folderId, ownerId).isEmpty()) {
            throw error(HttpStatus.NOT_FOUND, "Không tìm thấy thư mục đích trong kho của bạn.");
        }
        return folderId;
    }

    private static String emptyToNull(String value) {
        return value == null || value.isEmpty() ? null : value;
    }

    private static String libraryName(String value, int maxLength) {
        String name = value == null ? "" : value.replaceAll("[\\p{Cntrl}]", "").trim();
        if (name.isEmpty() || name.length() > maxLength) {
            throw error(HttpStatus.BAD_REQUEST, "Tên phải có từ 1 đến " + maxLength + " ký tự.");
        }
        return name;
    }

    private static Map<String, String> libraryEntry(String id, String name, String folderKey, String folderId) {
        Map<String, String> result = new LinkedHashMap<>();
        result.put("id", id);
        result.put("name", name);
        result.put(folderKey, folderId);
        return result;
    }

    private List<Map<String, Object>> lessons(Long dayId, boolean unfinished) {
        if (dayId == null) { return Collections.emptyList(); }
        return jdbc.queryForList("SELECT r.id, r.pdf_id AS pdfId, p.name, r.completed FROM dbo.tbl_class_teaching_pdf_day a "
                + "JOIN dbo.tbl_class_teaching_pdf_run r ON r.id = a.run_id "
                + "JOIN dbo.tbl_class_teaching_pdf p ON p.id = r.pdf_id "
                + "WHERE a.day_id = ? AND (? = 0 OR r.completed = 0) ORDER BY p.name, r.id", dayId, unfinished ? 1 : 0);
    }

    public Map<String, String> upload(Long classId, String date, MultipartFile file, String folderId) throws IOException {
        TeachingPdfSession session = classes.teachingPdfSession(classId, date, false);
        if (file.isEmpty() || file.getSize() < 5 || file.getSize() > MAX_FILE_SIZE) {
            throw error(HttpStatus.BAD_REQUEST, "Chọn tệp PDF tối đa 9 MB.");
        }
        byte[] bytes = file.getBytes();
        if (!"%PDF-".equals(new String(bytes, 0, 5, StandardCharsets.US_ASCII))) {
            throw error(HttpStatus.BAD_REQUEST, "Tệp tải lên phải là PDF.");
        }
        String name = file.getOriginalFilename();
        name = name == null ? "" : name.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}]", "").trim();
        if (name.isEmpty()) { name = "Tài liệu.pdf"; }
        if (name.length() > 255) { name = name.substring(0, 255); }
        String id = UUID.randomUUID().toString();
        folderId = ownedFolder(session.ownerId, folderId);
        jdbc.update("INSERT INTO dbo.tbl_class_teaching_pdf (id, owner_id, name, content, folder_id) VALUES (?, ?, ?, ?, ?)",
                id, session.ownerId, name, bytes, folderId);
        return libraryEntry(id, name, "folderId", folderId);
    }

    public Map<String, String> attach(Long classId, String date, String pdfId, String previousRun) {
        if ((pdfId == null) == (previousRun == null)) {
            throw error(HttpStatus.BAD_REQUEST, "Chọn một PDF hoặc lượt dạy cần tiếp tục.");
        }
        TeachingPdfSession session = classes.teachingPdfSession(classId, date, true);
        String run = previousRun;
        if (run != null) {
            Integer valid = jdbc.queryForObject("SELECT COUNT(*) FROM dbo.tbl_class_teaching_pdf_run r "
                    + "JOIN dbo.tbl_class_teaching_pdf_day a ON a.run_id = r.id "
                    + "WHERE r.id = ? AND r.class_id = ? AND a.day_id = ? AND r.completed = 0",
                    Integer.class, run, classId, session.previousDayId);
            if (valid == null || valid != 1) { throw error(HttpStatus.CONFLICT, "Lượt dạy này không còn có thể tiếp tục."); }
        } else {
            Integer owned = jdbc.queryForObject("SELECT COUNT(*) FROM dbo.tbl_class_teaching_pdf "
                    + "WHERE id = ? AND owner_id = ? AND library_deleted = 0",
                    Integer.class, pdfId, session.ownerId);
            if (owned == null || owned != 1) { throw error(HttpStatus.NOT_FOUND, "PDF không có trong kho của bạn."); }
            List<String> current = jdbc.queryForList("SELECT r.id FROM dbo.tbl_class_teaching_pdf_run r "
                    + "JOIN dbo.tbl_class_teaching_pdf_day a ON a.run_id = r.id WHERE a.day_id = ? AND r.pdf_id = ?",
                    String.class, session.dayId, pdfId);
            if (!current.isEmpty()) { return Collections.singletonMap("id", current.get(0)); }
            run = UUID.randomUUID().toString();
            jdbc.update("INSERT INTO dbo.tbl_class_teaching_pdf_run (id, class_id, pdf_id) VALUES (?, ?, ?)", run, classId, pdfId);
        }
        jdbc.update("INSERT INTO dbo.tbl_class_teaching_pdf_day (day_id, run_id) SELECT ?, ? "
                + "WHERE NOT EXISTS (SELECT 1 FROM dbo.tbl_class_teaching_pdf_day WHERE day_id = ? AND run_id = ?)",
                session.dayId, run, session.dayId, run);
        return Collections.singletonMap("id", run);
    }

    public Map<String, Object> open(Long classId, String date, String runId) {
        TeachingPdfSession session = classes.teachingPdfSession(classId, date, false);
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT p.name, r.revision, r.completed, r.progress "
                + "FROM dbo.tbl_class_teaching_pdf_run r JOIN dbo.tbl_class_teaching_pdf p ON p.id = r.pdf_id "
                + "JOIN dbo.tbl_class_teaching_pdf_day a ON a.run_id = r.id WHERE r.id = ? AND r.class_id = ? AND a.day_id = ?",
                runId, classId, session.dayId);
        if (rows.isEmpty()) { throw error(HttpStatus.NOT_FOUND, "Không tìm thấy tài liệu của buổi này."); }
        Map<String, Object> row = rows.get(0);
        Map<String, Object> result = progressResponse(row);
        result.put("name", row.get("name"));
        result.put("editorId", session.ownerId);
        return result;
    }

    public Map<String, Object> changes(Long classId, String date, String runId, int afterRevision) {
        TeachingPdfSession session = classes.teachingPdfSession(classId, date, false);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT r.revision, r.completed, CASE WHEN r.revision = ? THEN NULL ELSE r.progress END AS progress "
                + "FROM dbo.tbl_class_teaching_pdf_run r JOIN dbo.tbl_class_teaching_pdf_day a ON a.run_id = r.id "
                + "WHERE r.id = ? AND r.class_id = ? AND a.day_id = ?",
                afterRevision, runId, classId, session.dayId);
        if (rows.isEmpty()) { throw error(HttpStatus.NOT_FOUND, "Không tìm thấy tài liệu của buổi này."); }
        return progressResponse(rows.get(0));
    }

    private static Map<String, Object> progressResponse(Map<String, Object> row) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("revision", row.get("revision"));
        result.put("completed", row.get("completed"));
        result.put("progress", row.get("progress"));
        return result;
    }

    public byte[] content(Long classId, String date, String runId) {
        TeachingPdfSession session = classes.teachingPdfSession(classId, date, false);
        List<byte[]> rows = jdbc.query("SELECT p.content FROM dbo.tbl_class_teaching_pdf_run r "
                + "JOIN dbo.tbl_class_teaching_pdf p ON p.id = r.pdf_id "
                + "JOIN dbo.tbl_class_teaching_pdf_day a ON a.run_id = r.id WHERE r.id = ? AND r.class_id = ? AND a.day_id = ?",
                (rs, index) -> rs.getBytes(1), runId, classId, session.dayId);
        if (rows.isEmpty()) { throw error(HttpStatus.NOT_FOUND, "Không tìm thấy tài liệu của buổi này."); }
        return rows.get(0);
    }

    public Map<String, Object> save(Long classId, String date, String runId, JsonNode request) {
        TeachingPdfSession session = classes.teachingPdfSession(classId, date, false);
        JsonNode state = request.path("state");
        JsonNode revision = request.path("revision");
        String progress = state.toString();
        if (!revision.isIntegralNumber() || !revision.canConvertToInt() || revision.intValue() < 0
                || !state.isObject() || !state.path("page").isInt() || state.path("page").asInt() < 1
                || !state.path("marks").isArray() || progress.length() > MAX_PROGRESS_LENGTH) {
            throw error(HttpStatus.BAD_REQUEST, "Dữ liệu ghi chú không hợp lệ hoặc vượt dung lượng cho phép.");
        }
        boolean completed = request.path("completed").asBoolean(false);
        int updated = jdbc.update("UPDATE dbo.tbl_class_teaching_pdf_run SET revision = revision + 1, progress = ?, completed = ? "
                + "WHERE id = ? AND class_id = ? AND revision = ? AND completed = 0 "
                + "AND EXISTS (SELECT 1 FROM dbo.tbl_class_teaching_pdf_day WHERE run_id = ? AND day_id = ?)",
                progress, completed, runId, classId, revision.intValue(), runId, session.dayId);
        if (updated != 1) {
            List<Map<String, Object>> rows = jdbc.queryForList("SELECT r.revision, r.completed, r.progress FROM dbo.tbl_class_teaching_pdf_run r "
                    + "JOIN dbo.tbl_class_teaching_pdf_day a ON a.run_id = r.id WHERE r.id = ? AND r.class_id = ? AND a.day_id = ?",
                    runId, classId, session.dayId);
            Map<String, Object> saved = rows.isEmpty() ? Collections.emptyMap() : rows.get(0);
            if (!Integer.valueOf(revision.intValue() + 1).equals(saved.get("revision"))
                    || !Boolean.valueOf(completed).equals(saved.get("completed")) || !progress.equals(saved.get("progress"))) {
                throw error(HttpStatus.CONFLICT, "Tiến trình đã thay đổi ở phiên khác. Ghi chú đang nhập vẫn còn trong cửa sổ này.");
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("revision", revision.intValue() + 1);
        result.put("completed", completed);
        return result;
    }
}
