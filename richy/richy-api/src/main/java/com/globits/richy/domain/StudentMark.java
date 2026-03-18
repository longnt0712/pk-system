package com.globits.richy.domain;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import com.globits.core.domain.BaseObject;
import com.globits.security.domain.User;

@Entity
@Table(name = "tbl_student_mark")
@XmlRootElement
public class StudentMark extends BaseObject{
	@ManyToOne
	@JoinColumn(name="user_id")
	private User user;
	
	@ManyToOne
	@JoinColumn(name="mark_id")
	private Mark mark;
	
//	//Điểm số
	@Column(name="mark_number")
	private Double markNumber;
//	
//	//Điểm chữ
	@Column(name="mark_text")
	private String markText;

	public User getUser() {
		return user;
	}

	public void setUser(User user) {
		this.user = user;
	}

	public Mark getMark() {
		return mark;
	}

	public void setMark(Mark mark) {
		this.mark = mark;
	}

	public Double getMarkNumber() {
		return markNumber;
	}

	public void setMarkNumber(Double markNumber) {
		this.markNumber = markNumber;
	}

	public String getMarkText() {
		return markText;
	}

	public void setMarkText(String markText) {
		this.markText = markText;
	}
	
}
