package com.globits.richy.rest;

import java.io.IOException;
import java.util.List;

import org.apache.commons.io.FilenameUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.globits.richy.ChurchConstant;
import com.globits.richy.test;
import com.globits.richy.domain.Article;
import com.globits.richy.domain.Shoes;
import com.globits.richy.domain.ShoesImageUrls;
import com.globits.richy.dto.ArticleDto;
import com.globits.richy.repository.ArticleRepository;
import com.globits.richy.service.ArticleService;

@RestController
@RequestMapping("/api/article")
public class RestArticleController {
	@Autowired
	ArticleService service;
	@Autowired
	ArticleRepository articleRepository;
	
//	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/get_page/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<ArticleDto> getPage(@RequestBody ArticleDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		return service.getPageObject(searchDto, pageIndex, pageSize);
	}
//	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/get_one/{id}", method = RequestMethod.GET)
	public ArticleDto getOne(@PathVariable Long id) {
		return service.getObjectById(id);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/save", method = RequestMethod.POST)
	public boolean saveOne(@RequestBody ArticleDto searchDto) {
		return service.saveObject(searchDto);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/delete/{id}", method = RequestMethod.DELETE)
	public boolean saveOne(@PathVariable Long id) {
		return service.deleteObject(id);
	}
//	
//	@Secured({"ROLE_ADMIN","ROLE_USER"})
//	@RequestMapping(value = "/upload_image/{folderUrl}", method = RequestMethod.POST)
//	public boolean uploadImage(@RequestParam("file") MultipartFile file, @PathVariable String folderUrl) {
////		return service.deleteObject(id);
//		String uploadDir = ChurchConstant.uploadImagePath + folderUrl;
//		try {
//			if(file != null) {
////				System.out.println(file.getOriginalFilename());
//				test.saveFile(uploadDir, file.getOriginalFilename(), file);
//			}
//			
//		} catch (IOException e) {
//			// TODO Auto-generated catch block
//			e.printStackTrace();
//		}
//		return false;
//	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/upload_image/{articleId}/{folderUrl}", method = RequestMethod.POST)
	public boolean uploadImage(@RequestParam("file") MultipartFile file, @PathVariable Long articleId,@PathVariable String folderUrl) {
		
		Article article = articleRepository.getOne(articleId);
		
		String parentPath = article.getFolder().getUrl();
		if(article.getFolder() != null && article.getFolder().getParent() != null) {
			parentPath = article.getFolder().getParent().getUrl();
		}
		
		String uploadDir = ChurchConstant.churchFolderPath + parentPath + '/' + folderUrl;
		
		try {
			if(file != null) {
//				System.out.println(file.getOriginalFilename());
				String fileName = file.getOriginalFilename();
//				String fileNameWithOutExt = FilenameUtils.removeExtension(fileName);
				String extension = FilenameUtils.getExtension(file.getOriginalFilename());
				if(article != null) {
					fileName = article.getId() + "." + article.getArticleUrl() +'.'+extension;
					
//					String parentPath = article.getFolder().getUrl();
//					if(article.getFolder() != null && article.getFolder().getParent() != null) {
//						parentPath = article.getFolder().getParent().getUrl();
//					}
					
					String imageUrl = ChurchConstant.churchDomainUrl + parentPath + "/" + folderUrl + "/" + fileName;
					article.setImageUrl(imageUrl);
					articleRepository.save(article);
				}
				test.saveFile(uploadDir, fileName, file);
			}
			
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		
//		if(article != null) {
//			try {
//				if (!file.isEmpty()) {
//					byte[] data = file.getBytes();
//
//					if (data != null && data.length > 0) {
//						article.setPhoto(data);
//						articleRepository.save(article);
//					}
//				}
//			} catch (Exception e) {
//				e.printStackTrace();
//			}
//		}
		
		
		return false;
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/delete_image/{articleId}", method = RequestMethod.DELETE)
	public boolean deleteImage(@PathVariable Long articleId) {
		
		Article article = articleRepository.getOne(articleId);
		if(article != null) {
			article.setPhoto(null);
			articleRepository.save(article);
		}
	
		
		
		return false;
	}
}
