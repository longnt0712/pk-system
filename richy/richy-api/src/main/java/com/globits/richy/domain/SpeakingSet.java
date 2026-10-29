package com.globits.richy.domain;

import com.globits.core.domain.BaseObject;
import javax.persistence.*;

@Entity
@Table(name="tbl_speaking_set", uniqueConstraints=@UniqueConstraint(name="uk_speaking_set_owner_period", columnNames={"owner_id","season_year","set_number"}))
public class SpeakingSet extends BaseObject {
    @Column(name="owner_id", nullable=false)
    private Long ownerId;
    @Column(name="season_year", nullable=false)
    private Integer seasonYear;
    @Column(name="set_number", nullable=false)
    private Integer setNumber;
    @Column(name="name", length=200, nullable=false)
    private String name;
    @Lob
    @Column(name="class_ids")
    private String classIdsJson;
    @Lob
    @Column(name="student_ids")
    private String studentIdsJson;
    @Column(name="import_token", length=40)
    private String importToken;
    @Lob
    @Column(name="import_rows")
    private String importRowsJson;
    @Version
    @Column(name="revision")
    private Long revision;
    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long value) { ownerId = value; }
    public Integer getSeasonYear() { return seasonYear; }
    public void setSeasonYear(Integer value) { seasonYear = value; }
    public Integer getSetNumber() { return setNumber; }
    public void setSetNumber(Integer value) { setNumber = value; }
    public String getName() { return name; }
    public void setName(String value) { name = value; }
    public String getClassIdsJson() { return classIdsJson; }
    public void setClassIdsJson(String value) { classIdsJson = value; }
    public String getStudentIdsJson() { return studentIdsJson; }
    public void setStudentIdsJson(String value) { studentIdsJson = value; }
    public String getImportToken() { return importToken; }
    public void setImportToken(String value) { importToken = value; }
    public String getImportRowsJson() { return importRowsJson; }
    public void setImportRowsJson(String value) { importRowsJson = value; }
    public Long getRevision() { return revision; }
    public void setRevision(Long value) { revision = value; }
}
