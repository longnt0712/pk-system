package com.globits.richy.dto;

import java.io.Serializable;
import java.util.Date;

import org.joda.time.LocalDateTime;

import com.globits.core.dto.PersonDto;
import com.globits.richy.domain.PersonDate;
import com.globits.richy.attendance.AttendanceRules;
import com.globits.security.dto.UserDto;
import com.fasterxml.jackson.annotation.JsonInclude;

public class PersonDateDto implements Serializable{
	private Long id;
//	private PersonDto person;
	private UserDto user;
	private Integer schoolId;
	private Long attendanceClassId;
	private Integer statusMass;
	// 1: có đi lễ ; 2: không đi lễ; 3: muộn; 5: ca đoàn; 6: Phép (lễ)
	private Integer statusClass;
	// 1: có đi học ; 2: không đi học; 3: muộn; 5: ca đoàn; 6: Phép (GL)
	private Integer makeupMinutes;
	private Integer extraClass;
	// 1: có đi học ; 2: không đi học; 3: muộn; 5: ca đoàn; 6: Phép (NK)

	private String description;
	private String modifiedBy;
	private String textSearch;
	private Date createDate;
	private Date modifiedDate;
	private Date timeGoToChurch;
	private Date timeGoToClass;
	private Long groupId;
	private Date timeGoToExtraClass;
	private Boolean qrAlreadyRecorded;


	private LocalDateTime startDate;
	private LocalDateTime endDate;
	
	public String getModifiedBy() {
		return modifiedBy;
	}
	public void setModifiedBy(String modifiedBy) {
		this.modifiedBy = modifiedBy;
	}
	public Integer getExtraClass() {
		return extraClass;
	}
	public void setExtraClass(Integer extraClass) {
		this.extraClass = extraClass;
	}
	
	public Date getTimeGoToExtraClass() {
		return timeGoToExtraClass;
	}
	public void setTimeGoToExtraClass(Date timeGoToExtraClass) {
		this.timeGoToExtraClass = timeGoToExtraClass;
	}
	public Long getGroupId() {
		return groupId;
	}
	public void setGroupId(Long groupId) {
		this.groupId = groupId;
	}
	public Date getTimeGoToClass() {
		return timeGoToClass;
	}
	public void setTimeGoToClass(Date timeGoToClass) {
		this.timeGoToClass = timeGoToClass;
	}
	public Date getTimeGoToChurch() {
		return timeGoToChurch;
	}
	public void setTimeGoToChurch(Date timeGoToChurch) {
		this.timeGoToChurch = timeGoToChurch;
	}
	public Date getModifiedDate() {
		return modifiedDate;
	}
	public void setModifiedDate(Date modifiedDate) {
		this.modifiedDate = modifiedDate;
	}
	public LocalDateTime getStartDate() {
		return startDate;
	}
	public void setStartDate(LocalDateTime startDate) {
		this.startDate = startDate;
	}
	public LocalDateTime getEndDate() {
		return endDate;
	}
	public void setEndDate(LocalDateTime endDate) {
		this.endDate = endDate;
	}
	public Long getId() {
		return id;
	}
	public void setId(Long id) {
		this.id = id;
	}
	
	public UserDto getUser() {
		return user;
	}
	public void setUser(UserDto user) {
		this.user = user;
	}
	public Integer getSchoolId() { return schoolId; }
	public void setSchoolId(Integer value) { schoolId = value; }
	public Long getAttendanceClassId() { return attendanceClassId; }
	public void setAttendanceClassId(Long value) { attendanceClassId = value; }
//	public PersonDto getPerson() {
//		return person;
//	}
//	public void setPerson(PersonDto person) {
//		this.person = person;
//	}
	public Integer getStatusMass() {
		return statusMass;
	}
	public void setStatusMass(Integer statusMass) {
		this.statusMass = statusMass;
	}
	public Integer getStatusClass() {
		return statusClass;
	}
	public void setStatusClass(Integer statusClass) {
		this.statusClass = statusClass;
	}
	public Integer getMakeupMinutes() {
		return makeupMinutes;
	}
	public void setMakeupMinutes(Integer makeupMinutes) {
		this.makeupMinutes = makeupMinutes;
	}
	public String getDescription() {
		return description;
	}
	public void setDescription(String description) {
		this.description = description;
	}
	public String getTextSearch() {
		return textSearch;
	}
	public void setTextSearch(String textSearch) {
		this.textSearch = textSearch;
	}
	
	public Date getCreateDate() {
		return createDate;
	}
	public void setCreateDate(Date createDate) {
		this.createDate = createDate;
	}
	@JsonInclude(JsonInclude.Include.NON_NULL)
	public Boolean getQrAlreadyRecorded() {
		return qrAlreadyRecorded;
	}
	public void setQrAlreadyRecorded(Boolean qrAlreadyRecorded) {
		this.qrAlreadyRecorded = qrAlreadyRecorded;
	}
	public PersonDateDto() {
		
	}
	
	public PersonDateDto(PersonDate domain) {
		this.id = domain.getId();
		this.schoolId = domain.getSchoolId();
		this.attendanceClassId = domain.getAttendanceClassId();
		
		if(domain.getUser() != null) {
			UserDto userDto = new UserDto();
			userDto.setId(domain.getUser().getId());
			userDto.setUsername(domain.getUser().getUsername());
			if(domain.getUser().getPerson() != null) {
				userDto.setPerson(new PersonDto(domain.getUser().getPerson()));
			}
			this.setUser(userDto);
		}
		
		this.createDate = attendanceDate(domain.getCreateDate());
		this.modifiedDate = attendanceDate(domain.getModifyDate());
		this.timeGoToChurch = attendanceDate(domain.getTimeGoToChurch());
		this.timeGoToClass = attendanceDate(domain.getTimeGoToClass());
		this.timeGoToExtraClass = attendanceDate(domain.getTimeGoToExtraClass());
		
		this.statusMass = domain.getStatusMass();
		this.statusClass = domain.getStatusClass();
		this.makeupMinutes = domain.getMakeupMinutes();
		this.extraClass = domain.getExtraClass();
		this.description = domain.getDescription();
		this.modifiedBy = domain.getModifiedBy();
	}

	private static Date attendanceDate(LocalDateTime value) {
		return value == null ? null : value.toDate(AttendanceRules.TIME_ZONE.toTimeZone());
	}
	
}
