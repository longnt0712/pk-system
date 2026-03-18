package com.globits.core.domain;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import org.hibernate.annotations.Type;
import org.hibernate.validator.constraints.Length;
import org.joda.time.LocalDateTime;
@Entity
@Table(name = "tbl_activity_log")
@XmlRootElement
public class ActivityLog extends BaseObject {
	private static final long serialVersionUID = 1L;
	
	@Column(name="module_log")
	private String moduleLog;
	
	@Column(name = "content_log",nullable = false, length=4000) 
	private String contentLog;
	@Column(name="log_type")
	private Integer logType;//Loại log. Sẽ có 1 danh sách các loại Log đưa vào 1 cái enum
	
	@Column(name = "log_date", nullable = true)
	@Type(type="org.jadira.usertype.dateandtime.joda.PersistentLocalDateTime")
	private LocalDateTime logDate;
	
	@Column(name = "user_name", nullable = true)
	private String userName;
	
	@Column(name = "entity_object_type", nullable = true)
	private String entityObjectType;
	
	public String getContentLog() {
		return contentLog;
	}
	public void setContentLog(String contentLog) {
		this.contentLog = contentLog;
	}
	public Integer getLogType() {
		return logType;
	}
	public void setLogType(Integer logType) {
		this.logType = logType;
	}
	public LocalDateTime getLogDate() {
		return logDate;
	}
	public void setLogDate(LocalDateTime logDate) {
		this.logDate = logDate;
	}
	public String getUserName() {
		return userName;
	}
	public void setUserName(String userName) {
		this.userName = userName;
	}
	public String getModuleLog() {
		return moduleLog;
	}
	public void setModuleLog(String moduleLog) {
		this.moduleLog = moduleLog;
	}
	public String getEntityObjectType() {
		return entityObjectType;
	}
	public void setEntityObjectType(String entityObjectType) {
		this.entityObjectType = entityObjectType;
	}
	
}
