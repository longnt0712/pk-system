package com.globits.richy.domain;

import com.globits.core.domain.BaseObject;
import javax.persistence.*;

/** A bounded checkpoint of one student's response, annotations and shared paper. */
@Entity
@Table(name="tbl_speaking_answer_version", indexes=@Index(name="ix_speaking_answer_version_answer",columnList="answer_id,id"))
public class SpeakingStudentAnswerVersion extends BaseObject {
    @Column(name="answer_id",nullable=false) private Long answerId;
    @ManyToOne(fetch=FetchType.LAZY)
    @JoinColumn(name="answer_id",insertable=false,updatable=false,foreignKey=@ForeignKey(name="fk_speaking_answer_version_answer"))
    private SpeakingStudentAnswer answer;
    @Column(name="answer_revision",nullable=false) private Long answerRevision;
    @Column(name="editor_id",nullable=false) private Long editorId;
    @Column(name="source",nullable=false,length=20) private String source;
    @Column(name="started_at",nullable=false) private Long startedAt;
    @Column(name="updated_at",nullable=false) private Long updatedAt;
    @Column(name="source_version_id") private Long sourceVersionId;
    @Column(name="source_version_revision") private Long sourceVersionRevision;
    @Lob @Column(name="answer_html",columnDefinition="nvarchar(max)") private String html;
    @Lob @Column(name="notes_json",columnDefinition="nvarchar(max)") private String notesJson;
    @Lob @Column(name="notebook_json",columnDefinition="nvarchar(max)") private String notebookJson;
    public Long getAnswerId(){return answerId;} public void setAnswerId(Long v){answerId=v;}
    public Long getAnswerRevision(){return answerRevision;} public void setAnswerRevision(Long v){answerRevision=v;}
    public Long getEditorId(){return editorId;} public void setEditorId(Long v){editorId=v;}
    public String getSource(){return source;} public void setSource(String v){source=v;}
    public Long getStartedAt(){return startedAt;} public void setStartedAt(Long v){startedAt=v;}
    public Long getUpdatedAt(){return updatedAt;} public void setUpdatedAt(Long v){updatedAt=v;}
    public Long getSourceVersionId(){return sourceVersionId;} public void setSourceVersionId(Long v){sourceVersionId=v;}
    public Long getSourceVersionRevision(){return sourceVersionRevision;} public void setSourceVersionRevision(Long v){sourceVersionRevision=v;}
    public String getHtml(){return html;} public void setHtml(String v){html=v;}
    public String getNotesJson(){return notesJson;} public void setNotesJson(String v){notesJson=v;}
    public String getNotebookJson(){return notebookJson;} public void setNotebookJson(String v){notebookJson=v;}
}
