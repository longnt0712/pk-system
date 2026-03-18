package com.globits.core.auditing;

import java.io.Serializable;

import org.hibernate.annotations.Type;
import org.joda.time.LocalDateTime;

import javax.persistence.Column;
import javax.persistence.EntityListeners;
import javax.persistence.MappedSuperclass;
import javax.persistence.Transient;

@MappedSuperclass
@EntityListeners(value = { EntityAuditListener.class })
public class AuditableEntity implements Serializable {
	@Transient
	private static final long serialVersionUID = 4559994432567537044L;

	@Column(name = "create_date", nullable = false)
	@Type(type="org.jadira.usertype.dateandtime.joda.PersistentLocalDateTime")
//	@DateTimeFormat(iso = ISO.DATE_TIME)
	private LocalDateTime createDate;

	@Column(name = "created_by", length = 100, nullable = false)
	private String createdBy;

	@Column(name = "modify_date", nullable = true)
	@Type(type="org.jadira.usertype.dateandtime.joda.PersistentLocalDateTime")
//	@DateTimeFormat(iso = ISO.DATE_TIME)
	private LocalDateTime modifyDate;

	@Column(name = "modified_by", length = 100, nullable = true)
	private String modifiedBy;

	// -----------------------------
	// GETTERS/SETTERS
	// -----------------------------

	/**
	 * @return the createDate
	 */
	public LocalDateTime getCreateDate() {
		return createDate;
	}

	/**
	 * @param createDate
	 *            the createDate to set
	 */
	public void setCreateDate(LocalDateTime createDate) {
		this.createDate = createDate;
	}

	/**
	 * @return the createdBy
	 */
	public String getCreatedBy() {
		return createdBy;
	}

	/**
	 * @param createdBy
	 *            the createdBy to set
	 */
	public void setCreatedBy(String createdBy) {
		this.createdBy = createdBy;
	}

	/**
	 * @return the modifyDate
	 */
	public LocalDateTime getModifyDate() {
		return modifyDate;
	}

	/**
	 * @param modifyDate
	 *            the modifyDate to set
	 */
	public void setModifyDate(LocalDateTime modifyDate) {
		this.modifyDate = modifyDate;
	}

	/**
	 * @return the modifiedBy
	 */
	public String getModifiedBy() {
		return modifiedBy;
	}

	/**
	 * @param modifiedBy
	 *            the modifiedBy to set
	 */
	public void setModifiedBy(String modifiedBy) {
		this.modifiedBy = modifiedBy;
	}

	public AuditableEntity() {

	}

	public AuditableEntity(AuditableEntity entity) {
		if(entity!=null) {
			this.modifiedBy = entity.modifiedBy;
			this.modifyDate = entity.modifyDate;
			this.createdBy = entity.createdBy;
			this.createDate = entity.createDate;
		}
	}
}
