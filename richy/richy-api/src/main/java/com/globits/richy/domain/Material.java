package com.globits.richy.domain;

import java.util.Date;
import java.util.Set;

import javax.persistence.CascadeType;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.JoinColumn;
import javax.persistence.Lob;
import javax.persistence.ManyToOne;
import javax.persistence.OneToMany;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import com.globits.core.domain.BaseObject;
import com.globits.core.domain.Organization;

@Entity
@Table(name = "tbl_material")
@XmlRootElement
public class Material extends BaseObject{
	@Lob
	@Column(name="name")
	private String name;
	
	@Lob
	@Column(name="text")
	private String text;
	
	@OneToMany(mappedBy = "material", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval=true)
	private Set<MaterialUser> MaterialUsers;
	
	@Column(name = "registered_date", nullable = true)
//	@Type(type="org.jadira.usertype.dateandtime.joda.PersistentLocalDateTime")
//	@DateTimeFormat(iso = ISO.DATE_TIME)
	private Date registeredDate;
	
	@Column(name = "expired_date", nullable = true)
//	@Type(type="org.jadira.usertype.dateandtime.joda.PersistentLocalDateTime")
//	@DateTimeFormat(iso = ISO.DATE_TIME)
	private Date expiredDate;
	
	
	public Set<MaterialUser> getMaterialUsers() {
		return MaterialUsers;
	}
	public void setMaterialUsers(Set<MaterialUser> materialUsers) {
		MaterialUsers = materialUsers;
	}
	public Date getRegisteredDate() {
		return registeredDate;
	}
	public void setRegisteredDate(Date registeredDate) {
		this.registeredDate = registeredDate;
	}
	public Date getExpiredDate() {
		return expiredDate;
	}
	public void setExpiredDate(Date expiredDate) {
		this.expiredDate = expiredDate;
	}
	public String getName() {
		return name;
	}
	public void setName(String name) {
		this.name = name;
	}
	public String getText() {
		return text;
	}
	public void setText(String text) {
		this.text = text;
	}
	
}
