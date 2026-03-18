package com.globits.richy.service.impl;

import java.io.BufferedWriter;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.DirectoryNotEmptyException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import static java.util.Calendar.*;
import static java.util.Calendar.DAY_OF_MONTH;
import java.util.Date;
import java.util.List;

import javax.persistence.EntityManager;
import javax.persistence.Query;

import org.joda.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import com.globits.richy.ChurchConstant;
import com.globits.richy.domain.Article;
import com.globits.richy.domain.Folder;
import com.globits.richy.dto.ArticleDto;
import com.globits.richy.dto.ListArticleForCategoryDto;
import com.globits.richy.repository.ArticleRepository;
import com.globits.richy.repository.FolderRepository;
import com.globits.richy.repository.PassageRepository;
import com.globits.richy.service.ArticleService;
import com.globits.security.domain.User;
import com.globits.security.repository.UserRepository;

@Service
public class ArticleServiceImpl implements ArticleService {
	@Autowired
	EntityManager manager;
	@Autowired
	ArticleRepository articleRepository;
	@Autowired
	PassageRepository passageRepository;
	@Autowired
	FolderRepository folderRepository;
	@Autowired
	UserRepository userRepository;

	@Override
	public Page<ArticleDto> getPageObject(ArticleDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.ArticleDto(s) from Article s where (1=1)";
		String sqlCount = "select count(s.id) from Article s where (1=1)";
		String whereClause = "";

		if (textSearch != null && textSearch.length() > 0) {
			whereClause += " and (s.title like :textSearch)";
		}
		
		
		
		if (searchDto.getFolderUrl() != null && searchDto.getFolderUrl().length() > 0 && searchDto.getFolderType() == null) {
			whereClause += " and (s.folder.url = :folderUrl)";
			whereClause += " and (s.status = 1)"; //list all published
		} else if(searchDto.getStatus() != null) {
			whereClause += " and (s.status = :status)"; 
			
		}
		
		if(searchDto.getFolder() != null && searchDto.getFolder().getId() != null) {
			whereClause += " and (s.folder.id = :folderId)";	
		}
		
		if(searchDto.getWebsite() != null) {
			whereClause += " and (s.website = :website)";	
		}
		
		if(searchDto.getFolderType() != null) {
			whereClause += " and (s.folder.type = :folderType)";
			whereClause += " and (s.status = 1)"; //list all published
		}

		sql += whereClause;
		sqlCount += whereClause;
		
		sql += " order by s.important DESC, s.publishDate DESC,s.createDate DESC ";

		Query q = manager.createQuery(sql, ArticleDto.class);
		Query qCount = manager.createQuery(sqlCount);

		if (textSearch != null && textSearch.length() > 0) {
			q.setParameter("textSearch", '%' + textSearch + '%');
			qCount.setParameter("textSearch", '%' + textSearch + '%');
		}
		
		if (searchDto.getFolderUrl() != null && searchDto.getFolderUrl().length() > 0 && searchDto.getFolderType() == null) {
			q.setParameter("folderUrl",  searchDto.getFolderUrl());
			qCount.setParameter("folderUrl", searchDto.getFolderUrl());
		}
		
		if(searchDto.getFolderType() != null) {
			q.setParameter("folderType",  searchDto.getFolderType());
			qCount.setParameter("folderType", searchDto.getFolderType());
		}
		
		if(searchDto.getStatus() != null) {
			q.setParameter("status",  searchDto.getStatus());
			qCount.setParameter("status", searchDto.getStatus());
		}
		
		if(searchDto.getFolder() != null && searchDto.getFolder().getId() != null) {
			q.setParameter("folderId",  searchDto.getFolder().getId());
			qCount.setParameter("folderId", searchDto.getFolder().getId());
		}
		
		if(searchDto.getWebsite() != null) {
			q.setParameter("website",  searchDto.getWebsite());
			qCount.setParameter("website", searchDto.getWebsite());
		}

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<ArticleDto> page = new PageImpl<ArticleDto>(q.getResultList(), pageable, numberResult);
		return page;
	}
	
