package com.globits.richy.domain;

import com.globits.core.domain.BaseObject;
import javax.persistence.*;

@Entity
@Table(name="tbl_speaking_pass", uniqueConstraints=@UniqueConstraint(name="uk_speaking_pass_student_question", columnNames={"student_id","question_id"}))
public class SpeakingPass extends BaseObject {
    @Column(name="student_id", nullable=false)
    private Long studentId;
    @Column(name="question_id", nullable=false)
    private Long questionId;
    @Column(name="teacher_id", nullable=false)
    private Long teacherId;
    @Column(name="passed", nullable=false)
    private Boolean passed;
    @Column(name="note", length=1000)
    private String note;
    public Long getStudentId() { return studentId; }
    public void setStudentId(Long value) { studentId = value; }
    public Long getQuestionId() { return questionId; }
    public void setQuestionId(Long value) { questionId = value; }
    public Long getTeacherId() { return teacherId; }
    public void setTeacherId(Long value) { teacherId = value; }
    public Boolean getPassed() { return passed; }
    public void setPassed(Boolean value) { passed = value; }
    public String getNote() { return note; }
    public void setNote(String value) { note = value; }
}
