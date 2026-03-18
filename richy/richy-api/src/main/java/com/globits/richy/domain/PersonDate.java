package com.globits.richy.domain;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import org.hibernate.annotations.Type;
import org.joda.time.LocalDateTime;

import com.globits.core.domain.BaseObject;
import com.globits.core.domain.Person;
import com.globits.security.domain.User;

@Entity
@Table(name = "tbl_person_date")
@XmlRootElement
public class PersonDate extends BaseObject{
	@ManyToOne
	@JoinColumn(name="user_id")
	private User user;

	@Column(name = "status_mass")
	private Integer statusMass;
	// 1: có đi lễ ; 2: không đi lễ; 3: muộn; 5: ca đoàn; 6: Phép (lễ)
	
	@Column(name = "status_class")
	private Integer statusClass;
	// 1: có đi học ; 2: không đi học; 3: muộn; 5: ca đoàn; 6: Phép (GL)
	
	@Column(name = "description")
	private String description;
	
	@Column(name = "time_go_to_church", nullable = true)
	@Type(type="org.jadira.usertype.dateandtime.joda.PersistentLocalDateTime")
	private LocalDateTime timeGoToChurch;
	
	@Column(name = "time_go_to_class", nullable = true)
	@Type(type="org.jadira.usertype.dateandtime.joda.PersistentLocalDateTime")
	private LocalDateTime timeGoToClass;

	public LocalDateTime getTimeGoToClass() {
		return timeGoToClass;
	}

	public void setTimeGoToClass(LocalDateTime timeGoToClass) {
		this.timeGoToClass = timeGoToClass;
	}

	public LocalDateTime getTimeGoToChurch() {
		return timeGoToChurch;
	}

	public void setTimeGoToChurch(LocalDateTime timeGoToChurch) {
		this.timeGoToChurch = timeGoToChurch;
	}

	public User getUser() {
		return user;
	}

	public void setUser(User user) {
		this.user = user;
	}

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
	
//	Điểm danh trong ngày thôi
//	tích 1 cái tạo mới 1 bản ghi luôn => createDate chính là giờ các em vào nhà thờ hoặc điểm danh vào lớp.
//  nếu đúng giờ trong khoảng quy định => status là 1
	
	
	
}
