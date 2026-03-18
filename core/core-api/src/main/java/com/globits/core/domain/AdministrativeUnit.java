package com.globits.core.domain;

import java.util.Set;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.OneToMany;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import com.fasterxml.jackson.annotation.JsonIgnore;

/**
 * @author dunghq Danh mục đơn vị hành chính (tỉnh thành, quận huyện, ...)
 */
@Entity
@Table(name = "tbl_administrative_unit")
@XmlRootElement
public class AdministrativeUnit extends BaseObject {
	private static final long serialVersionUID = -5349886210112100999L;
	@Column(name = "name")
	private String name;
	@Column(name = "code")
	private String code;
	// @Transient
	@Column(name = "level")
	private Integer level;
	@ManyToOne
	@JoinColumn(name = "parent_id")
	private AdministrativeUnit parent;

	@JsonIgnore
	@OneToMany(mappedBy = "parent", fetch = FetchType.LAZY)
	private Set<AdministrativeUnit> subAdministrativeUnits;

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

	public AdministrativeUnit getParent() {
		return parent;
	}

	public void setParent(AdministrativeUnit parent) {
		this.parent = parent;
	}

	public Integer getLevel() {
		return level;
	}

	public void setLevel(Integer level) {
		this.level = level;
	}

	public Set<AdministrativeUnit> getSubAdministrativeUnits() {
		return subAdministrativeUnits;
	}

	public void setSubAdministrativeUnits(Set<AdministrativeUnit> subAdministrativeUnits) {
		this.subAdministrativeUnits = subAdministrativeUnits;
	}

	public AdministrativeUnit() {

	}
	public AdministrativeUnit(Long id,String code, String name) {
		this.setId(id);
		this.setCode(code);
		this.setName(name);
//		this.setLevel(level);
		
	}

	public AdministrativeUnit(AdministrativeUnit administrativeUnit, boolean isSetParent) {
		this.setId(administrativeUnit.getId());
		this.code = administrativeUnit.getCode();
		this.name = administrativeUnit.getName();
		this.level = administrativeUnit.getLevel();
		if (isSetParent) {
			this.parent = administrativeUnit.getParent();
		}
	}
}
