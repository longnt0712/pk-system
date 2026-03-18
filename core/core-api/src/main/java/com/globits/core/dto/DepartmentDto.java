package com.globits.core.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;


import com.globits.core.domain.Department;

public class DepartmentDto implements Serializable {

	private static final long serialVersionUID = 1L;

	private Long id;

	private String code;

	private String name;

	private int departmentType;

	private Long parentId;

	private DepartmentDto parent;

	private List<DepartmentDto> subDepartments;
	
	private List<DepartmentDto> children;
	
	private boolean isDuplicate;
	private String dupName;
	private String dupCode;
	
	private String displayOrder;
	private Integer level;
	private String linePath;
	private String shortName;

	public DepartmentDto() {

	}
	private List<DepartmentDto> getSubRecursive(Department root){
		List<DepartmentDto> ret = new ArrayList<DepartmentDto>();
		if(root.getSubDepartments()!=null && root.getSubDepartments().size()>0) {
			for (Department c : root.getSubDepartments()) {
				DepartmentDto cDto = new DepartmentDto();
				cDto.setId(c.getId());
				cDto.setCode(c.getCode());
				cDto.setName(c.getName());
				cDto.setDepartmentType(c.getDepartmentType());
				cDto.setDisplayOrder(c.getDisplayOrder());
				cDto.setLevel(c.getLevel());
				cDto.setLinePath(c.getLinePath());
				List<DepartmentDto> childs =getSubRecursive(c);
				cDto.setSubDepartments(childs);
				cDto.setChildren(childs);
				ret.add(cDto);				
			}
		}
		return ret;
	}
	public DepartmentDto(Department entity) {

		if (entity == null) {
			return;
		}

		this.code = entity.getCode();
		this.departmentType = entity.getDepartmentType();
		this.id = entity.getId();
		this.name = entity.getName();
		this.displayOrder = entity.getDisplayOrder();
		this.level = entity.getLevel();
		this.linePath = entity.getLinePath();
		this.shortName = entity.getShortName();
		if (entity.getParent() != null) {
			this.parent = new DepartmentDto();
			this.parent.setCode(entity.getParent().getCode());
			this.parent.setDepartmentType(entity.getParent().getDepartmentType());
			this.parent.setName(entity.getParent().getName());
			this.parent.setId(entity.getParent().getId());
		}
		this.setSubDepartments(getSubRecursive(entity));
		this.setChildren(getSubRecursive(entity));
//		if (entity.getSubDepartments() != null && entity.getSubDepartments().size() > 0) {
//			this.subDepartments = new ArrayList<DepartmentDto>();
//			for (Department c : entity.getSubDepartments()) {
//				DepartmentDto cDto = new DepartmentDto();
//				cDto.setId(c.getId());
//				cDto.setCode(c.getCode());
//				cDto.setName(c.getName());
//				cDto.setDepartmentType(c.getDepartmentType());
//				cDto.setSubDepartments(getSubRecursive(c));
//				
//			}
//		}
	}

	public Department toEntity() {
		Department entity = new Department();

		entity.setId(id);
		entity.setCode(code);
		entity.setName(name);
		entity.setDepartmentType(departmentType);
		entity.setShortName(this.getShortName());
		if (parent != null) {
			Department parentEntity = new Department();
			parentEntity.setId(parent.getId());
			parentEntity.setCode(parent.getCode());
			parentEntity.setName(parent.getName());
			parentEntity.setDepartmentType(parent.getDepartmentType());
			
			entity.setParent(parentEntity);
		}

		return entity;
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

	public int getDepartmentType() {
		return departmentType;
	}

	public void setDepartmentType(int departmentType) {
		this.departmentType = departmentType;
	}

	public Long getParentId() {
		return parentId;
	}

	public void setParentId(Long parentId) {
		this.parentId = parentId;
	}
//	public List<DepartmentDto> getChildren() {
//		return subDepartments;
//	}
	public List<DepartmentDto> getChildren() {
		return children;
	}
	public void setChildren(List<DepartmentDto> children) {
		this.children = children;
	}
	public List<DepartmentDto> getSubDepartments() {
		return subDepartments;
	}

	public void setSubDepartments(List<DepartmentDto> subDepartments) {
		this.subDepartments = subDepartments;
	}

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public DepartmentDto getParent() {
		return parent;
	}

	public void setParent(DepartmentDto parent) {
		this.parent = parent;
	}
	public boolean isDuplicate() {
		return isDuplicate;
	}
	public void setDuplicate(boolean isDuplicate) {
		this.isDuplicate = isDuplicate;
	}
	public String getDupName() {
		return dupName;
	}
	public void setDupName(String dupName) {
		this.dupName = dupName;
	}
	public String getDupCode() {
		return dupCode;
	}
	public void setDupCode(String dupCode) {
		this.dupCode = dupCode;
	}
	public String getDisplayOrder() {
		return displayOrder;
	}
	public void setDisplayOrder(String displayOrder) {
		this.displayOrder = displayOrder;
	}
	public Integer getLevel() {
		return level;
	}
	public void setLevel(Integer level) {
		this.level = level;
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
	
}
