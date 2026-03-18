package com.globits.core.auditing;

import org.joda.time.LocalDateTime;

import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;

import org.joda.time.DateTime;

import com.globits.core.Constants;
import com.globits.core.utils.CommonUtils;
import com.globits.core.utils.SecurityUtils;
import com.globits.security.domain.User;

public class EntityAuditListener {

	@PrePersist
	public void beforePersit(AuditableEntity auditableEntity) {

		 LocalDateTime now = LocalDateTime.now();

		auditableEntity.setCreateDate(now);
		auditableEntity.setModifyDate(now);

		User user = SecurityUtils.getCurrentUser();

		if (CommonUtils.isNotNull(user)) {

			auditableEntity.setCreatedBy(user.getUsername());
			auditableEntity.setModifiedBy(user.getUsername());

		} else {
			auditableEntity.setCreatedBy(Constants.USER_ADMIN_USERNAME);
		}
	}

	@PreUpdate
	public void beforeMerge(AuditableEntity auditableEntity) {
		LocalDateTime now = LocalDateTime.now();
		auditableEntity.setModifyDate(now);
		User user = SecurityUtils.getCurrentUser();
		if (CommonUtils.isNotNull(user)) {
			auditableEntity.setModifiedBy(user.getUsername());
		}
	}
}
