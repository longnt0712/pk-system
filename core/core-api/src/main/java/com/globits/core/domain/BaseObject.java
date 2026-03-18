package com.globits.core.domain;

import java.util.UUID;

import javax.persistence.Column;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.MappedSuperclass;

import org.hibernate.annotations.GenericGenerator;
import org.hibernate.annotations.Type;

import com.globits.core.auditing.AuditableEntity;

@MappedSuperclass
public class BaseObject extends AuditableEntity {
	private static final long serialVersionUID = 1L;
	
//	@Id
//	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Id
	@GenericGenerator(name = "native", strategy = "native")
	@GeneratedValue(strategy = GenerationType.IDENTITY, generator = "native")
	@Column(name = "id", unique = true, nullable = false)
	private Long id;
	
	@Column(name = "uuid_key",  nullable = true)
	@Type(type = "uuid-char")
	private UUID uuidKey;
	
	@Column(name = "voided",  nullable = true)
	private Boolean voided;
	
	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public Boolean getVoided() {
		return voided;
	}

	public void setVoided(Boolean voided) {
		this.voided = voided;
	}

	public UUID getUuidKey() {
		return uuidKey;
	}

	public void setUuidKey(UUID uuidKey) {
		this.uuidKey = uuidKey;
	}

	public BaseObject() {

	}

	public BaseObject(BaseObject object) {
		super(object);
		if(object!=null) {
			this.id = object.getId();
		}
	}
}
