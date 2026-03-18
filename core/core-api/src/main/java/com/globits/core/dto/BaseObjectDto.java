package com.globits.core.dto;

public class BaseObjectDto extends AuditableEntityDto {

	protected Long id;

	protected boolean voided;

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public boolean isVoided() {
		return voided;
	}

	public void setVoided(boolean voided) {
		this.voided = voided;
	}

}
