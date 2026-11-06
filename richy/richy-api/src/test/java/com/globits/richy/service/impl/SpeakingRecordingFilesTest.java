package com.globits.richy.service.impl;

import com.globits.richy.domain.SpeakingRecording;
import com.globits.richy.rest.RestSpeakingController;
import java.io.IOException;
import java.nio.file.*;
import java.util.Arrays;
import java.util.UUID;
import org.junit.*;
import org.junit.rules.TemporaryFolder;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class SpeakingRecordingFilesTest {
    @Rule public TemporaryFolder files = new TemporaryFolder();

    private SpeakingRecording recording() {
        SpeakingRecording recording = new SpeakingRecording();
        recording.setStorageKey(UUID.randomUUID().toString()); return recording;
    }

    @Test public void deletionRemovesOnlyTheValidatedRecordingDirectoryAndIsIdempotent() throws Exception {
        Path root = files.newFolder("audio").toPath(); SpeakingRecording old = recording(), fresh = recording();
        Path oldFolder = SpeakingRecordingFiles.directory(root.toString(), old, true);
        Path freshFolder = SpeakingRecordingFiles.directory(root.toString(), fresh, true);
        Files.write(oldFolder.resolve("recording.audio"), new byte[]{1});
        Files.write(oldFolder.resolve("0.chunk"), new byte[]{2});
        Files.write(Files.createDirectory(oldFolder.resolve("temporary")).resolve("assemble.tmp"), new byte[]{3});
        Files.write(freshFolder.resolve("recording.audio"), new byte[]{4});
        SpeakingRecordingFiles.delete(root.toString(), old); SpeakingRecordingFiles.delete(root.toString(), old);
        assertFalse(Files.exists(oldFolder)); assertTrue(Files.isDirectory(root));
        assertArrayEquals(new byte[]{4}, Files.readAllBytes(freshFolder.resolve("recording.audio")));
    }

    @Test public void invalidStorageKeysCannotDeleteTheRootOrItsNeighbours() throws Exception {
        Path root = files.newFolder("safe").toPath(), neighbour = files.newFile("keep.audio").toPath();
        for (String key : Arrays.asList("..", "../keep.audio", neighbour.toAbsolutePath().toString(), "", null)) {
            SpeakingRecording recording = recording(); recording.setStorageKey(key);
            try { SpeakingRecordingFiles.delete(root.toString(), recording); fail("Unsafe key accepted"); }
            catch (AccessDeniedException expected) {}
            assertTrue(Files.isDirectory(root)); assertTrue(Files.exists(neighbour));
        }
    }

    @Test public void cleanupUnlinksAnInternalSymlinkWithoutFollowingIt() throws Exception {
        Path root = files.newFolder("links").toPath(), outside = files.newFolder("outside").toPath();
        Path keep = Files.write(outside.resolve("keep.audio"), new byte[]{9}); SpeakingRecording recording = recording();
        Path target = SpeakingRecordingFiles.directory(root.toString(), recording, true);
        try { Files.createSymbolicLink(target.resolve("link"), outside); }
        catch (IOException | UnsupportedOperationException | SecurityException unsupported) {
            Assume.assumeNoException(unsupported);
        }
        SpeakingRecordingFiles.delete(root.toString(), recording);
        assertFalse(Files.exists(target)); assertArrayEquals(new byte[]{9}, Files.readAllBytes(keep));
    }

    @Test public void scheduledCleanupContinuesAfterOneFailureAndRetriesItOnTheNextRun() throws Exception {
        SpeakingRecordingService service = mock(SpeakingRecordingService.class);
        when(service.expiredRecordingIds()).thenReturn(Arrays.asList(1L, 2L, 3L));
        when(service.purgeExpiredRecording(1L)).thenThrow(new IOException("Disk unavailable")).thenReturn(true);
        when(service.purgeExpiredRecording(2L)).thenReturn(true); when(service.purgeExpiredRecording(3L)).thenReturn(false);
        SpeakingRecordingCleanup cleanup = new SpeakingRecordingCleanup(); ReflectionTestUtils.setField(cleanup, "recordings", service);
        assertEquals(1, cleanup.purgeExpired()); verify(service).purgeExpiredRecording(2L); verify(service).purgeExpiredRecording(3L);
        assertEquals(2, cleanup.purgeExpired()); verify(service, times(2)).purgeExpiredRecording(1L);
        Scheduled scheduled = SpeakingRecordingCleanup.class.getMethod("purgeExpired").getAnnotation(Scheduled.class);
        assertEquals(900000L, scheduled.fixedDelay()); assertEquals(60000L, scheduled.initialDelay());
    }

    @Test public void expiredAndQuotaErrorsHaveDistinctHttpStatusesAndMachineReadableCodes() throws Exception {
        RestSpeakingController controller = new RestSpeakingController();
        assertEquals(HttpStatus.GONE, RestSpeakingController.class.getMethod("recordingExpired", SpeakingRecordingPolicy.Expired.class).getAnnotation(ResponseStatus.class).value());
        assertEquals("SPEAKING_RECORDING_EXPIRED", controller.recordingExpired(new SpeakingRecordingPolicy.Expired()).get("code"));
        java.util.Map<String,Object> quota = SpeakingServiceImpl.map("remaining", 0);
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, RestSpeakingController.class.getMethod("recordingLimit", SpeakingRecordingPolicy.Limit.class).getAnnotation(ResponseStatus.class).value());
        assertSame(quota, controller.recordingLimit(new SpeakingRecordingPolicy.Limit(quota)).get("recordingQuota"));
    }
}
