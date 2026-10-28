package com.globits.richy.domain;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;
import javax.persistence.Version;
import org.hibernate.annotations.Check;
import org.hibernate.annotations.Type;
import org.joda.time.LocalDateTime;

/** One shared appearance setting for IELTS Room. */
@Entity
@Table(name = "tbl_site_theme")
@Check(constraints = "domain_name = 'ieltsroom.com' AND theme IN ('NORMAL', 'HALLOWEEN')")
public class SiteTheme {
    @Id
    @Column(name = "domain_name", length = 100, nullable = false)
    private String domainName = "ieltsroom.com";
    @Column(name = "theme", length = 16, nullable = false)
    private String theme = "HALLOWEEN";
    @Version
    @Column(name = "revision", nullable = false)
    private Long revision;
    @Column(name = "modified_by", length = 255)
    private String modifiedBy;
    @Column(name = "modify_date")
    @Type(type = "org.jadira.usertype.dateandtime.joda.PersistentLocalDateTime")
    private LocalDateTime modifyDate;

    public String getDomainName() { return domainName; }
    public void setDomainName(String value) { domainName = value; }
    public String getTheme() { return theme; }
    public void setTheme(String value) { theme = value; }
    public Long getRevision() { return revision; }
    public void setRevision(Long value) { revision = value; }
    public String getModifiedBy() { return modifiedBy; }
    public void setModifiedBy(String value) { modifiedBy = value; }
    public LocalDateTime getModifyDate() { return modifyDate; }
    public void setModifyDate(LocalDateTime value) { modifyDate = value; }
}
