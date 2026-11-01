package com.globits.richy.service.impl;

import java.util.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class TnttDocumentEmailWorker {
    private static final Logger LOG = LoggerFactory.getLogger(TnttDocumentEmailWorker.class);
    @Autowired private TnttDocumentService service;
    @Autowired private TnttDocumentMail mail;

    @Scheduled(initialDelay = 60000, fixedDelay = 60000)
    public void deliver() {
        try {
            for (Map<String, Object> job : service.claimEmails()) {
                Long id = (Long) job.get("noticeId");
                String email = (String) job.get("email");
                boolean sent = false;
                try {
                    if (service.emailStillAllowed(id)) {
                        mail.send(
                                email,
                                (String) job.get("title"),
                                (String) job.get("summary"),
                                "notice-" + id);
                        sent = true;
                    }
                } catch (RuntimeException error) {
                    LOG.warn("TNTT notification email could not be confirmed for notice {}", id);
                }
                service.emailResult(id, email, sent);
            }
        } catch (RuntimeException error) {
            LOG.warn(
                    "TNTT notification email queue is unavailable; no automatic retry of uncertain deliveries");
        }
    }
}
