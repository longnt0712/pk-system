package com.globits.richy.domain;

import com.globits.core.domain.BaseObject;
import javax.persistence.*;

@Entity
@Table(name = "tbl_tntt_document_entry")
public class TnttDocumentEntry extends BaseObject {
    @Column(nullable = false, length = 200)
    public String title;

    @Column(nullable = false, length = 20)
    public String kind;

    @Column(name = "parent_id")
    public Long parentId;

    @Column(name = "creator_id", nullable = false)
    public Long creatorId;

    @Column(name = "editor_id", nullable = false)
    public Long editorId;

    @Column(name = "updated_at", nullable = false)
    public Long updatedAt;

    @Column(nullable = false)
    public boolean archived;

    @Column(nullable = false)
    public boolean shared;

    @Column(name = "notice_id")
    public Long noticeId;

    @Lob
    @Column(name = "notebook_json", columnDefinition = "nvarchar(max)")
    public String notebookJson;

    @Version
    @Column(nullable = false)
    public Long revision;
}
