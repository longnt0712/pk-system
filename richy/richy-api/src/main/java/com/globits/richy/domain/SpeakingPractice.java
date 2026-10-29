package com.globits.richy.domain;

import com.globits.core.domain.BaseObject;
import javax.persistence.*;

@Entity
@Table(name="tbl_speaking_practice", uniqueConstraints=@UniqueConstraint(name="uk_speaking_practice_student_attempt", columnNames={"student_id","client_key"}))
public class SpeakingPractice extends BaseObject {
    @Column(name="student_id", nullable=false)
    private Long studentId;
    @Column(name="bank_owner_id", nullable=false)
    private Long bankOwnerId;
    @Column(name="client_key", length=80, nullable=false)
    private String clientKey;
    @Column(name="status", length=20, nullable=false)
    private String status;
    @Lob
    @Column(name="snapshot_json")
    private String snapshotJson;
    @Column(name="current_index", nullable=false)
    private Integer currentIndex;
    @Column(name="elapsed_seconds", nullable=false)
    private Long elapsedSeconds;
    @Column(name="ai_status", length=20, nullable=false)
    private String aiStatus;
    public Long getStudentId() { return studentId; }
    public void setStudentId(Long value) { studentId = value; }
    public Long getBankOwnerId() { return bankOwnerId; }
    public void setBankOwnerId(Long value) { bankOwnerId = value; }
    public String getClientKey() { return clientKey; }
    public void setClientKey(String value) { clientKey = value; }
    public String getStatus() { return status; }
    public void setStatus(String value) { status = value; }
    public String getSnapshotJson() { return snapshotJson; }
    public void setSnapshotJson(String value) { snapshotJson = value; }
    public Integer getCurrentIndex() { return currentIndex; }
    public void setCurrentIndex(Integer value) { currentIndex = value; }
    public Long getElapsedSeconds() { return elapsedSeconds; }
    public void setElapsedSeconds(Long value) { elapsedSeconds = value; }
    public String getAiStatus() { return aiStatus; }
    public void setAiStatus(String value) { aiStatus = value; }
}
