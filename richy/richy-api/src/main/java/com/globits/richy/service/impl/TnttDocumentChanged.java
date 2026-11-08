package com.globits.richy.service.impl;

import org.springframework.context.ApplicationEvent;

/** A committed revision hint; document content and OAuth tokens never enter the socket topic. */
public final class TnttDocumentChanged extends ApplicationEvent {
    public final Long documentId, revision;

    public TnttDocumentChanged(Object source, Long documentId, Long revision) {
        super(source);
        this.documentId = documentId;
        this.revision = revision;
    }
}
