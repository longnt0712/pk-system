package com.globits.core.domain;

import java.util.Set;

import javax.persistence.CascadeType;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.OneToMany;
import javax.persistence.Table;
import javax.persistence.Transient;
import javax.xml.bind.annotation.XmlRootElement;

import com.fasterxml.jackson.annotation.JsonIgnore;

/**
 * @author dunghq Danh mục cơ quan tổ chức
 */
@Entity
@XmlRootElement
@Table(name = "tbl_organization")
public class Organization extends BaseObject {
	private static final long serialVersionUID = -994850132471679163L;
	@Column(name = "code")
	private String code;
	@Column(name = "name")
	private String name;
	@Column(name = "organization_type")
	private Integer organizationType;

	@Transient
	private int level;
	@ManyToOne(fetch = FetchType.EAGER)
	@JoinColumn(name = "parent_id")
	private Organization parent;

	@JsonIgnore
	@OneToMany(mappedBy = "parent")
	private Set<Organization> subOrganizations;

	@OneToMany(mappedBy = "organization", cascade=CascadeType.ALL, orphanRemoval=true)
	private Set<OrganizationUser> users;

	
	public String getCode() {
		return code;
	}

	public void setCode(String code) {
		this.code = code;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public Integer getOrganizationType() {
		return organizationType;
	}

	public void setOrganizationType(Integer organizationType) {
		this.organizationType = organizationType;
	}

	public Organization getParent() {
		return parent;
	}

	public void setParent(Organization parent) {
		this.parent = parent;
	}

	public int getLevel() {
		return level;
	}

	public void setLevel(int level) {
		this.level = level;
	}

	public Set<Organization> getSubOrganizations() {
		return subOrganizations;
	}

	public void setSubOrganizations(Set<Organization> subOrganizations) {
		this.subOrganizations = subOrganizations;
	}

	public Set<OrganizationUser> getUsers() {
		return users;
	}

	public void setUsers(Set<OrganizationUser> users) {
		this.users = users;
	}

	public Organization() {

	}

	public Organization(Long id, String name, String code, Integer organizationType) {
		this.setId(id);
		this.setCode(code);
		this.setName(name);
		this.organizationType = organizationType;
	}

}
