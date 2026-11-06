package com.globits.richy.service.impl;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/** Each recording has its own transaction; one disk error never rolls back the batch. */
@Service
public class SpeakingRecordingCleanup {
    private static final Logger LOG = LoggerFactory.getLogger(SpeakingRecordingCleanup.class);
    @Autowired private SpeakingRecordingService recordings;

    @Scheduled(initialDelay = 60000, fixedDelay = 900000)
    public int purgeExpired() {
        int removed = 0;
        for (Long id : recordings.expiredRecordingIds()) {
            try {
                if (recordings.purgeExpiredRecording(id)) { removed++; }
            } catch (Exception error) {
                LOG.warn("Could not clean up expired Speaking recording {}; will retry", id, error);
            }
        }
        return removed;
    }
}
