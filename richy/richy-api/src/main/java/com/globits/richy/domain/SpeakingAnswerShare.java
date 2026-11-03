package com.globits.richy.domain;

import com.globits.core.domain.BaseObject;
import javax.persistence.*;

@Entity
@Table(name="tbl_speaking_answer_share")
public class SpeakingAnswerShare extends BaseObject {
    @Column(name="set_id",nullable=false) private Long setId;
    @Column(name="student_id",nullable=false) private Long studentId;
    @Column(name="creator_id",nullable=false) private Long creatorId;
    @Column(name="permission",nullable=false,length=8) private String permission;
    @Column(name="token_hash",nullable=false,length=64,unique=true) private String tokenHash;
    @Column(name="revoked",nullable=false) private boolean revoked;
    public Long getSetId(){return setId;} public void setSetId(Long v){setId=v;}
    public Long getStudentId(){return studentId;} public void setStudentId(Long v){studentId=v;}
    public Long getCreatorId(){return creatorId;} public void setCreatorId(Long v){creatorId=v;}
    public String getPermission(){return permission;} public void setPermission(String v){permission=v;}
    public String getTokenHash(){return tokenHash;} public void setTokenHash(String v){tokenHash=v;}
    public boolean isRevoked(){return revoked;} public void setRevoked(boolean v){revoked=v;}
}
