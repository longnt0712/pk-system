package com.globits.richy.domain;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Table;
import com.globits.core.domain.BaseObject;

@Entity
@Table(name="tbl_student_mark_share")
public class StudentMarkShare extends BaseObject {
    @Column(name="token_hash",length=64,nullable=false,unique=true)
    private String tokenHash;
    @Column(name="enrolment_class_id",nullable=false)
    private Integer enrollmentClass;
    @Column(name="education_program_id",nullable=false)
    private Long educationProgramId;
    @Column(name="group_id")
    private Long groupId;
    @Column(name="text_search",length=200,columnDefinition="nvarchar(200)")
    private String textSearch;
    @Column(name="name_keyword",length=200,columnDefinition="nvarchar(200)")
    private String keywordStudentName;
    @Column(name="hostname",length=100,nullable=false)
    private String hostname;
    @Column(name="owner_user_id",nullable=false)
    private Long ownerUserId;
    @Column(name="revoked",nullable=false)
    private boolean revoked;
    public String getTokenHash(){return tokenHash;}public void setTokenHash(String v){tokenHash=v;}
    public Integer getEnrollmentClass(){return enrollmentClass;}public void setEnrollmentClass(Integer v){enrollmentClass=v;}
    public Long getEducationProgramId(){return educationProgramId;}public void setEducationProgramId(Long v){educationProgramId=v;}
    public Long getGroupId(){return groupId;}public void setGroupId(Long v){groupId=v;}
    public String getTextSearch(){return textSearch;}public void setTextSearch(String v){textSearch=v;}
    public String getKeywordStudentName(){return keywordStudentName;}public void setKeywordStudentName(String v){keywordStudentName=v;}
    public String getHostname(){return hostname;}public void setHostname(String v){hostname=v;}
    public Long getOwnerUserId(){return ownerUserId;}public void setOwnerUserId(Long v){ownerUserId=v;}
    public boolean isRevoked(){return revoked;}public void setRevoked(boolean v){revoked=v;}
}
