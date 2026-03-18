package com.globits.core.domain;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import com.globits.security.domain.User;
@Entity
@Table(name = "tbl_organization_user")
@XmlRootElement
public class OrganizationUser extends BaseObject{
	
	@ManyToOne
	@JoinColumn(name="organization_id")
	private Organization organization;
	@ManyToOne
	@JoinColumn(name="user_id")
	private User user;
	
	@Column(name="is_admin_user")
	private Boolean isAdminUser;
	
	
	public Organization getOrganization() {
		return organization;
	}

	public void setOrganization(Organization organization) {
		this.organization = organization;
	}

	public User getUser() {
		return user;
	}

	public void setUser(User user) {
		this.user = user;
	}

	public Boolean getIsAdminUser() {
		return isAdminUser;
	}

	public void setIsAdminUser(Boolean isAdminUser) {
		this.isAdminUser = isAdminUser;
	}
	
	
}
