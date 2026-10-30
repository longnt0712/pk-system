package com.globits.richy.service.impl;

import java.time.Clock;
import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Deletes only expired checkpoints. The current student response is never deleted. */
@Service
public class SpeakingAnswerHistoryCleanup {
    @PersistenceContext private EntityManager em;
    private Clock historyClock=Clock.systemUTC();

    @Scheduled(initialDelay=60000,fixedDelay=3600000)
    @Transactional
    public int purgeExpired(){
        long cutoff=historyClock.millis()-14L*24*60*60*1000;
        return em.createQuery("delete from SpeakingStudentAnswerVersion v where v.updatedAt<:cutoff")
            .setParameter("cutoff",cutoff).executeUpdate();
    }
}
