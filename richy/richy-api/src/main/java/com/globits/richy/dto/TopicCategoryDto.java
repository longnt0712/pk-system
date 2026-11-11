package com.globits.richy.dto;

import java.io.Serializable;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.globits.richy.domain.TopicCategory;
import com.globits.richy.question.VocabularyPolicy;
import com.globits.security.domain.User;
import org.springframework.security.core.context.SecurityContextHolder;

public class TopicCategoryDto implements Serializable{
	private Long id;
	private String name;
	private Long parentId;
	private boolean parentSpecified;
	private boolean personal;
	private boolean personalLibrary;
	@JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
	public boolean isPersonalLibrary() { return personalLibrary; }
	public void setPersonalLibrary(boolean personalLibrary) { this.personalLibrary = personalLibrary; }
	@JsonProperty(access = JsonProperty.Access.READ_ONLY)
	public boolean isPersonal() { return personal; }

	public Long getParentId() { return parentId; }
	public void setParentId(Long parentId) { this.parentId = parentId; this.parentSpecified = true; }
	@JsonIgnore
	public boolean isParentSpecified() { return parentSpecified; }
	
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
	public TopicCategoryDto() {
		
	}
	public TopicCategoryDto(TopicCategory domain) {
		this.id = domain.getId();
		this.name = domain.getName();
		this.parentId = domain.getParent() == null ? null : domain.getParent().getId();
		this.personal = domain.getOwnerId() != null;
	}

	static boolean visibleInTopic(TopicCategory category) {
		if (category == null) { return false; }
		if (category.getOwnerId() == null) { return true; }
		User user = VocabularyPolicy.authenticatedUser(SecurityContextHolder.getContext().getAuthentication());
		return user != null && category.getOwnerId().equals(user.getId());
	}
	
}