	public Page<ArticleDto> getPageSideCategory(ArticleDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();

		String sql = "select s from Article s where (1=1)";
		String sqlCount = "select count(s.id) from Article s where (1=1)";
		String whereClause = "";

		if (textSearch != null && textSearch.length() > 0) {
			whereClause += " and (s.title like :textSearch)";
		}
		
		if(searchDto.getWebsite() != null) {
			whereClause += " and (s.website = :website)";	
		}
		
		
		
		if (searchDto.getFolderUrl() != null && searchDto.getFolderUrl().length() > 0 && searchDto.getFolderType() == null) {
			whereClause += " and (s.folder.url = :folderUrl)";
			whereClause += " and (s.status = 1)"; //list all published
		} else if(searchDto.getStatus() != null) {
			whereClause += " and (s.status = :status)"; 
			
		}
		
		if(searchDto.getFolder() != null && searchDto.getFolder().getId() != null) {
			whereClause += " and (s.folder.id = :folderId)";	
		}
		
		if(searchDto.getFolderType() != null) {
			whereClause += " and (s.folder.type = :folderType)";
			whereClause += " and (s.status = 1)"; //list all published
		}

		sql += whereClause;
		sqlCount += whereClause;
		
		sql += " order by s.important DESC, s.publishDate DESC,s.createDate DESC ";

		Query q = manager.createQuery(sql, Article.class);
		Query qCount = manager.createQuery(sqlCount);

		if(searchDto.getWebsite() != null) {
			q.setParameter("website",  searchDto.getWebsite());
			qCount.setParameter("website", searchDto.getWebsite());
		}
		
		if (textSearch != null && textSearch.length() > 0) {
			q.setParameter("textSearch", '%' + textSearch + '%');
			qCount.setParameter("textSearch", '%' + textSearch + '%');
		}
		
		if (searchDto.getFolderUrl() != null && searchDto.getFolderUrl().length() > 0 && searchDto.getFolderType() == null) {
			q.setParameter("folderUrl",  searchDto.getFolderUrl());
			qCount.setParameter("folderUrl", searchDto.getFolderUrl());
		}
		
		if(searchDto.getFolderType() != null) {
			q.setParameter("folderType",  searchDto.getFolderType());
			qCount.setParameter("folderType", searchDto.getFolderType());
		}
		
		if(searchDto.getStatus() != null) {
			q.setParameter("status",  searchDto.getStatus());
			qCount.setParameter("status", searchDto.getStatus());
		}
		
		if(searchDto.getFolder() != null && searchDto.getFolder().getId() != null) {
			q.setParameter("folderId",  searchDto.getFolder().getId());
			qCount.setParameter("folderId", searchDto.getFolder().getId());
		}

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		List<ArticleDto> dtos = new ArrayList<ArticleDto>();
		List<Article> domains = q.getResultList();
		if(domains != null && domains.size() > 0) {
			for (Article article : domains) {
				dtos.add(new ArticleDto(article.getId(),article.getTitle(),article.getPublishDate(),article.getImageUrl(),article.getVideoUrl(),article.getFolder(),article.getAuthor(),article.getPhoto(),article.getSubtitle(),article.getArticleUrl()));
			}
		}
		
		Page<ArticleDto> page = new PageImpl<ArticleDto>(dtos, pageable, numberResult);
		return page;
	}
	
