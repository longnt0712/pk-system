package com.globits.core.domain;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

@Entity
@Table(name = "tbl_degree_student") // xếp loại sinh viên
@XmlRootElement
public class DegreeStudent extends BaseObject {

	private static final long serialVersionUID = -2208752009903206352L;
	@Column(name = "name")
	private String name;
	@Column(name = "code")
	private String code;
	@Column(name = "min_mark")
	private Double minMark;
	@Column(name = "max_mark")
	private Double maxMark;

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

	public Double getMinMark() {
		return minMark;
	}

	public void setMinMark(Double minMark) {
		this.minMark = minMark;
	}

	public Double getMaxMark() {
		return maxMark;
	}

	public void setMaxMark(Double maxMark) {
		this.maxMark = maxMark;
	}

	public DegreeStudent() {

	}

	public DegreeStudent(DegreeStudent status) {
		super(status);
		this.name = status.getName();
		this.code = status.getCode();
		this.minMark = status.getMinMark();
		this.maxMark = status.getMaxMark();
	}
}
