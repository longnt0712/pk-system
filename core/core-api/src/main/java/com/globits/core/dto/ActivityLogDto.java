package com.globits.core.dto;

import javax.persistence.Column;

import org.joda.time.LocalDateTime;

import com.globits.core.domain.ActivityLog;

public class ActivityLogDto extends BaseObjectDto {
	private static final long serialVersionUID = 8105433379515439581L;
	private String contentLog;
	private Integer logType;//Loại log. Sẽ có 1 danh sách các loại Log đưa vào 1 cái enum
	private String userName;
	private LocalDateTime logDate;
	
	private String moduleLog;
	
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
	public String getUserName() {
		return userName;
	}
	public void setUserName(String userName) {
		this.userName = userName;
	}
	public LocalDateTime getLogDate() {
		return logDate;
	}
	public void setLogDate(LocalDateTime logDate) {
		this.logDate = logDate;
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
	public ActivityLogDto() {
		
	}
	public ActivityLogDto(ActivityLog entity) {
		this.contentLog = entity.getContentLog();
		this.userName = entity.getUserName();
		this.setId(entity.getId());
		this.logType = entity.getLogType();
		this.moduleLog = entity.getModuleLog();
		this.logDate = entity.getLogDate();
		this.entityObjectType = entity.getEntityObjectType();
	}
	
	public ActivityLog toEntity() {
		ActivityLog entity = new ActivityLog();
		entity.setContentLog(contentLog);
		entity.setId(this.getId());
		entity.setLogDate(logDate);
		entity.setLogType(logType);
		entity.setUserName(userName);
		entity.setEntityObjectType(entityObjectType);
		entity.setModuleLog(moduleLog);
		return entity;
	}
	
}
