package com.globits.richy.domain;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.JoinColumn;
import javax.persistence.Lob;
import javax.persistence.ManyToOne;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import com.globits.core.domain.BaseObject;
import com.globits.core.domain.Organization;

@Entity
@Table(name = "tbl_mark")
@XmlRootElement
public class Mark extends BaseObject{
	@Lob
	@Column(name="name")
	private String name;
	
	@Lob
	@Column(name="code")
	private String code;
	
//	//hệ số
	@Column(name="coefficient")
	private Integer coefficient;

	/**
	 * Thứ tự hiển thị của đầu điểm trong màn hình student_marks.
	 * Giá trị nhỏ hơn được hiển thị trước.
	 */
	@Column(name="display_order")
	private Integer displayOrder;
//	
//	//Điểm số
//	@Column(name="mark_number")
//	private Double markNumber;
//	
//	//Điểm chữ
//	@Column(name="mark_text")
//	private String markText;
	
	@Lob
	@Column(name="description")
	private String description;
	
	@ManyToOne
	@JoinColumn(name="education_program")
	private EducationProgram educationProgram;
	
//	public Double getMarkNumber() {
//		return markNumber;
//	}
//
//	public void setMarkNumber(Double markNumber) {
//		this.markNumber = markNumber;
//	}

//	public String getMarkText() {
//		return markText;
//	}
//
//	public void setMarkText(String markText) {
//		this.markText = markText;
//	}

	public Integer getCoefficient() {
		return coefficient;
	}

	public void setCoefficient(Integer coefficient) {
		this.coefficient = coefficient;
	}

	public Integer getDisplayOrder() {
		return displayOrder;
	}

	public void setDisplayOrder(Integer displayOrder) {
		this.displayOrder = displayOrder;
	}

	public EducationProgram getEducationProgram() {
		return educationProgram;
	}

	public void setEducationProgram(EducationProgram educationProgram) {
		this.educationProgram = educationProgram;
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

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}
	
}
