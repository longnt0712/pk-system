package com.globits.richy.domain;

import com.globits.core.domain.BaseObject;
import javax.persistence.*;

@Entity
@Table(name="tbl_speaking_set_entry", uniqueConstraints=@UniqueConstraint(name="uk_speaking_entry_set_key", columnNames={"set_id","entry_key"}))
public class SpeakingSetEntry extends BaseObject {
    @Column(name="linked_part2_id")
    private Long linkedPart2Id;
    public Long getLinkedPart2Id() { return linkedPart2Id; }
    public void setLinkedPart2Id(Long value) { linkedPart2Id = value; }
    @Lob
    @Column(name="sample")
    private String sample;
    public String getSample() { return sample; }
    public void setSample(String value) { sample = value; }
    @Column(name="set_id", nullable=false)
    private Long setId;
    @Column(name="question_id", nullable=false)
    private Long questionId;
    @Column(name="entry_key", length=64, nullable=false)
    private String entryKey;
    @Column(name="import_code", length=100, nullable=false)
    private String importCode;
    public Long getSetId() { return setId; }
    public void setSetId(Long value) { setId = value; }
    public Long getQuestionId() { return questionId; }
    public void setQuestionId(Long value) { questionId = value; }
    public String getEntryKey() { return entryKey; }
    public void setEntryKey(String value) { entryKey = value; }
    public String getImportCode() { return importCode; }
    public void setImportCode(String value) { importCode = value; }
}