	@Override
	public Page<ArticleDto> getTheLatest(ArticleDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String sql = "select s from Article s where (1=1)";
		String sqlCount = "select count(s.id) from Article s where (1=1)";
		String whereClause = "";		
		
		if (searchDto.getFolderUrl() != null && searchDto.getFolderUrl().length() > 0 && searchDto.getFolderType() == null) {
			whereClause += " and (s.folder.url = :folderUrl)";
			whereClause += " and (s.status = 1)"; //list all published
		} else if(searchDto.getStatus() != null) {
			whereClause += " and (s.status = :status)"; 
			
		}
		
		if(searchDto.getWebsite() != null) {
			whereClause += " and (s.website = :website)";	
		}
		if(searchDto.getFolder() != null && searchDto.getFolder().getId() != null) {
			whereClause += " and (s.folder.id = :folderId)";	
		}
		
		if(searchDto.getFolderType() != null) {
			whereClause += " and (s.folder.type = :folderType)";
			whereClause += " and (s.status = 1)"; //list all published
		}

		sql += whereClause;
		sqlCount += whereClause;
		
		sql += " order by s.important DESC, s.publishDate DESC,s.createDate DESC ";

		Query q = manager.createQuery(sql, Article.class);
		Query qCount = manager.createQuery(sqlCount);
		
		if(searchDto.getWebsite() != null) {
			q.setParameter("website",  searchDto.getWebsite());
			qCount.setParameter("website", searchDto.getWebsite());
		}
		
		if (searchDto.getFolderUrl() != null && searchDto.getFolderUrl().length() > 0 && searchDto.getFolderType() == null) {
			q.setParameter("folderUrl",  searchDto.getFolderUrl());
			qCount.setParameter("folderUrl", searchDto.getFolderUrl());
		}
		
		if(searchDto.getFolderType() != null) {
			q.setParameter("folderType",  searchDto.getFolderType());
			qCount.setParameter("folderType", searchDto.getFolderType());
		}
		
		if(searchDto.getStatus() != null) {
			q.setParameter("status",  searchDto.getStatus());
			qCount.setParameter("status", searchDto.getStatus());
		}
		
		if(searchDto.getFolder() != null && searchDto.getFolder().getId() != null) {
			q.setParameter("folderId",  searchDto.getFolder().getId());
			qCount.setParameter("folderId", searchDto.getFolder().getId());
		}

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();
		
		List<ArticleDto> dtos = new ArrayList<ArticleDto>();
		List<Article> domains = q.getResultList();
		if(domains != null && domains.size() > 0) {
			for (Article article : domains) {
				dtos.add(new ArticleDto(article.getId(),article.getTitle(),article.getSubtitle(),article.getPublishDate(),article.getImageUrl(),article.getVideoUrl(),article.getFolder(),article.getAuthor(),article.getPhoto(),article.getArticleUrl()));
			}
		}
		
	

		Page<ArticleDto> page = new PageImpl<ArticleDto>(dtos, pageable, numberResult);
		return page;
	}
	
