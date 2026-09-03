package com.globits.richy.domain;

import java.util.HashSet;
import java.util.Set;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.JoinColumn;
import javax.persistence.JoinTable;
import javax.persistence.Lob;
import javax.persistence.ManyToOne;
import javax.persistence.ManyToMany;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import com.globits.core.domain.BaseObject;
import com.globits.security.domain.User;

@Entity
@Table(name = "tbl_enrolment_class")
@XmlRootElement
public class EnrolmentClass extends BaseObject{
	@Lob
	@Column(name="name")
	private String name;
	
	@Lob
	@Column(name="code")
	private String code;
	
	@Column(name="school_id")
	private Integer schoolId;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "parent_id")
	private EnrolmentClass parent;

	@ManyToMany(fetch = FetchType.LAZY)
	@JoinTable(name = "tbl_enrolment_class_teacher",
			joinColumns = @JoinColumn(name = "enrolment_class_id"),
			inverseJoinColumns = @JoinColumn(name = "user_id"))
	private Set<User> teachers = new HashSet<User>();

	public Integer getSchoolId() {
		return schoolId;
	}

	public void setSchoolId(Integer schoolId) {
		this.schoolId = schoolId;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getCode() {
		return code;
	}

	public void setCode(String code) {
		this.code = code;
	}

	public EnrolmentClass getParent() {
		return parent;
	}

	public void setParent(EnrolmentClass parent) {
		this.parent = parent;
	}

	public Set<User> getTeachers() {
		return teachers;
	}

	public void setTeachers(Set<User> teachers) {
		this.teachers = teachers;
	}
	
}
