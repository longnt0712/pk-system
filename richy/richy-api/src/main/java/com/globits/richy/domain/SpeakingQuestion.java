package com.globits.richy.domain;

import com.globits.core.domain.BaseObject;
import javax.persistence.*;

@Entity
@Table(name="tbl_speaking_question", uniqueConstraints=@UniqueConstraint(name="uk_speaking_question_owner_content", columnNames={"owner_id","content_key"}))
public class SpeakingQuestion extends BaseObject {
    @Column(name="owner_id", nullable=false)
    private Long ownerId;
    @Column(name="part", nullable=false)
    private Integer part;
    @Column(name="topic", length=300, nullable=false)
    private String topic;
    @Lob
    @Column(name="prompt")
    private String prompt;
    @Lob
    @Column(name="sample")
    private String sample;
    @Column(name="content_key", length=64, nullable=false)
    private String contentKey;
    @Version
    @Column(name="revision")
    private Long revision;
    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long value) { ownerId = value; }
    public Integer getPart() { return part; }
    public void setPart(Integer value) { part = value; }
    public String getTopic() { return topic; }
    public void setTopic(String value) { topic = value; }
    public String getPrompt() { return prompt; }
    public void setPrompt(String value) { prompt = value; }
    public String getSample() { return sample; }
    public void setSample(String value) { sample = value; }
    public String getContentKey() { return contentKey; }
    public void setContentKey(String value) { contentKey = value; }
    public Long getRevision() { return revision; }
    public void setRevision(Long value) { revision = value; }
}
