package com.globits.richy.domain;

import java.util.Date;
import java.util.Set;

import javax.persistence.Basic;
import javax.persistence.CascadeType;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.JoinColumn;
import javax.persistence.Lob;
import javax.persistence.ManyToOne;
import javax.persistence.OneToMany;
import javax.persistence.OrderBy;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import org.hibernate.annotations.Type;
import org.joda.time.LocalDateTime;

import com.globits.core.domain.BaseObject;
import com.globits.core.domain.Organization;
import com.globits.security.domain.User;

@Entity
@Table(name = "tbl_article")
@XmlRootElement
public class Article extends BaseObject{
	@Lob
	@Column(name="code")
	private String code;
	
	@Lob
	@Column(name="title")
	private String title;
	
	@Lob
	@Column(name="sub_title")
	private String subtitle;
	
	@Lob
	@Column(name="content")
	private String content;
	
	@Lob
	@Column(name="description")
	private String description;
	
	@Lob
	@Column(name="image_url")
	private String imageUrl;
	
	@Lob
	@Column(name="video_url")
	private String videoUrl;
	
	@Column(name="views")
	private Integer views;
	
	@Column(name="important")
	private Integer important;// level of important 1 lowest 2 => higher ++...
	
	@Column(name="status")
	private Integer status;//1: draft; 1: published; 2: hide
	
//	@Basic(fetch = FetchType.LAZY)
//	@Column(name = "photo", nullable = true, columnDefinition = "LONGBLOB NULL")
////	@Column(name = "photo", nullable = true,length=5242880)//Kích thước tối đa 5M, có thể để kích thước lớn hơn
//	private byte[] photo;
	
	@Basic(fetch = FetchType.EAGER)
	//@Column(name = "photo", nullable = true, columnDefinition = "LONGBLOB NULL")
	@Column(name = "photo", nullable = true,length=5242880)//Kích thước tối đa 5M, có thể để kích thước lớn hơn
	private byte[] photo;
	
	@ManyToOne(fetch=FetchType.EAGER)
	@JoinColumn(name="author_user_id")
	private User author;
	
	@ManyToOne(fetch=FetchType.EAGER)
	@JoinColumn(name="folder_id")
	private Folder folder;
	
	@Column(name = "publish_date", nullable = true)
	@Type(type="org.jadira.usertype.dateandtime.joda.PersistentLocalDateTime")
//	@DateTimeFormat(iso = ISO.DATE_TIME)
	private LocalDateTime publishDate;
	
	@Column(name = "hide_date", nullable = true)
	@Type(type="org.jadira.usertype.dateandtime.joda.PersistentLocalDateTime")
//	@DateTimeFormat(iso = ISO.DATE_TIME)
	private LocalDateTime hideDate;
	
	@Column(name = "specific_date", nullable = true)
//	@Type(type="org.jadira.usertype.dateandtime.joda.PersistentLocalDateTime")
//	@DateTimeFormat(iso = ISO.DATE_TIME)
	private Date specificDate;
	
//	@Lob
//	@Column(name="video_url")
//	private String videoUrl;
	
//	@OneToMany(mappedBy = "article", cascade = CascadeType.ALL, fetch = FetchType.EAGER, orphanRemoval=true)
//	private Set<Passage> passages;
	
	@Column(name="website")
	private Integer website;//1: church; 1: richy; 2: shop crocs
	
	@Column(name="article_url")
	private String articleUrl;//display in url

	
	public String getArticleUrl() {
		return articleUrl;
	}

	public void setArticleUrl(String articleUrl) {
		this.articleUrl = articleUrl;
	}


	public byte[] getPhoto() {
		return photo;
	}

	public void setPhoto(byte[] photo) {
		this.photo = photo;
	}

	public Integer getWebsite() {
		return website;
	}


	public void setWebsite(Integer website) {
		this.website = website;
	}


	public String getTitle() {
		return title;
	}

	
	public Date getSpecificDate() {
		return specificDate;
	}


	public void setSpecificDate(Date specificDate) {
		this.specificDate = specificDate;
	}


	public String getImageUrl() {
		return imageUrl;
	}

	public void setImageUrl(String imageUrl) {
		this.imageUrl = imageUrl;
	}

	public String getVideoUrl() {
		return videoUrl;
	}

	public void setVideoUrl(String videoUrl) {
		this.videoUrl = videoUrl;
	}

	public void setTitle(String title) {
		this.title = title;
	}

	public String getSubtitle() {
		return subtitle;
	}

	public void setSubtitle(String subtitle) {
		this.subtitle = subtitle;
	}

	
	public String getCode() {
		return code;
	}

	public void setCode(String code) {
		this.code = code;
	}

	public Integer getStatus() {
		return status;
	}

	public void setStatus(Integer status) {
		this.status = status;
	}


//
//	public String getVideoUrl() {
//		return videoUrl;
//	}
//
//	public void setVideoUrl(String videoUrl) {
//		this.videoUrl = videoUrl;
//	}
//
//	public byte[] getPhoto() {
//		return photo;
//	}
//
//	public void setPhoto(byte[] photo) {
//		this.photo = photo;
//	}
	
	

//	public Set<Passage> getPassage() {
//		return passage;
//	}
//
//	public void setPassage(Set<Passage> passage) {
//		this.passage = passage;
//	}

	public LocalDateTime getHideDate() {
		return hideDate;
	}

	public void setHideDate(LocalDateTime hideDate) {
		this.hideDate = hideDate;
	}

	public LocalDateTime getPublishDate() {
		return publishDate;
	}

	public void setPublishDate(LocalDateTime publishDate) {
		this.publishDate = publishDate;
	}

	public String getContent() {
		return content;
	}

	public void setContent(String content) {
		this.content = content;
	}

	public User getAuthor() {
		return author;
	}

	public void setAuthor(User author) {
		this.author = author;
	}

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}

	public Integer getViews() {
		return views;
	}

	public void setViews(Integer views) {
		this.views = views;
	}

	public Integer getImportant() {
		return important;
	}

	public void setImportant(Integer important) {
		this.important = important;
	}

	public Folder getFolder() {
		return folder;
	}

	public void setFolder(Folder folder) {
		this.folder = folder;
	}

//	public Set<Passage> getPassages() {
//		return passages;
//	}
//
//	public void setPassages(Set<Passage> passages) {
//		this.passages = passages;
//	}
	
}
