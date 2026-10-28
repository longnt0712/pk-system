package com.globits.security.domain;

import java.util.Collection;
import java.util.Objects;
import java.util.UUID;
import java.util.Date;
import java.util.HashSet;
import java.util.Set;

import javax.persistence.CascadeType;
import javax.persistence.CollectionTable;
import javax.persistence.Column;
import javax.persistence.ElementCollection;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.JoinTable;
import javax.persistence.ManyToMany;
import javax.persistence.OneToOne;
import javax.persistence.PrePersist;
import javax.persistence.PreUpdate;
import javax.persistence.Table;
import javax.persistence.Transient;
import javax.xml.bind.annotation.XmlRootElement;

import org.hibernate.annotations.Fetch;
import org.hibernate.annotations.FetchMode;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.globits.core.auditing.AuditableEntity;
import com.globits.core.domain.BaseObject;
import com.globits.core.domain.Person;

@Entity
@Table(name = "tbl_user")
@XmlRootElement
public class User extends BaseObject implements UserDetails {

	private static final long serialVersionUID = 4572941405687566992L;
	public static final long VOCABULARY_WORDS_PER_LEVEL = 1000L;

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "username", length = 100, nullable = false, unique = true)
	private String username;

	@Column(name = "password", nullable = false)
	@JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
	private String password;

	// A committed security change permanently invalidates earlier token snapshots.
	// Existing accounts may keep NULL until their first security change.
	@Column(name = "auth_version", length = 36, nullable = true)
	@JsonIgnore
	private String authVersion;

	@Column(name = "just_created", nullable = false)
	private Boolean justCreated = true;

	@Column(name = "last_login_time", nullable = true)
	private Date lastLoginTime;

	@Column(name = "total_login_failures", nullable = true)
	private Long totalLoginFailures;

	@Column(name = "last_login_failures", nullable = true)
	private Long lastLoginFailures;

	@Column(name = "email", length = 150, nullable = false, unique = true)
	private String email;

	/** Trình độ từ vựng CEFR do quản trị viên xếp: A1, A2, B1, B2, C1, C2. */
	@Column(name = "vocabulary_level", length = 2, nullable = true)
	private String vocabularyLevel;

	/** Level kinh nghiệm Daily Vocab, bắt đầu từ 0. */
	@Column(name = "vocabulary_experience_level", nullable = false)
	private Integer vocabularyExperienceLevel = 0;

	/** Số từ đang tích lũy để lên level kế tiếp. */
	@Column(name = "vocabulary_experience_words", nullable = false)
	private Long vocabularyExperienceWords = 0L;

	/** Tổng số từ Daily Vocab đã học, không reset khi lên level. */
	@Column(name = "total_vocabulary_words_learned", nullable = false)
	private Long totalVocabularyWordsLearned = 0L;

	/** Pet/trứng người dùng chọn để hiển thị trong hệ thống và Battle Online. */
	@Column(name = "selected_learning_pet", length = 40, nullable = true)
	private String selectedLearningPet = "MAM_HOC";

	@ManyToMany(fetch = FetchType.EAGER)
	@Fetch(FetchMode.SELECT)
	@JoinTable(name = "tbl_user_role", joinColumns = @JoinColumn(name = "user_id"), inverseJoinColumns = @JoinColumn(name = "role_id"))
	private Set<Role> roles = new HashSet<Role>();

	@ManyToMany(fetch = FetchType.EAGER)
	@Fetch(FetchMode.SELECT)
	@JoinTable(name = "tbl_user_usergroup", joinColumns = @JoinColumn(name = "user_id"), inverseJoinColumns = @JoinColumn(name = "group_id"))
	private Set<UserGroup> groups = new HashSet<UserGroup>();

	/*
	 * Một học sinh có thể học nhiều lớp. Collection chỉ lưu id để core-api
	 * không phải phụ thuộc ngược vào entity EnrolmentClass của richy-api.
	 */
	@ElementCollection(fetch = FetchType.EAGER)
	@Fetch(FetchMode.SELECT)
	@CollectionTable(name = "tbl_user_enrolment_class", joinColumns = @JoinColumn(name = "user_id"))
	@Column(name = "enrolment_class_id", nullable = false)
	private Set<Long> enrollmentClassIds = new HashSet<Long>();

	@OneToOne(mappedBy = "user", fetch = FetchType.EAGER, optional = true, cascade = CascadeType.ALL)
	private Person person;

	@Transient
	private Boolean changePassword = false;

	@Transient
	@JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
	private String confirmPassword;

	/* Spring Security fields */

	@Column(name = "active", nullable = false)
	private Boolean active = true;

	@Column(name = "account_non_expired", nullable = true)
	private Boolean accountNonExpired = true;

	@Column(name = "account_non_locked", nullable = true)
	private Boolean accountNonLocked = true;

	@Column(name = "credentials_non_expired", nullable = true)
	private Boolean credentialsNonExpired = true;

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public String getUsername() {
		return username;
	}

	public void setUsername(String username) {
		if (!Objects.equals(this.username, username)) { rotateAuthVersion(); }
		this.username = username;
	}

	public String getPassword() {
		return password;
	}

	public void setPassword(String password) {
		if (!Objects.equals(this.password, password)) { rotateAuthVersion(); }
		this.password = password;
	}

	@JsonIgnore
	public String getAuthVersion() {
		return authVersion;
	}

	@JsonIgnore
	public void setAuthVersion(String authVersion) {
		this.authVersion = authVersion;
	}

	private void rotateAuthVersion() {
		this.authVersion = UUID.randomUUID().toString();
	}

	/** Internal invalidation for a shared authority definition changing. */
	@JsonIgnore
	public void invalidateSessions() {
		rotateAuthVersion();
	}

	public Boolean getJustCreated() {
		return justCreated;
	}

	public void setJustCreated(Boolean justCreated) {
		this.justCreated = justCreated;
	}

	public Date getLastLoginTime() {
		return lastLoginTime;
	}

	public void setLastLoginTime(Date lastLoginTime) {
		this.lastLoginTime = lastLoginTime;
	}

	public Long getTotalLoginFailures() {
		return totalLoginFailures;
	}

	public void setTotalLoginFailures(Long totalLoginFailures) {
		this.totalLoginFailures = totalLoginFailures;
	}

	public Long getLastLoginFailures() {
		return lastLoginFailures;
	}

	public void setLastLoginFailures(Long lastLoginFailures) {
		this.lastLoginFailures = lastLoginFailures;
	}

	public String getEmail() {
		return email;
	}

	public void setEmail(String email) {
		this.email = email;
	}

	public String getVocabularyLevel() {
		return vocabularyLevel;
	}

	public void setVocabularyLevel(String vocabularyLevel) {
		this.vocabularyLevel = vocabularyLevel;
	}

	public Integer getVocabularyExperienceLevel() {
		return calculateVocabularyExperienceLevel(getTotalVocabularyWordsLearned());
	}

	public void setVocabularyExperienceLevel(Integer vocabularyExperienceLevel) {
		this.vocabularyExperienceLevel = vocabularyExperienceLevel == null ? 0 : vocabularyExperienceLevel;
	}

	public Long getVocabularyExperienceWords() {
		return calculateVocabularyExperienceWords(getTotalVocabularyWordsLearned());
	}

	public void setVocabularyExperienceWords(Long vocabularyExperienceWords) {
		this.vocabularyExperienceWords = vocabularyExperienceWords == null ? 0L : vocabularyExperienceWords;
	}

	public Long getTotalVocabularyWordsLearned() {
		return totalVocabularyWordsLearned == null ? 0L : totalVocabularyWordsLearned;
	}

	public void setTotalVocabularyWordsLearned(Long totalVocabularyWordsLearned) {
		this.totalVocabularyWordsLearned = totalVocabularyWordsLearned == null
				? 0L : Math.max(0L, totalVocabularyWordsLearned);
		synchronizeVocabularyExperience();
	}

	public static int calculateVocabularyExperienceLevel(long totalWordsLearned) {
		long safeTotal = Math.max(0L, totalWordsLearned);
		long level = safeTotal / VOCABULARY_WORDS_PER_LEVEL;
		return level > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) level;
	}

	public static long calculateVocabularyExperienceWords(long totalWordsLearned) {
		return Math.max(0L, totalWordsLearned) % VOCABULARY_WORDS_PER_LEVEL;
	}

	@PrePersist
	@PreUpdate
	private void synchronizeVocabularyExperience() {
		long total = totalVocabularyWordsLearned == null
				? 0L : Math.max(0L, totalVocabularyWordsLearned);
		totalVocabularyWordsLearned = total;
		vocabularyExperienceLevel = calculateVocabularyExperienceLevel(total);
		vocabularyExperienceWords = calculateVocabularyExperienceWords(total);
	}

	public String getSelectedLearningPet() {
		return selectedLearningPet == null || selectedLearningPet.trim().isEmpty()
				? "MAM_HOC" : selectedLearningPet;
	}

	public void setSelectedLearningPet(String selectedLearningPet) {
		this.selectedLearningPet = selectedLearningPet == null || selectedLearningPet.trim().isEmpty()
				? "MAM_HOC" : selectedLearningPet;
	}

	/**
	 * Cộng số từ của một lượt Daily Vocab đã hoàn thành.
	 * Mỗi 1.000 từ tăng đúng một level; phần dư là tiến độ của level kế tiếp.
	 */
	public void addDailyVocabularyWords(long learnedWords) {
		if (learnedWords <= 0) {
			return;
		}

		setTotalVocabularyWordsLearned(getTotalVocabularyWordsLearned() + learnedWords);
	}

	public void setActive(Boolean active) {
		if (!Objects.equals(this.active, active)) { rotateAuthVersion(); }
		this.active = active;
	}

	public Boolean getActive() {
		return active;
	}

	public Set<Role> getRoles() {
		return roles;
	}

	public void setRoles(Set<Role> roles) {
		replaceRoles(roles);
	}

	/** Preserve Hibernate's managed collection and rotate only on authority changes. */
	public void replaceRoles(Collection<Role> requestedRoles) {
		Set<Role> replacement = requestedRoles == null ? new HashSet<Role>() : new HashSet<Role>(requestedRoles);
		if (!roleNames(this.roles).equals(roleNames(replacement))) { rotateAuthVersion(); }
		if (this.roles == null) { this.roles = new HashSet<Role>(); }
		this.roles.clear();
		this.roles.addAll(replacement);
	}

	private Set<String> roleNames(Collection<Role> values) {
		Set<String> names = new HashSet<String>();
		if (values != null) {
			for (Role role : values) {
				if (role != null) { names.add(role.getName()); }
			}
		}
		return names;
	}

	public Set<UserGroup> getGroups() {
		return groups;
	}

	public void setGroups(Set<UserGroup> groups) {
		this.groups = groups;
	}

	public Set<Long> getEnrollmentClassIds() {
		return enrollmentClassIds;
	}

	public void setEnrollmentClassIds(Set<Long> enrollmentClassIds) {
		this.enrollmentClassIds = enrollmentClassIds;
	}

	public Boolean getAccountNonExpired() {
		return accountNonExpired;
	}

	public Boolean getAccountNonLocked() {
		return accountNonLocked;
	}

	public Boolean getCredentialsNonExpired() {
		return credentialsNonExpired;
	}

	public void setAccountNonExpired(Boolean accountNonExpired) {
		if (!Objects.equals(this.accountNonExpired, accountNonExpired)) { rotateAuthVersion(); }
		this.accountNonExpired = accountNonExpired;
	}

	public void setAccountNonLocked(Boolean accountNonLocked) {
		if (!Objects.equals(this.accountNonLocked, accountNonLocked)) { rotateAuthVersion(); }
		this.accountNonLocked = accountNonLocked;
	}

	public void setCredentialsNonExpired(Boolean credentialsNonExpired) {
		if (!Objects.equals(this.credentialsNonExpired, credentialsNonExpired)) { rotateAuthVersion(); }
		this.credentialsNonExpired = credentialsNonExpired;
	}

	@JsonIgnore
	@Transient
	public Collection<GrantedAuthority> getAuthorities() {
		Set<GrantedAuthority> authorities = new HashSet<GrantedAuthority>();

		authorities.addAll(roles);

		return authorities;
	}

	public boolean isAccountNonExpired() {
		return Boolean.TRUE.equals(this.accountNonExpired);
	}

	public boolean isAccountNonLocked() {
		return Boolean.TRUE.equals(this.accountNonLocked);
	}

	public boolean isCredentialsNonExpired() {
		return Boolean.TRUE.equals(this.credentialsNonExpired);
	}

	public boolean isEnabled() {
		return Boolean.TRUE.equals(this.active);
	}

	public Boolean getChangePassword() {
		return changePassword;
	}

	public void setChangePassword(Boolean changePassword) {
		this.changePassword = changePassword;
	}

	public String getConfirmPassword() {
		return confirmPassword;
	}

	public void setConfirmPassword(String confirmPassword) {
		this.confirmPassword = confirmPassword;
	}

	public Person getPerson() {
		return person;
	}

	public void setPerson(Person person) {
		this.person = person;
	}

	public User() {

	}

	public User(Long id, String username, String email, Boolean accountNonLocked) {
		this.id = id;
		this.username = username;
		this.email = email;
		this.accountNonLocked = accountNonLocked;
	}

	public User(Long id, String username, String email, Boolean accountNonLocked, Boolean accountNonExpired) {
		this.id = id;
		this.username = username;
		this.email = email;
		this.accountNonLocked = accountNonLocked;
		this.accountNonExpired = accountNonExpired;
	}

	public User(User user, boolean isSetPerson) {
		this.authVersion = user.getAuthVersion();
		this.accountNonExpired = user.isAccountNonExpired();
		this.accountNonLocked = user.isAccountNonLocked();
		this.active = user.getActive();
		this.changePassword = user.changePassword;
		this.confirmPassword = user.confirmPassword;
		this.credentialsNonExpired = user.isCredentialsNonExpired();
		this.email = user.getEmail();
		this.justCreated = user.getJustCreated();
		this.lastLoginFailures = user.getLastLoginFailures();
		this.lastLoginTime = user.getLastLoginTime();
		this.password = user.getPassword();
		this.changePassword = user.getChangePassword();
		this.confirmPassword = user.getConfirmPassword();
		this.username = user.getUsername();
		this.setId(user.getId());
		this.setCreateDate(user.getCreateDate());
		this.setCreatedBy(user.getCreatedBy());
		this.roles = user.getRoles();
		this.enrollmentClassIds = user.getEnrollmentClassIds() == null
				? new HashSet<Long>()
				: new HashSet<Long>(user.getEnrollmentClassIds());
		if (user.getPerson() != null && isSetPerson == true) {
			this.person = new Person();
			if(user.getPerson().getId()!=null) {
				this.person.setId(user.getPerson().getId());
			}
			this.person.setFirstName(user.getPerson().getFirstName());
			this.person.setLastName(user.getPerson().getLastName());
			this.person.setDisplayName(user.getPerson().getDisplayName());
			this.person.setBirthDate(user.getPerson().getBirthDate());
			this.person.setBirthPlace(user.getPerson().getBirthPlace());
			this.person.setCarrer(user.getPerson().getCarrer());
			this.person.setGender(user.getPerson().getGender());
			this.person.setEmail(user.getPerson().getEmail());
			this.person.setUser(user);
		}
	}
}
