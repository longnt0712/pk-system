package com.globits.richy.dto;

import java.io.Serializable;

import com.globits.richy.domain.AllSizes;
import com.globits.richy.domain.Folder;
import com.globits.richy.domain.ImageUrls;

public class ImageUrlsDto implements Serializable{
	private Long id;

	private String imageName;
	private String imagePath;
	
	public Long getId() {
		return id;
	}
	public void setId(Long id) {
		this.id = id;
	}
	
	public String getImageName() {
		return imageName;
	}
	public void setImageName(String imageName) {
		this.imageName = imageName;
	}
	public String getImagePath() {
		return imagePath;
	}
	public void setImagePath(String imagePath) {
		this.imagePath = imagePath;
	}
	public ImageUrlsDto() {
		
	}
	public ImageUrlsDto(ImageUrls domain) {
		this.id = domain.getId();
		this.imageName = domain.getImageName();
		this.imagePath = domain.getImagePath();
	}
	
}
