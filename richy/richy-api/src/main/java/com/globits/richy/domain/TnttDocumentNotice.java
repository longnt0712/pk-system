package com.globits.richy.domain;

import com.globits.core.domain.BaseObject;
import javax.persistence.*;

@Entity
@Table(
        name = "tbl_tntt_document_notice",
        uniqueConstraints =
                @UniqueConstraint(name = "uk_tntt_notice_request", columnNames = "request_key"))
public class TnttDocumentNotice extends BaseObject {
    @Column(name = "entry_id", nullable = false)
    public Long entryId;

    @Column(name = "request_key", nullable = false, length = 36)
    public String requestKey;

    @Column(nullable = false, length = 200)
    public String title;

    @Column(length = 1000)
    public String summary;

    @Column(name = "starts_at", nullable = false)
    public Long startsAt;

    @Column(name = "ends_at", nullable = false)
    public Long endsAt;

    @Column(name = "published_at", nullable = false)
    public Long publishedAt;

    @Column(name = "publisher_id", nullable = false)
    public Long publisherId;

    @Column(nullable = false)
    public boolean disabled;

    @Lob
    @Column(name = "notebook_json", columnDefinition = "nvarchar(max)")
    public String notebookJson;
}
