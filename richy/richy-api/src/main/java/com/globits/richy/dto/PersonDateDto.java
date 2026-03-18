package com.globits.richy.dto;

import java.io.Serializable;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;

import org.joda.time.LocalDateTime;

import com.globits.core.dto.PersonDto;
import com.globits.richy.domain.PersonDate;
import com.globits.security.dto.UserDto;

public class PersonDateDto implements Serializable{
	private Long id;
//	private PersonDto person;
	private UserDto user;
	private Integer statusMass;
	// 1: có đi lễ ; 2: không đi lễ; 3: muộn; 5: ca đoàn; 6: Phép (lễ)
	private Integer statusClass;
	// 1: có đi học ; 2: không đi học; 3: muộn; 5: ca đoàn; 6: Phép (GL)

	private String description;
	private String textSearch;
	private Date createDate;
	private Date modifiedDate;
	private Date timeGoToChurch;
	private Date timeGoToClass;
	private Long groupId;

	private LocalDateTime startDate;
	private LocalDateTime endDate;
	
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
	public PersonDateDto() {
		
	}
	
	public PersonDateDto(PersonDate domain) {
		this.id = domain.getId();
		
		if(domain.getUser() != null) {
			UserDto userDto = new UserDto();
			userDto.setId(domain.getUser().getId());
			userDto.setUsername(domain.getUser().getUsername());
			if(domain.getUser().getPerson() != null) {
				userDto.setPerson(new PersonDto(domain.getUser().getPerson()));
			}
			this.setUser(userDto);
		}
		
		try {
			this.createDate = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss").parse(domain.getCreateDate().toString());
		} catch (ParseException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		
		try {
			this.modifiedDate = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss").parse(domain.getModifyDate().toString());
		} catch (ParseException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		
		try {
			if(domain.getTimeGoToChurch() != null) {
				this.timeGoToChurch = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss").parse(domain.getTimeGoToChurch().toString());	
			}
			if(domain.getTimeGoToClass() != null) {
				this.timeGoToClass = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss").parse(domain.getTimeGoToClass().toString());	
			}
		} catch (ParseException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		
		this.statusMass = domain.getStatusMass();
		this.statusClass = domain.getStatusClass();
		this.description = domain.getDescription();
	}
	
}
