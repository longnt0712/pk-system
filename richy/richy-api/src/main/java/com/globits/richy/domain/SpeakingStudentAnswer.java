package com.globits.richy.domain;

import com.globits.core.domain.BaseObject;
import javax.persistence.*;

/** Personal response for a canonical question. Never changes the shared sample. */
@Entity
@Table(name="tbl_speaking_student_answer", uniqueConstraints=@UniqueConstraint(name="uk_speaking_answer_student_question",columnNames={"student_id","question_id"}))
public class SpeakingStudentAnswer extends BaseObject {
    @Column(name="student_id",nullable=false) private Long studentId;
    @Column(name="question_id",nullable=false) private Long questionId;
    @Column(name="editor_id",nullable=false) private Long editorId;
    @Lob @Column(name="answer_html",columnDefinition="nvarchar(max)") private String html;
    @Lob @Column(name="notes_json",columnDefinition="nvarchar(max)") private String notesJson;
    @Version @Column(name="revision",nullable=false) private Long revision;
    public Long getStudentId(){return studentId;} public void setStudentId(Long v){studentId=v;}
    public Long getQuestionId(){return questionId;} public void setQuestionId(Long v){questionId=v;}
    public Long getEditorId(){return editorId;} public void setEditorId(Long v){editorId=v;}
    public String getHtml(){return html;} public void setHtml(String v){html=v;}
    public String getNotesJson(){return notesJson;} public void setNotesJson(String v){notesJson=v;}
    public Long getRevision(){return revision;} public void setRevision(Long v){revision=v;}
}
