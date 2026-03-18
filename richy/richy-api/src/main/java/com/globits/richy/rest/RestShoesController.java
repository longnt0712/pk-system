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
import com.globits.richy.domain.Shoes;
import com.globits.richy.domain.ShoesImageUrls;
import com.globits.richy.dto.ShoesDto;
import com.globits.richy.repository.ShoesImageUrlsRepository;
import com.globits.richy.repository.ShoesRepository;
import com.globits.richy.service.ShoesService;

@RestController
@RequestMapping("/api/shoes")
public class RestShoesController {
	@Autowired
	ShoesService service;
	@Autowired
	ShoesImageUrlsRepository shoesImageUrlsRepository;
	@Autowired
	ShoesRepository shoesRepository;
	
	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/get_page/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<ShoesDto> getPage(@RequestBody ShoesDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		return service.getPageObject(searchDto, pageIndex, pageSize);
	}
	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/get_one/{id}", method = RequestMethod.GET)
	public ShoesDto getOne(@PathVariable Long id) {
		return service.getObjectById(id);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/save", method = RequestMethod.POST)
	public ShoesDto saveOne(@RequestBody ShoesDto searchDto) {
		return service.saveObject(searchDto);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/delete/{id}", method = RequestMethod.DELETE)
	public boolean saveOne(@PathVariable Long id) {
		return service.deleteObject(id);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/upload_image/{shoesId}", method = RequestMethod.POST)
	public boolean uploadImage(@RequestParam("file") MultipartFile file, @PathVariable Long shoesId) {

		ShoesImageUrls si = new ShoesImageUrls();
		
		Shoes shoes = shoesRepository.getOne(shoesId);
		
		if(shoes != null) {
			si.setShoes(shoes);
			try {
				if (!file.isEmpty()) {
					byte[] data = file.getBytes();

					if (data != null && data.length > 0) {
						if(shoes.getShoesImageUrls() != null) {
							si.setOrdinalNumber(shoes.getShoesImageUrls().size() + 1);	
						}
						si.setPhoto(data);
						shoesImageUrlsRepository.save(si);
					}
				}
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
		
		
		return false;
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/upload_image_oad/{shoesId}", method = RequestMethod.POST)
	public boolean uploadImage2(@RequestParam("file") MultipartFile file, @PathVariable Long shoesId) {
		
 		if(shoesId == null) {
			return false;
		}
		
		Shoes shoes = shoesRepository.getOne(shoesId);
		if(shoes == null) {
			return false;
		}
		
		String fileName = file.getOriginalFilename();
//		String extension = FilenameUtils.getExtension(file.getOriginalFilename());
		
		ShoesImageUrls si = new ShoesImageUrls();
		si.setShoes(shoes);
		shoesImageUrlsRepository.save(si);
		fileName = si.getId() + "." + shoesId + "." + fileName;
		si.setImagePath(fileName);
		shoesImageUrlsRepository.save(si);
		
		String uploadDir = ChurchConstant.oadUploadImage;
		
		try {
			if(file != null) {
				test.saveFile(uploadDir, fileName, file);
			}
			
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		
		return false;
	}
	
	
	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/delete_image_oad/{shoesImageUrlsId}", method = RequestMethod.DELETE)
	public boolean deleteImageOad(@PathVariable Long shoesImageUrlsId) {
		
		ShoesImageUrls si = shoesImageUrlsRepository.getOne(shoesImageUrlsId);
		if(si == null) return false;
		
		
		String imagePath = null;
		if(si != null) {
			imagePath = si.getImagePath();
			shoesImageUrlsRepository.delete(si);
		}
		
		String uploadDir = ChurchConstant.oadUploadImage;	
		
		if(imagePath != null) {
			try {
				test.deleteFileOad(uploadDir, imagePath);
			} catch (IOException e) {
				// TODO Auto-generated catch block
				e.printStackTrace();
			}
		}
		
		return false;
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/delete_image/{shoesImageUrlsId}", method = RequestMethod.DELETE)
	public boolean deleteImage(@PathVariable Long shoesImageUrlsId) {
//		return service.deleteObject(id);
//		String uploadDir = "D:/shoes/upload-images";
//		try {
//			if(file != null) {
//				System.out.println(file.getOriginalFilename());
//				test.saveFile(uploadDir, file.getOriginalFilename(), file);
//				
////				ShoesDto shoes = service.getObjectById(shoesId);
//				//tạo 1 imageUrl
//				
//				
//			}
//			
//		} catch (IOException e) {
//			// TODO Auto-generated catch block
//			e.printStackTrace();
//		}
		
		ShoesImageUrls si = shoesImageUrlsRepository.getOne(shoesImageUrlsId);
		if(si != null) {
			shoesImageUrlsRepository.delete(si);
		}
	
		
		
		return false;
	}
}
