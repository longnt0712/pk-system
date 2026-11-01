package com.globits.richy.domain;

import com.globits.core.domain.BaseObject;
import javax.persistence.*;

@Entity
@Table(name = "tbl_tntt_document_version")
public class TnttDocumentVersion extends BaseObject {
    @Column(name = "entry_id", nullable = false)
    public Long entryId;

    @Column(name = "entry_revision", nullable = false)
    public Long entryRevision;

    @Column(name = "actor_id", nullable = false)
    public Long actorId;

    @Column(name = "saved_at", nullable = false)
    public Long savedAt;

    @Column(nullable = false, length = 200)
    public String title;

    @Lob
    @Column(name = "notebook_json", columnDefinition = "nvarchar(max)")
    public String notebookJson;
}
