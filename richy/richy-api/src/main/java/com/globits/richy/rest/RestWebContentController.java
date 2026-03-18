package com.globits.richy.rest;

import java.util.List;

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

import com.globits.richy.domain.Shoes;
import com.globits.richy.domain.ShoesImageUrls;
import com.globits.richy.domain.WebContent;
import com.globits.richy.dto.WebContentDto;
import com.globits.richy.service.WebContentService;

@RestController
@RequestMapping("/api/web_content")
public class RestWebContentController {
	@Autowired
	WebContentService service;
	
//	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/get_page/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<WebContentDto> getPage(@RequestBody WebContentDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		return service.getPageObject(searchDto, pageIndex, pageSize);
	}
//	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/get_one/{id}", method = RequestMethod.GET)
	public WebContentDto getOne(@PathVariable Long id) {
		return service.getObjectById(id);
	}
	
//	@Secured("ROLE_ADMIN")
//	@RequestMapping(value = "/get_by_url/{url}", method = RequestMethod.GET)
//	public WebContentDto getOne(@PathVariable String url) {
//		return service.findByUrl(url);
//	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/save", method = RequestMethod.POST)
	public WebContentDto saveOne(@RequestBody WebContentDto searchDto) {
		return service.saveObject(searchDto);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/delete/{id}", method = RequestMethod.DELETE)
	public boolean saveOne(@PathVariable Long id) {
		return service.deleteObject(id);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/upload_image/{id}", method = RequestMethod.POST)
	public boolean uploadImage(@RequestParam("file") MultipartFile file, @PathVariable Long id) {

		WebContentDto webContentDto = service.getObjectById(id);
		
		if(webContentDto != null) {
//			si.setShoes(shoes);
			try {
				if (!file.isEmpty()) {
					byte[] data = file.getBytes();

					if (data != null && data.length > 0) {
						
						webContentDto.setPhoto(data);
						service.saveObject(webContentDto);
					}
				}
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
		
		
		return false;
	}
}
