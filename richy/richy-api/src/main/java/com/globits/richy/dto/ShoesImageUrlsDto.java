package com.globits.richy.dto;

import java.io.Serializable;
import java.util.Base64;

import com.globits.richy.domain.Folder;
import com.globits.richy.domain.ImageUrls;
import com.globits.richy.domain.Shoes;
import com.globits.richy.domain.ShoesImageUrls;

public class ShoesImageUrlsDto implements Serializable{
	private Long id;

	private ShoesDto shoes;
	private ImageUrlsDto imageUrl;
	private Integer ordinalNumber;
	private byte[] photo;
	private byte[] photo2;
	private String displayPhoto;
	private String displayPhoto2;
	private String imagePath;
	
	public String getImagePath() {
		return imagePath;
	}
	public void setImagePath(String imagePath) {
		this.imagePath = imagePath;
	}
	public String getDisplayPhoto2() {
		return displayPhoto2;
	}
	public void setDisplayPhoto2(String displayPhoto2) {
		this.displayPhoto2 = displayPhoto2;
	}
	public byte[] getPhoto2() {
		return photo2;
	}
	public void setPhoto2(byte[] photo2) {
		this.photo2 = photo2;
	}
	public Long getId() {
		return id;
	}
	public void setId(Long id) {
		this.id = id;
	}
	public ShoesDto getShoes() {
		return shoes;
	}
	public void setShoes(ShoesDto shoes) {
		this.shoes = shoes;
	}
	public ImageUrlsDto getImageUrl() {
		return imageUrl;
	}
	public void setImageUrl(ImageUrlsDto imageUrl) {
		this.imageUrl = imageUrl;
	}
	public Integer getOrdinalNumber() {
		return ordinalNumber;
	}
	public void setOrdinalNumber(Integer ordinalNumber) {
		this.ordinalNumber = ordinalNumber;
	}
	
	public byte[] getPhoto() {
		return photo;
	}
	public void setPhoto(byte[] photo) {
		this.photo = photo;
	}
	public String getDisplayPhoto() {
		return displayPhoto;
	}
	public void setDisplayPhoto(String displayPhoto) {
		this.displayPhoto = displayPhoto;
	}
	public ShoesImageUrlsDto() {
		
	}
	public ShoesImageUrlsDto(ShoesImageUrls domain) {
		this.id = domain.getId();
		this.ordinalNumber = domain.getOrdinalNumber();
		
		this.photo = domain.getPhoto();
		this.imagePath = domain.getImagePath();
		if(domain.getPhoto() != null) {
			
			String encodedString = 
					  Base64.getEncoder().withoutPadding().encodeToString(domain.getPhoto());
			
			this.displayPhoto = "data:image/png;base64," + encodedString;
		}
		
		
		this.photo2 = domain.getPhoto2();
		if(domain.getPhoto2() != null) {
			String encodedString2 = 
					  Base64.getEncoder().withoutPadding().encodeToString(domain.getPhoto2());
			
			this.displayPhoto2 = "data:image/png;base64," + encodedString2;	
		}
		
		
		if(domain.getShoes() != null) {
			this.shoes = new ShoesDto();
			this.shoes.setId(domain.getShoes().getId());
		}
//		if(domain.getImageUrl() != null) {
//			this.imageUrl = new ImageUrlsDto(domain.getImageUrl());
//		}
	}
	
	
	
}
