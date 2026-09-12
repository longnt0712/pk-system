package com.globits.richy.dto;
import java.util.Date;
import com.globits.richy.domain.StudentMarkShare;
/** Management metadata. No stored token/hash is ever returned. */
public class StudentMarkShareDto {
    private Long id;
    private String relativeUrl,description;
    private boolean revoked;
    private Date createdAt;
    public StudentMarkShareDto(StudentMarkShare s) {
        id=s.getId();revoked=s.isRevoked();createdAt=s.getCreateDate().toDate();
        description=(s.getGroupId()==null?"Toàn lớp":"Ban/hội #"+s.getGroupId())
                +(s.getKeywordStudentName()==null?"":" · Tên/mã: "+s.getKeywordStudentName())
                +(s.getTextSearch()==null?"":" · Lọc: "+s.getTextSearch());
    }
    public Long getId(){return id;}public String getRelativeUrl(){return relativeUrl;}
    public void setRelativeUrl(String v){relativeUrl=v;}public String getDescription(){return description;}
    public boolean isRevoked(){return revoked;}public Date getCreatedAt(){return createdAt;}
}
