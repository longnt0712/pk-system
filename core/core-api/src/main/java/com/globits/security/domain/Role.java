package com.globits.security.domain;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.Table;
import javax.persistence.Transient;
import javax.validation.constraints.Size;
import javax.xml.bind.annotation.XmlRootElement;

import org.springframework.security.core.GrantedAuthority;

import com.globits.core.domain.BaseObject;

@XmlRootElement
@Table(name = "tbl_role")
@Entity
public class Role extends BaseObject implements GrantedAuthority {

	@Transient
	private static final long serialVersionUID = 6318192070978248463L;
	// @Id
	// @GeneratedValue(strategy = GenerationType.IDENTITY)
	// private Long id;

	@Column(name = "role_name", length = 150, nullable = false)
	private String name;

	@Column(name = "role_description", length = 512, nullable = true)
	@Size(max = 512, message = "{validation.forms.role.description.size}")
	private String description;

	// --------------------------------------
	// GrantedAuthority implementation
	// --------------------------------------
	@Transient
	public String getAuthority() {
		return this.name;
	}
	// --------------------------------------
	// GETTERS/SETTERS
	// --------------------------------------
	// public Long getId() {
	// return id;
	// }
	//
	// public void setId(Long id) {
	// this.id = id;
	// }

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}

	@Transient
	@Override
	public String toString() {
		return String.format("Role: %s, %s", this.name, this.description);
	}
}
