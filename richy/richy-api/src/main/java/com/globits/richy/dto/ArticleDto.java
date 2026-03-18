package com.globits.richy.dto;

import java.io.Serializable;
import java.util.Base64;
import java.util.Comparator;
import java.util.Date;

import org.joda.time.LocalDate;
import org.joda.time.LocalDateTime;
import org.joda.time.format.DateTimeFormat;
import org.joda.time.format.DateTimeFormatter;

import com.globits.richy.domain.Article;
import com.globits.richy.domain.Folder;
import com.globits.security.domain.User;
import com.globits.security.dto.UserDto;

public class ArticleDto implements Serializable{
	private Long id;
	private String code;
	private String title;
	private String subtitle;
	private String description;
	private String content;
	private Integer views;
	private Integer important;// level of important 1 lowest 2 => higher ++...
	private Integer status;// 0: published; 1: draft; 2: 
	private byte[] photo;
	private UserDto author;
	private FolderDto folder;
	private String videoUrl;
//	private List<PassageDto> passages;
	private String textSearch;
	private String folderUrl;
	private LocalDateTime createDate;
	private LocalDateTime publishDate;
	private LocalDateTime hideDate;
	private Date specificDate;
	private int publishType = 0; //0: Chưa xuất bản; 1: Đã xuất bản; 2: Đã gỡ/ẩn
	private Integer folderType;
	private Date firstDay;
	private Date LastDay;
	private Date currentDay;
	private Integer website;//1: church; 1: richy; 2: shop crocs
	private String articleUrl;
	private String displayPhoto;
	private String publishDateText;
	private String createDateText;

	
	public String getCreateDateText() {
		return createDateText;
	}
	public void setCreateDateText(String createDateText) {
		this.createDateText = createDateText;
	}
	public String getPublishDateText() {
		return publishDateText;
	}
	public void setPublishDateText(String publishDateText) {
		this.publishDateText = publishDateText;
	}
	public String getDisplayPhoto() {
		return displayPhoto;
	}
	public void setDisplayPhoto(String displayPhoto) {
		this.displayPhoto = displayPhoto;
	}
	public String getArticleUrl() {
		return articleUrl;
	}
	public void setArticleUrl(String articleUrl) {
		this.articleUrl = articleUrl;
	}
	public Integer getWebsite() {
		return website;
	}
	public void setWebsite(Integer website) {
		this.website = website;
	}
	public Date getCurrentDay() {
		return currentDay;
	}
	public void setCurrentDay(Date currentDay) {
		this.currentDay = currentDay;
	}
	public Date getFirstDay() {
		return firstDay;
	}
	public void setFirstDay(Date firstDay) {
		this.firstDay = firstDay;
	}
	public Date getLastDay() {
		return LastDay;
	}
	public void setLastDay(Date lastDay) {
		LastDay = lastDay;
	}
	public Date getSpecificDate() {
		return specificDate;
	}
	public void setSpecificDate(Date specificDate) {
		this.specificDate = specificDate;
	}
	public Integer getFolderType() {
		return folderType;
	}
	public void setFolderType(Integer folderType) {
		this.folderType = folderType;
	}
	public LocalDateTime getHideDate() {
		return hideDate;
	}
	public void setHideDate(LocalDateTime hideDate) {
		this.hideDate = hideDate;
	}
	public int getPublishType() {
		return publishType;
	}
	public void setPublishType(int publishType) {
		this.publishType = publishType;
	}
	public LocalDateTime getPublishDate() {
		return publishDate;
	}
	public void setPublishDate(LocalDateTime publishDate) {
		this.publishDate = publishDate;
	}

	private String imageUrl;

