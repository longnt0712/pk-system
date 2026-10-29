package com.globits.richy.service.impl;

import com.globits.richy.dto.SpeakingDto.ImportRow;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.Normalizer;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.apache.poi.ss.usermodel.*;

public final class SpeakingImportSupport {
    private SpeakingImportSupport() {}
    public static String text(String value) { return value == null ? "" : value.replace("\r\n", "\n").trim(); }
    public static String normalized(String value) {
        return Normalizer.normalize(text(value), Normalizer.Form.NFC).toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }
    public static String hash(String value) {
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder out = new StringBuilder(); for (byte b : bytes) out.append(String.format(Locale.ROOT, "%02x", b & 255));
            return out.toString();
        } catch (java.security.NoSuchAlgorithmException error) { throw new IllegalStateException(error); }
    }
    public static String contentKey(ImportRow row, Long linkedPart2Id) {
        // A relation to a cue card belongs to the set, not to the student's Pass identity.
        return hash(row.part + "\n" + normalized(row.topic) + "\n" + normalized(row.prompt));
    }
    public static String entryKey(ImportRow row) {
        return hash(row.part + "\n" + (text(row.code).isEmpty() ? "text:" + normalized(row.topic) + "\n" + normalized(row.prompt) : "code:" + normalized(row.code)));
    }
    private static String header(String value) {
        return Normalizer.normalize(normalized(value).replace('đ', 'd'), Normalizer.Form.NFD).replaceAll("\\p{M}", "").replaceAll("[^a-z0-9]", "");
    }
    private static String cell(Row row, int index, DataFormatter formatter, FormulaEvaluator evaluator) {
        Cell cell = row == null ? null : row.getCell(index);
        String value = cell == null ? "" : text(formatter.formatCellValue(cell, evaluator));
        if (value.length() > 30000) throw new IllegalArgumentException("Một ô Excel vượt quá 30.000 ký tự.");
        return value;
    }
    public static List<ImportRow> read(byte[] bytes, int selectedYear, int selectedNumber) throws IOException {
        if (bytes == null || bytes.length == 0 || bytes.length > 8 * 1024 * 1024) throw new IllegalArgumentException("File Excel phải nhỏ hơn 8 MB.");
        long expanded = 0; byte[] buffer = new byte[8192];
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            for (ZipEntry entry; (entry = zip.getNextEntry()) != null;) {
                int read; while ((read = zip.read(buffer)) != -1) { expanded += read; if (expanded > 40L * 1024 * 1024) throw new IllegalArgumentException("File Excel giải nén quá lớn."); }
            }
        }
        if (expanded == 0) throw new IllegalArgumentException("Vui lòng dùng file .xlsx theo mẫu Speaking.");
        List<ImportRow> result = new ArrayList<ImportRow>();
        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
            DataFormatter formatter = new DataFormatter(Locale.ROOT); FormulaEvaluator evaluator = workbook.getCreationHelper().createFormulaEvaluator();
            Sheet info = workbook.getSheet("THONG_TIN");
            if (info != null) {
                String year = cell(info.getRow(3), 1, formatter, evaluator), number = cell(info.getRow(4), 1, formatter, evaluator);
                if ((!year.isEmpty() && !String.valueOf(selectedYear).equals(year)) || (!number.isEmpty() && !String.valueOf(selectedNumber).equals(number))) {
                    throw new IllegalArgumentException("Năm/Bộ trong file khác lựa chọn trên màn hình. Hãy chỉnh lại trước khi import.");
                }
            }
            Set<String> keys = new HashSet<String>(), contents = new HashSet<String>();
            long totalCharacters = 0;
            for (int part = 1; part <= 3; part++) {
                String sheetName = "PART_" + part; Sheet sheet = workbook.getSheet(sheetName); if (sheet == null) continue;
                String[] expected = part == 1 ? new String[]{"topic", "cauhoi", "sample", "macautuychon", "ghichu"}
                    : part == 2 ? new String[]{"tenbai", "cuecard", "sample", "mabaituychon", "ghichu"}
                    : new String[]{"nhompart3", "tenmapart2lienket", "cauhoi", "sample", "macautuychon", "ghichu"};
                for (int index = 0; index < expected.length; index++) {
                    if (!header(cell(sheet.getRow(0), index, formatter, evaluator)).equals(expected[index])) throw new IllegalArgumentException("Tên cột của " + sheetName + " không đúng mẫu.");
                }
                if (sheet.getLastRowNum() > 10000) throw new IllegalArgumentException("Mỗi tab chỉ nhận tối đa 10.000 dòng.");
                for (int index = 1; index <= sheet.getLastRowNum(); index++) {
                    Row line = sheet.getRow(index); String[] values = new String[expected.length]; boolean any = false;
                    for (int col = 0; col < values.length; col++) {
                        values[col] = cell(line, col, formatter, evaluator); any |= !values[col].isEmpty();
                        totalCharacters += values[col].length();
                        if (totalCharacters > 4000000) throw new IllegalArgumentException("Nội dung import vượt quá 4 triệu ký tự. Hãy chia nhỏ file.");
                    }
                    if (!any) continue;
                    ImportRow row = new ImportRow(); row.rowId = sheetName + ":" + (index + 1); row.part = part; row.topic = values[0];
                    row.prompt = values[part == 3 ? 2 : 1]; row.sample = values[part == 3 ? 3 : 2];
                    row.code = values[part == 3 ? 4 : 3]; row.note = values[part == 3 ? 5 : 4]; row.linkedPart2 = part == 3 ? values[1] : "";
                    if (row.topic.isEmpty() || row.prompt.isEmpty()) row.error = "Thiếu topic/tên bài hoặc câu hỏi/cue card.";
                    else if (row.topic.length() > 300 || row.code.length() > 100 || row.note.length() > 1000) row.error = "Tên tối đa 300 ký tự, mã 100 ký tự, ghi chú 1.000 ký tự.";
                    else if (!keys.add(entryKey(row)) || !contents.add(contentKey(row,null)+"\n"+normalized(row.linkedPart2))) row.error = "Trùng mã hoặc trùng câu trong file.";
                    result.add(row); if (result.size() > 10000) throw new IllegalArgumentException("Một lần import tối đa 10.000 câu.");
                }
            }
        } catch (IllegalArgumentException error) { throw error; }
        catch (Exception error) { throw new IllegalArgumentException("Không đọc được file. Vui lòng dùng file .xlsx đúng mẫu Speaking.", error); }
        if (result.isEmpty()) throw new IllegalArgumentException("File chưa có câu hỏi ở PART_1, PART_2 hoặc PART_3.");
        return result;
    }
}
