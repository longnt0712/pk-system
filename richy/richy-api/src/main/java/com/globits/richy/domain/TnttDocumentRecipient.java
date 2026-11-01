package com.globits.richy.domain;

import com.globits.core.domain.BaseObject;
import javax.persistence.*;

@Entity
@Table(
        name = "tbl_tntt_document_recipient",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_tntt_notice_user",
                        columnNames = {"notice_id", "user_id"}))
public class TnttDocumentRecipient extends BaseObject {
    @Column(name = "notice_id", nullable = false)
    public Long noticeId;

    @Column(name = "user_id", nullable = false)
    public Long userId;

    @Column(name = "read_at")
    public Long readAt;

    @Column(length = 250)
    public String email;

    @Column(name = "email_status", nullable = false, length = 24)
    public String emailStatus;

    @Column(name = "email_error", length = 500)
    public String emailError;

    @Column(name = "email_sent_at")
    public Long emailSentAt;

    @Version
    @Column(nullable = false)
    public Long revision;
}
