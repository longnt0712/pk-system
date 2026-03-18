package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

import com.globits.richy.domain.BillShoesSize;
import com.globits.richy.domain.ShoesImageUrls;
import com.globits.richy.domain.ShoesSizes;

public class ShoesSizesDto implements Serializable{
	private Long id;

	private ShoesDto shoes;
	private String displayPhoto;
	private AllSizesDto allSize;
	private Integer quantity;
	
	public String getDisplayPhoto() {
		return displayPhoto;
	}
	public void setDisplayPhoto(String displayPhoto) {
		this.displayPhoto = displayPhoto;
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
	
	public AllSizesDto getAllSize() {
		return allSize;
	}
	public void setAllSize(AllSizesDto allSize) {
		this.allSize = allSize;
	}
	public Integer getQuantity() {
		return quantity;
	}
	public void setQuantity(Integer quantity) {
		this.quantity = quantity;
	}
	public ShoesSizesDto() {
		
	}
	public ShoesSizesDto(ShoesSizes domain) {
		this.id = domain.getId();
		this.quantity = domain.getQuantity();
		
		if(domain.getShoes() != null) {
			this.shoes = new ShoesDto();
			this.shoes.setId(domain.getShoes().getId());
			this.shoes.setSecondPrice(domain.getShoes().getSecondPrice());
			this.shoes.setName(domain.getShoes().getName());
//			if(domain.getShoes().getShoesImageUrls() != null && domain.getShoes().getShoesImageUrls().size() > 0) {
//				
//				for (ShoesImageUrls item : domain.getShoes().getShoesImageUrls()) {
//					if(item.getOrdinalNumber() != null && item.getOrdinalNumber() == 100) {
//						String encodedString = 
//								  Base64.getEncoder().withoutPadding().encodeToString(item.getPhoto());
//						
//						this.displayPhoto = "data:image/png;base64," + encodedString;
//					}
//				}
//			}
			
		}
		if(domain.getAllSize() != null) {
			this.allSize = new AllSizesDto(domain.getAllSize());
		}
	}
	
}