	@Override
	public Page<ArticleDto> getMassSchedule(ArticleDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String sql = "select s from Article s where (1=1)";
		String sqlCount = "select count(s.id) from Article s where (1=1)";
		String whereClause = "";		
		
		if (searchDto.getFolderUrl() != null && searchDto.getFolderUrl().length() > 0 && searchDto.getFolderType() == null) {
			whereClause += " and (s.folder.url = :folderUrl)";
			whereClause += " and (s.status = 1)"; //list all published
		} else if(searchDto.getStatus() != null) {
			whereClause += " and (s.status = :status)"; 
			
		}
		
		if(searchDto.getWebsite() != null) {
			whereClause += " and (s.website = :website)";	
		}
		
		if(searchDto.getFolder() != null && searchDto.getFolder().getId() != null) {
			whereClause += " and (s.folder.id = :folderId)";	
		}
		
		if(searchDto.getFolderType() != null) {
			whereClause += " and (s.folder.type = :folderType)";
			whereClause += " and (s.status = 1)"; //list all published
		}

		sql += whereClause;
		sqlCount += whereClause;
		
		sql += " order by s.important DESC, s.publishDate DESC,s.createDate DESC ";

		Query q = manager.createQuery(sql, Article.class);
		Query qCount = manager.createQuery(sqlCount);
		
		if (searchDto.getFolderUrl() != null && searchDto.getFolderUrl().length() > 0 && searchDto.getFolderType() == null) {
			q.setParameter("folderUrl",  searchDto.getFolderUrl());
			qCount.setParameter("folderUrl", searchDto.getFolderUrl());
		}
		
		if(searchDto.getFolderType() != null) {
			q.setParameter("folderType",  searchDto.getFolderType());
			qCount.setParameter("folderType", searchDto.getFolderType());
		}
		
		if(searchDto.getStatus() != null) {
			q.setParameter("status",  searchDto.getStatus());
			qCount.setParameter("status", searchDto.getStatus());
		}
		
		if(searchDto.getFolder() != null && searchDto.getFolder().getId() != null) {
			q.setParameter("folderId",  searchDto.getFolder().getId());
			qCount.setParameter("folderId", searchDto.getFolder().getId());
		}
		
		if(searchDto.getWebsite() != null) {
			q.setParameter("website",  searchDto.getWebsite());
			qCount.setParameter("website", searchDto.getWebsite());
		}

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();
		
		List<ArticleDto> dtos = new ArrayList<ArticleDto>();
		List<Article> domains = q.getResultList();
		if(domains != null && domains.size() > 0) {
			for (Article article : domains) {
				dtos.add(new ArticleDto(article.getId(),article.getImageUrl(),article.getSubtitle(),article.getPhoto(),article.getArticleUrl()));
			}
		}	
	
		Page<ArticleDto> page = new PageImpl<ArticleDto>(dtos, pageable, numberResult);
		return page;
	}
	
	@Override
	public Page<ArticleDto> getBibleCalendar(ArticleDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String sql = "select s from Article s where (1=1)";
		String sqlCount = "select count(s.id) from Article s where (1=1)";
		String whereClause = "";		
		
		if (searchDto.getFolderUrl() != null && searchDto.getFolderUrl().length() > 0 && searchDto.getFolderType() == null) {
			whereClause += " and (s.folder.url = :folderUrl)";
			whereClause += " and (s.status = 1)"; //list all published
		} else if(searchDto.getStatus() != null) {
			whereClause += " and (s.status = :status)"; 
			
		}
		
		whereClause += " and (s.specificDate >= :firstDay) "; 	 
		whereClause += " and (s.specificDate < :lastDay) "; 
		
		if(searchDto.getFolder() != null && searchDto.getFolder().getId() != null) {
			whereClause += " and (s.folder.id = :folderId)";	
		}
		
		if(searchDto.getWebsite() != null) {
			whereClause += " and (s.website = :website) ";	
		}
		
		if(searchDto.getFolderType() != null) {
			whereClause += " and (s.folder.type = :folderType)";
			whereClause += " and (s.status = 1)"; //list all published
		}

		sql += whereClause;
		sqlCount += whereClause;
		
		sql += " order by s.important DESC, s.publishDate DESC,s.createDate DESC ";

		Query q = manager.createQuery(sql, Article.class);
		Query qCount = manager.createQuery(sqlCount);
		
		if(searchDto.getFirstDay() != null && searchDto.getLastDay() != null) {
//			System.out.println("First day : " + searchDto.getFirstDay());
//			System.out.println("Last day: " + searchDto.getLastDay());
			 
			q.setParameter("firstDay",  searchDto.getFirstDay());
			qCount.setParameter("firstDay", searchDto.getFirstDay());			 
			q.setParameter("lastDay",  searchDto.getLastDay());
			qCount.setParameter("lastDay", searchDto.getLastDay());
			
		}else {
			Date firstDay = new Date();
			Calendar cal = Calendar.getInstance();
	        
			cal.setTime(firstDay);
	        cal.set(Calendar.DAY_OF_MONTH, cal.getActualMinimum(Calendar.DAY_OF_MONTH));
	        cal.set(Calendar.HOUR_OF_DAY, 0);
	        cal.set(Calendar.MINUTE, 0);
	        cal.set(Calendar.SECOND, 0);
	        cal.set(Calendar.MILLISECOND, 0);
//	        System.out.println("First day of the month: " + cal.getTime());
	        
	        
	        Calendar today = getInstance();
	        today.set(HOUR_OF_DAY, 0);
	        today.set(MINUTE, 0);
	        today.set(SECOND, 0);
	        today.set(MILLISECOND, 0);
	        
	        Calendar next = getInstance();
	        next.clear();
	        next.set(YEAR, today.get(YEAR));
	        next.set(MONTH, today.get(MONTH) + 1);
	        next.set(DAY_OF_MONTH, 1); // optional, default: 1, our need
//	        System.out.println("next  date: " + next.getTime());
	        
	        
	        q.setParameter("firstDay",  cal.getTime());
			qCount.setParameter("firstDay", cal.getTime());			 
			q.setParameter("lastDay",  next.getTime());
			qCount.setParameter("lastDay", next.getTime());
		}
		
		if (searchDto.getFolderUrl() != null && searchDto.getFolderUrl().length() > 0 && searchDto.getFolderType() == null) {
			q.setParameter("folderUrl",  searchDto.getFolderUrl());
			qCount.setParameter("folderUrl", searchDto.getFolderUrl());
		}
		
		if(searchDto.getFolderType() != null) {
			q.setParameter("folderType",  searchDto.getFolderType());
			qCount.setParameter("folderType", searchDto.getFolderType());
		}
		
		if(searchDto.getStatus() != null) {
			q.setParameter("status",  searchDto.getStatus());
			qCount.setParameter("status", searchDto.getStatus());
		}
		
		if(searchDto.getFolder() != null && searchDto.getFolder().getId() != null) {
			q.setParameter("folderId",  searchDto.getFolder().getId());
			qCount.setParameter("folderId", searchDto.getFolder().getId());
		}
		
		if(searchDto.getWebsite() != null) {
			q.setParameter("website",  searchDto.getWebsite());
			qCount.setParameter("website", searchDto.getWebsite());
		}

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();
		
		List<ArticleDto> dtos = new ArrayList<ArticleDto>();
		List<Article> domains = q.getResultList();
		if(domains != null && domains.size() > 0) {
			for (Article article : domains) {
				dtos.add(new ArticleDto(article.getId(),article.getTitle(),article.getSpecificDate(),article.getImportant(),article.getPhoto(),article.getArticleUrl()));
			}
		}	
	
		Page<ArticleDto> page = new PageImpl<ArticleDto>(dtos, pageable, numberResult);
		return page;
	}
	
