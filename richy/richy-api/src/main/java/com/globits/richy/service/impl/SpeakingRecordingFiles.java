package com.globits.richy.service.impl;

import com.globits.richy.domain.SpeakingRecording;
import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;

/** Only the UUID directory directly beneath the configured audio root is writable. */
final class SpeakingRecordingFiles {
    private SpeakingRecordingFiles() {}

    static Path directory(String configuredRoot, SpeakingRecording recording, boolean create) throws IOException {
        Path root = (configuredRoot == null || configuredRoot.trim().isEmpty()
            ? Paths.get(System.getProperty("user.home"), ".ieltsroom", "speaking-recordings")
            : Paths.get(configuredRoot)).toAbsolutePath().normalize();
        String key = recording.getStorageKey();
        try {
            if (key == null || !UUID.fromString(key).toString().equals(key)) { throw new IllegalArgumentException(); }
        } catch (IllegalArgumentException invalid) {
            throw new AccessDeniedException("Mã lưu ghi âm không hợp lệ.");
        }
        Path target = root.resolve(key).normalize();
        if (!root.equals(target.getParent()) || Files.isSymbolicLink(root) || Files.isSymbolicLink(target)) {
            throw new AccessDeniedException("Đường dẫn ghi âm không hợp lệ.");
        }
        if (create) { Files.createDirectories(target); }
        if (Files.exists(target, LinkOption.NOFOLLOW_LINKS) && !Files.isDirectory(target, LinkOption.NOFOLLOW_LINKS)) {
            throw new IOException("Thư mục ghi âm không hợp lệ.");
        }
        return target;
    }

    static void delete(String root, SpeakingRecording recording) throws IOException {
        final Path target = directory(root, recording, false);
        if (!Files.exists(target, LinkOption.NOFOLLOW_LINKS)) { return; }
        // walkFileTree does not follow symlinks: a link inside this folder is removed,
        // never the directory or file to which it points.
        Files.walkFileTree(target, new SimpleFileVisitor<Path>() {
            private void check(Path path) {
                if (!path.toAbsolutePath().normalize().startsWith(target)) {
                    throw new AccessDeniedException("Không được xoá ngoài thư mục ghi âm.");
                }
            }
            @Override public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
                check(dir); return FileVisitResult.CONTINUE;
            }
            @Override public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                check(file); Files.delete(file); return FileVisitResult.CONTINUE;
            }
            @Override public FileVisitResult postVisitDirectory(Path dir, IOException error) throws IOException {
                if (error != null) { throw error; }
                check(dir); Files.delete(dir); return FileVisitResult.CONTINUE;
            }
        });
    }
}
