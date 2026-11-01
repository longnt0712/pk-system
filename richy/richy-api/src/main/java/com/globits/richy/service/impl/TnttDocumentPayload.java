package com.globits.richy.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.*;

public final class TnttDocumentPayload {
    private static final ObjectMapper JSON = new ObjectMapper();

    private TnttDocumentPayload() {}

    public static Map<String, Object> map(Object... pairs) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) out.put((String) pairs[i], pairs[i + 1]);
        return out;
    }

    public static Map<String, Object> blank() {
        return map(
                "text",
                "",
                "orientation",
                "portrait",
                "pattern",
                "lined",
                "strokes",
                new ArrayList<>());
    }

    public static String encode(Object value) {
        try {
            return JSON.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalArgumentException("Không đọc được nội dung tài liệu.");
        }
    }

    public static Map<String, Object> decode(String value) {
        try {
            return value == null
                    ? blank()
                    : JSON.readValue(value, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            throw new IllegalStateException("Không đọc được tài liệu đã lưu.");
        }
    }

    private static boolean number(Object v, double min, double max) {
        if (!(v instanceof Number)) return false;
        double n = ((Number) v).doubleValue();
        return !Double.isNaN(n) && !Double.isInfinite(n) && n >= min && n <= max;
    }

    public static String validate(Map<String, Object> value) {
        if (value == null
                || !(value.get("text") instanceof String)
                || ((String) value.get("text")).length() > 500000
                || !Arrays.asList("portrait", "landscape").contains(value.get("orientation"))
                || !Arrays.asList("blank", "lined", "vertical", "grid", "squares", "sketch")
                        .contains(value.get("pattern"))
                || !(value.get("strokes") instanceof List))
            throw new IllegalArgumentException("Nội dung tài liệu không hợp lệ hoặc quá dài.");
        List<?> strokes = (List<?>) value.get("strokes");
        if (strokes.size() > 10000) throw new IllegalArgumentException("Tối đa 10.000 nét bút.");
        List<Object> clean = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        int count = 0;
        for (Object raw : strokes) {
            if (!(raw instanceof Map)) throw new IllegalArgumentException("Nét bút không hợp lệ.");
            Map<?, ?> s = (Map<?, ?>) raw;
            Object id = s.get("id"), color = s.get("color");
            if (!(id instanceof String)
                    || ((String) id).isEmpty()
                    || ((String) id).length() > 100
                    || !ids.add((String) id)
                    || !Arrays.asList("pen", "highlighter").contains(s.get("tool"))
                    || !(color instanceof String)
                    || !((String) color).matches("#[a-fA-F0-9]{6}")
                    || !number(s.get("width"), Double.MIN_VALUE, 100)
                    || !(s.get("points") instanceof List))
                throw new IllegalArgumentException("Nét bút không hợp lệ.");
            List<?> points = (List<?>) s.get("points");
            count += points.size();
            if (points.isEmpty() || count > 200000)
                throw new IllegalArgumentException("Nét bút vượt giới hạn 200.000 điểm.");
            List<Object> copy = new ArrayList<>();
            for (Object p : points) {
                if (!(p instanceof List))
                    throw new IllegalArgumentException("Điểm bút không hợp lệ.");
                List<?> point = (List<?>) p;
                if (point.size() < 2
                        || point.size() > 3
                        || !number(point.get(0), 0, 100000)
                        || !number(point.get(1), 0, 100000)
                        || (point.size() == 3 && !number(point.get(2), 0, 1)))
                    throw new IllegalArgumentException("Điểm bút không hợp lệ.");
                copy.add(new ArrayList<>(point));
            }
            clean.add(
                    map(
                            "id",
                            id,
                            "tool",
                            s.get("tool"),
                            "color",
                            color,
                            "width",
                            s.get("width"),
                            "points",
                            copy));
        }
        String data =
                encode(
                        map(
                                "text",
                                value.get("text"),
                                "orientation",
                                value.get("orientation"),
                                "pattern",
                                value.get("pattern"),
                                "strokes",
                                clean));
        if (data.getBytes(StandardCharsets.UTF_8).length > 8 * 1024 * 1024)
            throw new IllegalArgumentException("Tài liệu vượt dung lượng 8 MB.");
        return data;
    }
}
