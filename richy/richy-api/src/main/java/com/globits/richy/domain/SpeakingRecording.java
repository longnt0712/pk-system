package com.globits.richy.domain;

import com.globits.core.domain.BaseObject;
import javax.persistence.*;

@Entity
@Table(name="tbl_speaking_recording", uniqueConstraints=@UniqueConstraint(name="uk_speaking_recording_session_upload", columnNames={"practice_id","upload_key"}))
public class SpeakingRecording extends BaseObject {
    @Column(name="sha256", length=64)
    private String sha256;
    public String getSha256() { return sha256; }
    public void setSha256(String value) { sha256 = value; }
    @Column(name="practice_id", nullable=false)
    private Long practiceId;
    @Column(name="student_id", nullable=false)
    private Long studentId;
    @Column(name="upload_key", length=80, nullable=false)
    private String uploadKey;
    @Column(name="storage_key", length=40, nullable=false)
    private String storageKey;
    @Column(name="content_type", length=60, nullable=false)
    private String contentType;
    @Lob
    @Column(name="chunks_json")
    private String chunksJson;
    @Column(name="complete", nullable=false)
    private Boolean complete;
    @Column(name="byte_count", nullable=false)
    private Long byteCount;
    @Column(name="question_index", nullable=false)
    private Integer questionIndex;
    public Long getPracticeId() { return practiceId; }
    public void setPracticeId(Long value) { practiceId = value; }
    public Long getStudentId() { return studentId; }
    public void setStudentId(Long value) { studentId = value; }
    public String getUploadKey() { return uploadKey; }
    public void setUploadKey(String value) { uploadKey = value; }
    public String getStorageKey() { return storageKey; }
    public void setStorageKey(String value) { storageKey = value; }
    public String getContentType() { return contentType; }
    public void setContentType(String value) { contentType = value; }
    public String getChunksJson() { return chunksJson; }
    public void setChunksJson(String value) { chunksJson = value; }
    public Boolean getComplete() { return complete; }
    public void setComplete(Boolean value) { complete = value; }
    public Long getByteCount() { return byteCount; }
    public void setByteCount(Long value) { byteCount = value; }
    public Integer getQuestionIndex() { return questionIndex; }
    public void setQuestionIndex(Integer value) { questionIndex = value; }
}
