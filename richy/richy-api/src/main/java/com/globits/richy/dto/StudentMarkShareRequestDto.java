package com.globits.richy.dto;
import java.io.Serializable;
public class StudentMarkShareRequestDto implements Serializable {
    private static final long serialVersionUID=1L;
    private Integer enrollmentClass;
    private Long educationProgramId,groupId;
    private String textSearch,keywordStudentName;
    public Integer getEnrollmentClass(){return enrollmentClass;}public void setEnrollmentClass(Integer v){enrollmentClass=v;}
    public Long getEducationProgramId(){return educationProgramId;}public void setEducationProgramId(Long v){educationProgramId=v;}
    public Long getGroupId(){return groupId;}public void setGroupId(Long v){groupId=v;}
    public String getTextSearch(){return textSearch;}public void setTextSearch(String v){textSearch=v;}
    public String getKeywordStudentName(){return keywordStudentName;}public void setKeywordStudentName(String v){keywordStudentName=v;}
}