	public String getImageUrl() {
		return imageUrl;
	}
	public void setImageUrl(String imageUrl) {
		this.imageUrl = imageUrl;
	}
	public String getFolderUrl() {
		return folderUrl;
	}
	public void setFolderUrl(String folderUrl) {
		this.folderUrl = folderUrl;
	}
	public String getTextSearch() {
		return textSearch;
	}
	public void setTextSearch(String textSearch) {
		this.textSearch = textSearch;
	}
//	public List<PassageDto> getPassages() {
//		return passages;
//	}
//	public void setPassages(List<PassageDto> passages) {
//		this.passages = passages;
//	}
	public String getVideoUrl() {
		return videoUrl;
	}
	public void setVideoUrl(String videoUrl) {
		this.videoUrl = videoUrl;
	}
	public Long getId() {
		return id;
	}
	public void setId(Long id) {
		this.id = id;
	}
	public String getContent() {
		return content;
	}
	public void setContent(String content) {
		this.content = content;
	}
	public String getCode() {
		return code;
	}
	public void setCode(String code) {
		this.code = code;
	}
	public String getTitle() {
		return title;
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
	public Integer getStatus() {
		return status;
	}
	public void setStatus(Integer status) {
		this.status = status;
	}
	public byte[] getPhoto() {
		return photo;
	}
	public void setPhoto(byte[] photo) {
		this.photo = photo;
	}
	public UserDto getAuthor() {
		return author;
	}
	public void setAuthor(UserDto author) {
		this.author = author;
	}
	public FolderDto getFolder() {
		return folder;
	}
	public void setFolder(FolderDto folder) {
		this.folder = folder;
	}
	public LocalDateTime getCreateDate() {
		return createDate;
	}
	public void setCreateDate(LocalDateTime createDate) {
		this.createDate = createDate;
	}
	public ArticleDto() {
//		private Long id;
//		private String code;
//		private String title;
//		private String subtitle;
//		private String description;
//		private Integer views;
//		private Integer important;// level of important 1 lowest 2 => higher ++...
//		private Integer status;// 0: published; 1: draft; 2: 
//		private byte[] photo;
//		private UserDto author;
//		private FolderDto folder;
//		private String video_url;
	}
	
	
	//this for the latest
	public ArticleDto(Long id, String title, String subtitle, LocalDateTime publishDate, String imageUrl, String videoUrl, Folder folder, User author,byte[] photo,String articleUrl){
		this.id = id;
		this.title = title;
		this.subtitle = subtitle;
		this.publishDate = publishDate;
		DateTimeFormatter fmt = DateTimeFormat.forPattern(DATE_FORMATTER);
		if(publishDate != null) {
			this.publishDateText = publishDate.toString(fmt);	
		}
		this.imageUrl = imageUrl;
		this.videoUrl = videoUrl;
		this.articleUrl = articleUrl;
		if(photo != null) {
			String encodedString = 
					  Base64.getEncoder().withoutPadding().encodeToString(photo);
			
			this.displayPhoto = "data:image/png;base64," + encodedString;	
		}
		
		if(author != null) {
			User d = author;
			this.author = new UserDto();
			if(d.getPerson() != null) {
				this.author.setDisplayName(d.getPerson().getDisplayName());
			}
		}
		
		if(folder != null) {
			this.folder = new FolderDto(folder.getId(),folder.getUrl(),folder.getName(),folder.getParent());
		}	
	}
	
	//this for the sideCategory
		public ArticleDto(Long id, String title, LocalDateTime publishDate, String imageUrl, String videoUrl, Folder folder, User author,byte[] photo,String subtitle,String articleUrl){
			this.id = id;
			this.title = title;
			this.subtitle = subtitle;
			this.publishDate = publishDate;
			DateTimeFormatter fmt = DateTimeFormat.forPattern(DATE_FORMATTER);
			if(publishDate != null) {
				this.publishDateText = publishDate.toString(fmt);	
			}
			this.imageUrl = imageUrl;
			this.videoUrl = videoUrl;
			this.articleUrl = articleUrl;
			if(photo != null) {
				String encodedString = 
						  Base64.getEncoder().withoutPadding().encodeToString(photo);
				
				this.displayPhoto = "data:image/png;base64," + encodedString;	
			}
			if(author != null) {
				User d = author;
				this.author = new UserDto();
				if(d.getPerson() != null) {
					this.author.setDisplayName(d.getPerson().getDisplayName());
				}
			}
			
			if(folder != null) {
				this.folder = new FolderDto(folder.getId(),folder.getUrl(),folder.getName(),folder.getParent());
			}	
		}
	
	//this for mass schedule
	public ArticleDto(Long id,String imageUrl, String subtitle,byte[] photo,String articleUrl){
		this.id = id;
		this.imageUrl = imageUrl;
		this.subtitle = subtitle;
		this.articleUrl = articleUrl;
		if(photo != null) {
			String encodedString = 
					  Base64.getEncoder().withoutPadding().encodeToString(photo);
			
			this.displayPhoto = "data:image/png;base64," + encodedString;	
		}
	}
	
	//this for bible calendar
	public ArticleDto(Long id, String title, Date specificDate,Integer important,byte[] photo,String articleUrl) {
		this.id = id;
		this.title = title;
		this.specificDate = specificDate;
		this.important = important;
		this.articleUrl = articleUrl;
		if(photo != null) {
			String encodedString = 
					  Base64.getEncoder().withoutPadding().encodeToString(photo);
			
			this.displayPhoto = "data:image/png;base64," + encodedString;	
		}
	}
	private static final String DATE_FORMATTER= "dd-MM-yyyy HH:mm:ss";
	public ArticleDto(Article domain) {
		this.id = domain.getId();
		this.code = domain.getCode();
		this.title = domain.getTitle();
		this.subtitle = domain.getSubtitle();
		this.description = domain.getDescription();
		this.views = domain.getViews();
		this.important = domain.getImportant();
		this.status = domain.getStatus();
		this.content = domain.getContent();
//		this.photo = domain.getPhoto();
		this.videoUrl = domain.getVideoUrl();
		this.imageUrl = domain.getImageUrl();
		this.createDate = domain.getCreateDate();
		this.publishDate = domain.getPublishDate();
		this.hideDate = domain.getHideDate();
		this.specificDate = domain.getSpecificDate();
		this.website = domain.getWebsite();
		this.articleUrl = domain.getArticleUrl();
		this.photo = domain.getPhoto();
		
		DateTimeFormatter fmt = DateTimeFormat.forPattern(DATE_FORMATTER);
		if(domain.getCreateDate() != null) {
			this.createDateText = domain.getCreateDate().toString(fmt);	
		}
		if(domain.getPublishDate() != null) {
			this.publishDateText = domain.getPublishDate().toString(fmt);	
		}
	
		
		if(domain.getPhoto() !=null) {
			String encodedString = 
					  Base64.getEncoder().withoutPadding().encodeToString(domain.getPhoto());
			
			this.displayPhoto = "data:image/png;base64," + encodedString;
		}
		
		
		if(domain != null && domain.getAuthor() != null) {
			User d = domain.getAuthor();
			this.author = new UserDto();
			if(d.getPerson() != null) {
				this.author.setDisplayName(d.getPerson().getDisplayName());
			}
		}
		
		if(domain != null && domain.getFolder() != null) {
			Folder d = domain.getFolder();
			this.folder = new FolderDto();
			this.folder.setCode(d.getCode());
			this.folder.setName(d.getName());
			this.folder.setId(d.getId());
			this.folder.setUrl(d.getUrl());
			this.folder.setType(d.getType());
			if(domain.getFolder().getParent() != null) {
				this.folder.setParent(new FolderDto(domain.getFolder().getParent()));	
			}
//			this.folder.set
		}
		
		
//		if(domain.getPassages() != null && domain.getPassages().size() > 0) {
//			this.passages = new ArrayList<PassageDto>();
//			List<PassageDto> ret = new ArrayList<PassageDto>();
//			for (Passage item : domain.getPassages()) {
//				ret.add(new PassageDto(item));
//			}
//			
//			PassageDto qad = new PassageDto();
//			
//			Collections.sort(ret, new sortByOrdinalNumberPassages());
//			
//			this.passages.addAll(ret);
//		}
	}
	
	public class sortByOrdinalNumberPassages implements Comparator<PassageDto> {
		public int compare(PassageDto a, PassageDto b)
	    {
	        return a.ordinalNumber - b.ordinalNumber;
	    }
	}
}
