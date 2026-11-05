package com.globits.richy.service.impl;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Iterator;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.MemoryCacheImageInputStream;
import org.springframework.web.multipart.MultipartFile;

final class FairItemPhoto {
    private static final int MAX_BYTES = 8 * 1024 * 1024;
    private static final int MAX_EDGE = 1400;
    private static final long MAX_PIXELS = 25000000L;

    private FairItemPhoto() {}

    static byte[] encode(MultipartFile file) {
        if (file.getSize() == 0 || file.getSize() > MAX_BYTES) {
            throw new FairService.Invalid("Chọn ảnh JPG hoặc PNG có dung lượng tối đa 8 MB.");
        }
        try (InputStream stream = file.getInputStream();
                MemoryCacheImageInputStream input = new MemoryCacheImageInputStream(stream)) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) { throw invalidImage(); }
            ImageReader reader = readers.next();
            try {
                String format = reader.getFormatName();
                if (!"JPEG".equalsIgnoreCase(format) && !"PNG".equalsIgnoreCase(format)) {
                    throw invalidImage();
                }
                reader.setInput(input, true, true);
                int width = reader.getWidth(0), height = reader.getHeight(0);
                if (width < 1 || height < 1 || (long) width * height > MAX_PIXELS) {
                    throw new FairService.Invalid("Ảnh vượt quá 25 triệu điểm ảnh.");
                }
                BufferedImage source = reader.read(0);
                double scale = Math.min(1.0, (double) MAX_EDGE / Math.max(width, height));
                BufferedImage photo = new BufferedImage(Math.max(1, (int) Math.round(width * scale)),
                        Math.max(1, (int) Math.round(height * scale)), BufferedImage.TYPE_INT_RGB);
                Graphics2D graphics = photo.createGraphics();
                try {
                    graphics.setColor(Color.WHITE);
                    graphics.fillRect(0, 0, photo.getWidth(), photo.getHeight());
                    graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                    graphics.drawImage(source, 0, 0, photo.getWidth(), photo.getHeight(), null);
                } finally {
                    graphics.dispose();
                    source.flush();
                }
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                if (!ImageIO.write(photo, "jpg", bytes)) { throw invalidImage(); }
                return bytes.toByteArray();
            } finally {
                reader.dispose();
            }
        } catch (IOException | IllegalArgumentException error) {
            throw invalidImage();
        }
    }

    private static FairService.Invalid invalidImage() {
        return new FairService.Invalid("Không đọc được ảnh. Vui lòng chọn tệp JPG hoặc PNG hợp lệ.");
    }
}
