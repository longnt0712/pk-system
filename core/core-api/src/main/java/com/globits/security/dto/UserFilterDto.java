package com.globits.security.dto;

public class UserFilterDto {

	private String keyword;

	private Boolean active;

	private RoleDto[] roles;

	private UserGroupDto[] groups;
	
	private Integer enrollmentClass;

	private Long[] enrollmentClassIds;

	/* Khoảng ngày tạo tài khoản (ngày nhập học). */
	private Long startDate;

	private Long endDate;

	public Long getStartDate() {
		return startDate;
	}

	public void setStartDate(Long startDate) {
		this.startDate = startDate;
	}

	public Long getEndDate() {
		return endDate;
	}

	public void setEndDate(Long endDate) {
		this.endDate = endDate;
	}

	public Integer getEnrollmentClass() {
		return enrollmentClass;
	}

	public void setEnrollmentClass(Integer enrollmentClass) {
		this.enrollmentClass = enrollmentClass;
	}

	public Long[] getEnrollmentClassIds() {
		return enrollmentClassIds;
	}

	public void setEnrollmentClassIds(Long[] enrollmentClassIds) {
		this.enrollmentClassIds = enrollmentClassIds;
	}

	public String getKeyword() {
		return keyword;
	}

	public void setKeyword(String keyword) {
		this.keyword = keyword;
	}

	public Boolean getActive() {
		return active;
	}

	public void setActive(Boolean active) {
		this.active = active;
	}

	public RoleDto[] getRoles() {
		return roles;
	}

	public void setRoles(RoleDto[] roles) {
		this.roles = roles;
	}

	public UserGroupDto[] getGroups() {
		return groups;
	}

	public void setGroups(UserGroupDto[] groups) {
		this.groups = groups;
	}

}
