package com.globits.security.dto;

import java.util.Date;
import java.util.HashSet;
import java.util.Set;

import com.globits.core.dto.AuditableEntityDto;
import com.globits.core.dto.PersonDto;
import com.globits.security.domain.Role;
import com.globits.security.domain.User;
import com.globits.security.domain.UserGroup;

public class UserDto extends AuditableEntityDto {

	private Long id;

	private String displayName;

	private String username;

	private String password;

	private String confirmPassword;

	private boolean isSetPassword;

	private Boolean active;

	private String lastName;

	private String firstName;

	private Date dob;

	private String birthPlace;

	private String email;

	private PersonDto person;

	private boolean hasPhoto;

	private Set<RoleDto> roles = new HashSet<RoleDto>();

	private Set<UserGroupDto> groups = new HashSet<UserGroupDto>();

	public UserDto() {

	}

	public UserDto(User entity) {
		if (entity == null) {
			return;
		}

		this.id = entity.getId();
		this.displayName = "";
		this.username = entity.getUsername();
		this.password = entity.getPassword();
		this.confirmPassword = entity.getConfirmPassword();
		this.active = entity.getActive();
		this.email = entity.getEmail();

		if (entity.getPerson() != null) {
			this.person = new PersonDto(entity.getPerson());
			this.displayName = this.person.getFirstName() + " " + this.person.getLastName();
			this.dob = this.person.getBirthDate();
			this.birthPlace = this.person.getBirthPlace();
			this.hasPhoto = entity.getPerson().getPhoto() != null && entity.getPerson().getPhoto().length > 0;
			this.person.setFatherFullName(entity.getPerson().getFatherFullName());
			this.person.setMotherFullName(entity.getPerson().getMotherFullName());
			this.person.setFatherPhoneNumber(entity.getPerson().getFatherPhoneNumber());
			this.person.setMotherPhoneNumber(entity.getPerson().getMotherPhoneNumber());
			this.person.setAddressString(entity.getPerson().getAddressString());
			this.person.setDiocese(entity.getPerson().getDiocese());
			this.person.setEnrollmentClass(entity.getPerson().getEnrollmentClass());
			this.person.setPatron(entity.getPerson().getPatron());
			this.person.setSacrament(entity.getPerson().getSacrament());
			this.person.setBirthDate(entity.getPerson().getBirthDate());
			this.person.setPhoneNumber(entity.getPerson().getPhoneNumber());
			this.person.setPersonNote(entity.getPerson().getPersonNote());
		}

		if (entity.getRoles() != null) {
			roles.clear();
			for (Role role : entity.getRoles()) {
				roles.add(new RoleDto(role));
			}
		}

		if (entity.getGroups() != null) {
			groups.clear();
			for (UserGroup group : entity.getGroups()) {
				groups.add(new UserGroupDto(group));
			}
		}
		
		setCreateDate(entity.getCreateDate());
		setCreatedBy(entity.getCreatedBy());
		setModifyDate(entity.getModifyDate());
		setModifiedBy(entity.getModifiedBy());
	}

	public User toEntity() {

		User entity = new User();

		entity.setId(id);
		entity.setUsername(username);
		entity.setPassword(password);
		entity.setActive(active);
		entity.setEmail(email);

		entity.setAccountNonExpired(true);
		entity.setAccountNonLocked(true);
		entity.setCredentialsNonExpired(true);

		if (this.person != null) {
			entity.setPerson(person.toEntity());
		}

		if (roles.size() > 0) {
			for (RoleDto dto : roles) {
				entity.getRoles().add(dto.toEntity());
			}
		}

		if (groups.size() > 0) {
			for (UserGroupDto dto : groups) {
				entity.getGroups().add(dto.toEntity());
			}
		}

		return entity;
	}
	
	public UserDto(User entity,boolean isOnlyDisplayName) {
		if (entity == null) {
			return;
		}

		this.id = entity.getId();
		this.username = entity.getUsername();

		if (entity.getPerson() != null) {
			this.displayName = entity.getPerson().getFirstName() + " " + entity.getPerson().getLastName();
		}
	}

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public String getDisplayName() {
		return displayName;
	}

	public void setDisplayName(String displayName) {
		this.displayName = displayName;
	}

	public String getUsername() {
		return username;
	}

	public void setUsername(String username) {
		this.username = username;
	}

	public String getPassword() {
		return password;
	}

	public void setPassword(String password) {
		this.password = password;
	}

	public String getConfirmPassword() {
		return confirmPassword;
	}

	public void setConfirmPassword(String confirmPassword) {
		this.confirmPassword = confirmPassword;
	}

	public boolean isSetPassword() {
		return isSetPassword;
	}

	public void setSetPassword(boolean isSetPassword) {
		this.isSetPassword = isSetPassword;
	}

	public boolean isActive() {
		return active;
	}

	public void setActive(boolean active) {
		this.active = active;
	}

	public String getLastName() {
		return lastName;
	}

	public void setLastName(String lastName) {
		this.lastName = lastName;
	}

	public String getFirstName() {
		return firstName;
	}

	public void setFirstName(String firstName) {
		this.firstName = firstName;
	}

	public Date getDob() {
		return dob;
	}

	public void setDob(Date dob) {
		this.dob = dob;
	}

	public String getBirthPlace() {
		return birthPlace;
	}

	public void setBirthPlace(String birthPlace) {
		this.birthPlace = birthPlace;
	}

	public String getEmail() {
		return email;
	}

	public void setEmail(String email) {
		this.email = email;
	}

	public PersonDto getPerson() {
		return person;
	}

	public void setPerson(PersonDto person) {
		this.person = person;
	}

	public boolean isHasPhoto() {
		return hasPhoto;
	}

	public void setHasPhoto(boolean hasPhoto) {
		this.hasPhoto = hasPhoto;
	}

	public Set<RoleDto> getRoles() {
		return roles;
	}

	public void setRoles(Set<RoleDto> roles) {
		this.roles = roles;
	}

	public Boolean getActive() {
		return active;
	}

	public void setActive(Boolean active) {
		this.active = active;
	}

	public Set<UserGroupDto> getGroups() {
		return groups;
	}

	public void setGroups(Set<UserGroupDto> groups) {
		this.groups = groups;
	}

}
