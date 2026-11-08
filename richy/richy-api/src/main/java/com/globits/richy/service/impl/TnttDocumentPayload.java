package com.globits.richy.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;

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
                new ArrayList<>(),
                "pageCount",
                3);
    }

    public static String encode(Object value) {
        try {
            return JSON.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalArgumentException("Không đọc được nội dung tài liệu.");
        }
    }

    public static Map<String, Object> decode(String value) {
        Map<String, Object> document = stored(value);
        document.remove("_live");
        return document;
    }

    static Map<String, Object> stored(String value) {
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
        Map<String, Object> document =
                        map(
                                "text",
                                value.get("text"),
                                "orientation",
                                value.get("orientation"),
                                "pattern",
                                value.get("pattern"),
                                "strokes",
                                clean);
        if (value.containsKey("textColor")) {
            Object textColor = value.get("textColor");
            if (!(textColor instanceof String) || !((String) textColor).matches("#[0-9a-fA-F]{6}"))
                throw new IllegalArgumentException("Màu chữ tài liệu không hợp lệ.");
            document.put("textColor", textColor);
        }
        if (value.containsKey("pageCount")) {
            Object pageCount = value.get("pageCount");
            if (!number(pageCount, 1, 80)
                    || ((Number) pageCount).doubleValue() != ((Number) pageCount).intValue())
                throw new IllegalArgumentException("Số trang tài liệu phải từ 1 đến 80.");
            document.put("pageCount", ((Number) pageCount).intValue());
        }
        if (value.containsKey("textDelta")) {
            Object delta = value.get("textDelta");
            if (!(delta instanceof Map) || !(((Map<?, ?>) delta).get("ops") instanceof List))
                throw new IllegalArgumentException("Định dạng chữ tài liệu không hợp lệ.");
            List<?> operations = (List<?>) ((Map<?, ?>) delta).get("ops");
            if (operations.isEmpty() || operations.size() > 10000)
                throw new IllegalArgumentException("Định dạng chữ tài liệu không hợp lệ.");
            List<Object> formatted = new ArrayList<>();
            StringBuilder plain = new StringBuilder();
            int images = 0;
            for (Object raw : operations) {
                if (!(raw instanceof Map))
                    throw new IllegalArgumentException("Định dạng chữ tài liệu không hợp lệ.");
                Map<?, ?> op = (Map<?, ?>) raw;
                for (Object key : op.keySet())
                    if (!Arrays.asList("insert", "attributes").contains(key))
                        throw new IllegalArgumentException("Định dạng chữ tài liệu không hợp lệ.");
                Object insert = op.get("insert");
                boolean embedded = insert instanceof Map;
                boolean image = embedded && ((Map<?, ?>) insert).containsKey("image");
                if (embedded) {
                    Map<?, ?> embed = (Map<?, ?>) insert;
                    if (embed.size() != 1)
                        throw new IllegalArgumentException("Định dạng ảnh không hợp lệ (tối đa 40 ảnh).");
                    if (image) {
                        if (!(embed.get("image") instanceof String) || ++images > 40) throw new IllegalArgumentException("Định dạng ảnh không hợp lệ (tối đa 40 ảnh).");
                        validateImage((String) embed.get("image"));
                        insert = map("image", embed.get("image"));
                    } else if (Boolean.TRUE.equals(embed.get("softbreak"))) {
                        plain.append('\u2028'); insert = map("softbreak", true);
                    } else throw new IllegalArgumentException("Định dạng chữ tài liệu không hợp lệ.");
                } else {
                    if (!(insert instanceof String) || ((String) insert).isEmpty() || plain.length() + ((String) insert).length() > 500001)
                        throw new IllegalArgumentException("Nội dung định dạng không hợp lệ hoặc quá dài.");
                    plain.append(insert);
                }
                Map<String, Object> cleanOp = map("insert", insert);
                if (op.containsKey("attributes")) {
                    if (!(op.get("attributes") instanceof Map))
                        throw new IllegalArgumentException("Định dạng chữ tài liệu không hợp lệ.");
                    Map<?, ?> attributes = (Map<?, ?>) op.get("attributes");
                    for (Map.Entry<?, ?> entry : attributes.entrySet()) {
                        String key = String.valueOf(entry.getKey());
                        Object v = entry.getValue();
                        boolean valid = false;
                        if ("bold".equals(key) || "italic".equals(key) || "underline".equals(key)) valid = v instanceof Boolean;
                        else if ("color".equals(key)) valid = v instanceof String && ((String) v).matches("#[a-fA-F0-9]{6}");
                        else if ("link".equals(key)) valid = !embedded && ((String) insert).matches("(?s).*[^\\n].*") && validLink(v);
                        else if ("width".equals(key)) valid = image && v instanceof String && ((String) v).matches("[1-9][0-9]{0,3}") && Integer.parseInt((String) v) <= 4096;
                        else if ("table".equals(key)) valid = !embedded && ((String) insert).matches("\\n+") && v instanceof String && ((String) v).matches("[a-zA-Z0-9_-]{1,80}");
                        else if ("table-colspan".equals(key) || "table-rowspan".equals(key)) valid = attributes.containsKey("table") && v instanceof String && ((String) v).matches("[1-9][0-9]?") && Integer.parseInt((String) v) <= 50;
                        if (!valid)
                            throw new IllegalArgumentException("Định dạng chữ tài liệu không hợp lệ.");
                    }
                    Map<String, Object> cleanAttributes = new LinkedHashMap<>();
                    for (String key : Arrays.asList("bold", "italic", "underline", "color", "link", "table", "table-colspan", "table-rowspan", "width"))
                        if (attributes.containsKey(key) && !Boolean.FALSE.equals(attributes.get(key))) cleanAttributes.put(key, attributes.get(key));
                    if (!cleanAttributes.isEmpty()) cleanOp.put("attributes", cleanAttributes);
                }
                formatted.add(cleanOp);
            }
            if (!plain.toString().equals(value.get("text") + "\n"))
                throw new IllegalArgumentException("Định dạng chữ không khớp nội dung tài liệu.");
            document.put("textDelta", map("ops", formatted));
        }
        String data = encode(document);
        if (data.getBytes(StandardCharsets.UTF_8).length > 8 * 1024 * 1024)
            throw new IllegalArgumentException("Tài liệu vượt dung lượng 8 MB.");
        return data;
    }

    private static boolean validLink(Object value) {
        return value instanceof String && ((String) value).length() <= 2048
                && ((String) value).matches("(?iU)https?://(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|\\[[a-f0-9:]+\\])(?::[0-9]{1,5})?(?:[/?#][^\\s<>\"'\\\\\\x00-\\x1f\\x7f]*)?");
    }

    private static void validateImage(String source) {
        int comma = source.indexOf(',');
        if (source.length() > 2796226 || !source.matches("data:image/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}") || (source.length() - comma - 1) % 4 != 0)
            throw new IllegalArgumentException("Định dạng ảnh không hợp lệ hoặc ảnh vượt 2 MB.");
        try {
            byte[] bytes = Base64.getDecoder().decode(source.substring(source.indexOf(',') + 1));
            if (bytes.length > 2 * 1024 * 1024) throw new IllegalArgumentException();
            // Inspect dimensions before decoding pixels, including on public shared documents.
            try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
                if (!readers.hasNext()) throw new IllegalArgumentException();
                ImageReader reader = readers.next();
                try {
                    reader.setInput(input, true, true);
                    String mime = reader.getFormatName().toLowerCase(Locale.ROOT);
                    if (!("png".equals(mime) && source.startsWith("data:image/png;"))
                            && !("jpeg".equals(mime) && source.startsWith("data:image/jpeg;"))) throw new IllegalArgumentException();
                    int width = reader.getWidth(0), height = reader.getHeight(0);
                    if (width < 1 || height < 1 || width > 4096 || height > 4096) throw new IllegalArgumentException();
                } finally { reader.dispose(); }
            }
        } catch (Exception error) {
            throw new IllegalArgumentException("Ảnh dán không hợp lệ hoặc kích thước vượt 4096 px.");
        }
    }
}