	@Override
	public ListArticleForCategoryDto getPageObjectSideCategory(ArticleDto searchDto, int pageIndex, int pageSize) {
		ListArticleForCategoryDto ret = new ListArticleForCategoryDto();
		
		searchDto.setFolderType(1); //thong bao
		ret.setNotifications(getPageSideCategory(searchDto,pageIndex,pageSize).getContent());
		
		searchDto.setFolderType(2); //tin tic
		ret.setNews(getPageSideCategory(searchDto,pageIndex,pageSize).getContent());
		
		searchDto.setFolderType(3); //lich le
		ret.setMassSchedules(getPageSideCategory(searchDto,pageIndex,pageSize).getContent());
		
		searchDto.setFolderType(4); //Loi Chua
		ret.setBibles(getPageSideCategory(searchDto,pageIndex,pageSize).getContent());
		
		return ret;
	}

	@Override
	public List<ArticleDto> getListObject(ArticleDto searchDto, int pageIndex, int pageSize) {
		return null;
	}

	@Override
	public ArticleDto getObjectById(Long id) {
		return new ArticleDto(articleRepository.getOne(id));
	}

	@Override
	public boolean saveObject(ArticleDto dto) {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User modifiedUser = null;
		LocalDateTime currentDate = LocalDateTime.now();
		String currentUserName = "Unknown User";
		if (authentication != null) {
			modifiedUser = (User) authentication.getPrincipal();
			currentUserName = modifiedUser.getUsername();
		}
		if(dto == null) {
			return false;
		}
		Article domain = null;
		if(dto.getId() != null) {
			domain = articleRepository.getOne(dto.getId());
		}
		if(domain != null) {
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(currentDate);
		}
		if(domain == null) {
			domain = new Article();
			domain.setCreateDate(currentDate);
			domain.setCreatedBy(currentUserName);
		}
		
		//publish issue
		//0: save as normal
		if(dto.getPublishType() == 1) { //1: xuất bản
			domain.setPublishDate(currentDate);
			domain.setStatus(dto.getStatus());
		} else if(dto.getPublishType() == 2) { //2: gỡ/ẩn
			domain.setHideDate(currentDate);
			domain.setStatus(dto.getStatus());
		}else {
			domain.setStatus(dto.getStatus());
		}
		
		domain.setCode(dto.getCode());
		domain.setTitle(dto.getTitle());
		domain.setSubtitle(dto.getSubtitle());
		domain.setDescription(dto.getDescription());
		domain.setViews(dto.getViews());
		if(dto.getImportant() == null) {
			domain.setImportant(1);
		}
		domain.setImportant(dto.getImportant());
		
		domain.setContent(dto.getContent());
		domain.setVideoUrl(dto.getVideoUrl());
		domain.setImageUrl(dto.getImageUrl());
		domain.setSpecificDate(dto.getSpecificDate());
		domain.setWebsite(dto.getWebsite());
		domain.setArticleUrl(dto.getArticleUrl());
//		this.photo = domain.getPhoto();
		
		if(dto.getFolder() != null && dto.getFolder().getId() != null) {
			Folder f = folderRepository.getOne(dto.getFolder().getId());
			if(f!=null) {
				domain.setFolder(f);
			}
		}
		
		if(dto.getAuthor() != null && dto.getAuthor().getId() != null) {
			User author = userRepository.getOne(dto.getAuthor().getId());
			if(author!=null) {
				domain.setAuthor(author);
			}
		}
		
		
		domain = articleRepository.save(domain);
		
		try {
			String childPath = domain.getFolder().getUrl();
			String parentPath = domain.getFolder().getUrl();
			
			if(domain.getFolder() != null && domain.getFolder().getParent() != null) {
				parentPath = domain.getFolder().getParent().getUrl();
			}
			
			
			String u = "";
			if(dto.getWebsite() == 1) {
				u = ChurchConstant.churchFolderPath;
			}
			
//            String localPath = ChurchConstant.uploadImagePath + parentPath +"/" + childPath +"/" + domain.getId() +".html";
			String localPath = u + parentPath +"/" + childPath +"/" + domain.getId() +".html";
			String folderPath = u + parentPath +"/" + childPath +"/";
			File file = new File(localPath);
			
//			Files.deleteIfExists(Paths.get("d:/sampleFile.html"));
			
                       
            if (!Files.exists(Paths.get(folderPath))) {
                Files.createDirectories(Paths.get(folderPath));
            }
            
            if(file.isFile() && file.exists() && ! file.isDirectory()) { 
            	Files.delete(Paths.get(localPath));
            }
            
            try {
                file = new File(localPath);                              
                
                if(file.createNewFile()) {
                	String title = domain.getTitle();
                	String appId = "367012131893866"; //tạm thời gửi luôn id vào đây
                	
                	String description = domain.getSubtitle();
                	String type ="article";
                	String imageUrl = domain.getImageUrl();
                	
                	String domainUrl = ChurchConstant.domainUrl;
                	
                	if(dto.getWebsite() == 1) {
                		domainUrl = ChurchConstant.churchDomainUrl;
                	}
                	
                	String ogUrl = domainUrl;
                	String redirectHtml = "";
                	if(domain.getFolder() != null && domain.getFolder().getParent() != null) {
                		redirectHtml = domainUrl+domain.getFolder().getParent().getUrl()+"/"+domain.getFolder().getUrl()+"/"+domain.getId();
                		ogUrl = redirectHtml + ".html";
                		redirectHtml = domainUrl+domain.getFolder().getParent().getUrl()+"-chung/"+domain.getFolder().getUrl()+"/"+domain.getId();
                	} else {
                		redirectHtml = domainUrl+domain.getFolder().getUrl()+"/"+domain.getFolder().getUrl()+"/"+domain.getId();
                		ogUrl = redirectHtml + ".html";;
                		redirectHtml = domainUrl+domain.getFolder().getUrl()+"-chung/"+domain.getFolder().getUrl()+"/"+domain.getId();
                	}
                	
                	
                	String html1 ="<!DOCTYPE html>";
                	String html2 ="<html>";
                	String html3 ="<head>";
                	String html31 ="<title>" + title + "</title>";
                	String html32 ="<meta property=\"fb:app_id\" content=\""+ appId +"\" />";
                	String html33 ="<meta property=\"og:url\" content=\""+ ogUrl +"\" />";
                	String html34 ="<meta property=\"og:type\" content=\""+ type +"\" />";
                	String html35 ="<meta property=\"og:title\" content=\""+ title +"\" />";
                	if(description== null || description.length() <= 0) {
                		description = "";
                	}
                	String html36 ="<meta property=\"og:description\" content=\""+ description +"\" />";
                	String html37 ="<meta property=\"og:image\" content=\""+ imageUrl +"\" />";    
                	String html4 ="</head>";
                	String html5 ="<body>";
                	String html51 ="<script>";
                	String html52 ="window.location.href = \""+ redirectHtml +"\";";
                	String html53 ="</script>";
                	String html6 ="</body>";
                	String html7 ="</html>";
                	              
                	List<String> lines = Arrays.asList(
                			html1,
                			html2,
                			html3,
                			html31,
                			html32,
                			html33,
                			html34,
                			html35,
                			html36,
                			html37,            			
                			html4,
                			html5,
                			html51,
                			html52,
                			html53,
                			html6,
                			html7);
                	Path path = Paths.get(localPath);
                	Files.write(path, lines, StandardCharsets.UTF_8);
                	//Files.write(file, lines, StandardCharsets.UTF_8, StandardOpenOption.APPEND);
                	
//                	BufferedWriter bufferedWriter = Files.newBufferedWriter(Paths.get("d:/sampleFile.html"));
//                    bufferedWriter.write("hehehe"); // to write some data
//                	System.out.println("File creation successfull");
                }
                    
                else
                    System.out.println("Error while creating File, file already exists in specified path");
            }
            catch(IOException io) {
                io.printStackTrace();
            }
        }
        catch (NoSuchFileException e) {
            System.out.println("No such file/directory exists");
        }
        catch (DirectoryNotEmptyException e) {
            System.out.println("Directory is not empty.");
        }
        catch (IOException e) {
            System.out.println("Invalid permissions.");
        }
 
		return false;
	}

	@Override
	public boolean deleteObject(Long id) {
		if(id == null) {
			return false;
		}
		Article domain = articleRepository.getOne(id);
		if(domain == null) {
			return false;
		}
		articleRepository.delete(domain);
		return true;
	}

	@Override
	public boolean saveViews(ArticleDto dto) {
//		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
//		User modifiedUser = null;
//		LocalDateTime currentDate = LocalDateTime.now();
//		String currentUserName = "Unknown User";
//		if (authentication != null) {
//			modifiedUser = (User) authentication.getPrincipal();
//			currentUserName = modifiedUser.getUsername();
//		}
		if(dto == null) {
			return false;
		}
		Article domain = null;
		if(dto.getId() != null) {
			domain = articleRepository.getOne(dto.getId());
		}
//		if(domain != null) {
//			domain.setModifiedBy(currentUserName);
//			domain.setModifyDate(currentDate);
//		}
		if(domain == null) {
			return false;
		}
		
		domain.setViews(dto.getViews());
				
		domain = articleRepository.save(domain);
				
		return false;
	}
}
