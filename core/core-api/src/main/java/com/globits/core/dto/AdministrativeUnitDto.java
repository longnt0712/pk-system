package com.globits.core.dto;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import com.globits.core.domain.AdministrativeUnit;

public class AdministrativeUnitDto {

	private Long id;

	private String name;

	private String code;

	private Integer level;

	private AdministrativeUnitDto parent;

	private Set<AdministrativeUnitDto> subAdministrativeUnits;
	private List<AdministrativeUnitDto> children;

	public AdministrativeUnit toEntity() {
		AdministrativeUnit entity = new AdministrativeUnit();

		entity.setId(id);
		entity.setName(name);
		entity.setCode(code);
		entity.setLevel(level);

		if (parent != null) {
			AdministrativeUnit parent = new AdministrativeUnit();
			parent.setId(parent.getId());
			parent.setName(parent.getName());
			parent.setCode(parent.getCode());
			parent.setLevel(level);

			entity.setParent(parent);
		}

		if (subAdministrativeUnits != null) {

			Set<AdministrativeUnit> subs = new HashSet<AdministrativeUnit>();

			for (AdministrativeUnitDto dto : subAdministrativeUnits) {
				AdministrativeUnit sub = new AdministrativeUnit();
				sub.setId(dto.getId());
				sub.setName(dto.getName());
				sub.setCode(dto.getCode());
				sub.setLevel(dto.getLevel());

				subs.add(sub);
			}

			entity.getSubAdministrativeUnits().addAll(subs);
		}

		return entity;
	}

	public AdministrativeUnitDto() {

	}

	public AdministrativeUnitDto(AdministrativeUnit unit) {
		this.code = unit.getCode();
		this.id = unit.getId();
		this.level = unit.getLevel();
		this.name = unit.getName();

		if (unit.getParent() != null) {
			this.parent = new AdministrativeUnitDto();
			this.parent.setCode(unit.getParent().getCode());
			this.parent.setId(unit.getParent().getId());
			this.parent.setName(unit.getParent().getName());
			this.parent.setLevel(unit.getParent().getLevel());
		}

		if (unit.getSubAdministrativeUnits() != null && unit.getSubAdministrativeUnits().size() > 0) {
			this.subAdministrativeUnits = new HashSet<AdministrativeUnitDto>();
			for (AdministrativeUnit c : unit.getSubAdministrativeUnits()) {
				AdministrativeUnitDto cDto = new AdministrativeUnitDto();
				cDto.setId(c.getId());
				cDto.setCode(c.getCode());
				cDto.setName(c.getName());
				cDto.setLevel(c.getLevel());

				this.subAdministrativeUnits.add(cDto);
			}
		}
		this.setChildren(getListChildren(unit));

	}
	private List<AdministrativeUnitDto> getListChildren(AdministrativeUnit unit){
		List<AdministrativeUnitDto> ret = new ArrayList<AdministrativeUnitDto>();
		
		if(unit.getSubAdministrativeUnits()!=null &&unit.getSubAdministrativeUnits().size()>0) {
			for(AdministrativeUnit s : unit.getSubAdministrativeUnits()) {
				AdministrativeUnitDto sDto = new AdministrativeUnitDto();
				sDto.setId(s.getId());
				sDto.setCode(s.getCode());
				sDto.setName(s.getName());
				sDto.setLevel(s.getLevel());
				sDto.setChildren(getListChildren(s));
				ret.add(sDto);
			}
		}
		return ret;
	}

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
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

	public Integer getLevel() {
		return level;
	}

	public void setLevel(Integer level) {
		this.level = level;
	}

	public AdministrativeUnitDto getParent() {
		return parent;
	}

	public void setParent(AdministrativeUnitDto parent) {
		this.parent = parent;
	}

	public Set<AdministrativeUnitDto> getSubAdministrativeUnits() {
		return subAdministrativeUnits;
	}

	public void setSubAdministrativeUnits(Set<AdministrativeUnitDto> subAdministrativeUnits) {
		this.subAdministrativeUnits = subAdministrativeUnits;
	}
	public List<AdministrativeUnitDto> getChildren() {
		return children;
	}

	public void setChildren(List<AdministrativeUnitDto> children) {
		this.children = children;
	}

}
