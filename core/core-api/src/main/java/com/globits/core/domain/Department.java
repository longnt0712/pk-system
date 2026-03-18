package com.globits.core.domain;

import java.util.Set;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.OneToMany;
import javax.persistence.OrderBy;
import javax.persistence.Table;
import javax.persistence.Transient;

import com.fasterxml.jackson.annotation.JsonIgnore;

/**
 * @author dunghq Danh mục phòng ban
 */
@Entity
@Table(name = "tbl_department")
public class Department extends BaseObject {
	private static final long serialVersionUID = -9125802218804078724L;
	private String name;
	private String code;
	@Column(name = "department_type")
	private int departmentType;

	@ManyToOne(fetch = FetchType.EAGER)
	@JoinColumn(name = "parent_id")
	private Department parent;
	@JsonIgnore
	@OneToMany(mappedBy = "parent")
	@OrderBy(value = "displayOrder ASC")
	private Set<Department> subDepartments;
	
	@Column(name="display_order")
	private String displayOrder;
	
	@Column(name="level")
	private Integer level;
	@Column(name="line_path")
	private String linePath;//Đường dẫn theo cấu trúc cây. Ví dụ : id của cha là 1, id của con là 6 thì linePath="1/5". Phục vụ mục đích search
	
	@Column(name="short_name")
	private String shortName;
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

	public Department getParent() {
		return parent;
	}

	public void setParent(Department parent) {
		this.parent = parent;
	}

	public Set<Department> getSubDepartments() {
		return subDepartments;
	}

	public void setSubDepartments(Set<Department> subDepartments) {
		this.subDepartments = subDepartments;
	}

	public int getDepartmentType() {
		return departmentType;
	}

	public void setDepartmentType(int departmentType) {
		this.departmentType = departmentType;
	}

	public Integer getLevel() {
		return level;
	}

	public void setLevel(Integer level) {
		this.level = level;
	}



	public String getDisplayOrder() {
		return displayOrder;
	}

	public void setDisplayOrder(String displayOrder) {
		this.displayOrder = displayOrder;
	}

	public String getLinePath() {
		return linePath;
	}

	public void setLinePath(String linePath) {
		this.linePath = linePath;
	}

	public String getShortName() {
		return shortName;
	}

	public void setShortName(String shortName) {
		this.shortName = shortName;
	}

	public Department() {

	}

	public Department(Long id, String name, String code, int departmentType) {
		this.setId(id);
		this.setCode(code);
		this.setName(name);
		this.setDepartmentType(departmentType);
	}

	public Department(Department dp) {
		if (dp != null) {
			this.setId(dp.getId());
			this.name = dp.getName();
			this.code = dp.getCode();
			this.departmentType = dp.getDepartmentType();
			this.level = dp.getLevel();
			this.parent = dp.getParent();
			this.displayOrder = dp.getDisplayOrder();
		}
	}
}
