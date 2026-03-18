package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

import javax.persistence.Column;
import javax.persistence.Lob;

import com.globits.richy.domain.Brand;
import com.globits.richy.domain.Product;
import com.globits.richy.domain.Shoes;
import com.globits.richy.domain.ShoesImageUrls;
import com.globits.richy.domain.ShoesSizes;


public class ShoesDisplayDto implements Serializable{
	private Long id;
	private String name;
	private String url;
//	private String code;
//	private String textSearch;
	private Integer important;
	private Double firstPrice;
	private Double reduction; //% giảm giá
	private Double secondPrice;
//	private Integer quantity;
	private Integer type; //1: công trình; 2 kiến trúc
	private Integer flagShip; // công trình nổi bật
	private List<ShoesImageUrlsDisplayDto> shoesImageUrls;
//	private List<ShoesSizesDto> shoesSizes;
//	private String videoUrl;
	private String description;
//	private BrandDto brand;
	
	
	

	public String getUrl() {
		return url;
	}
	public Integer getType() {
		return type;
	}
	public void setType(Integer type) {
		this.type = type;
	}
	public Integer getFlagShip() {
		return flagShip;
	}
	public void setFlagShip(Integer flagShip) {
		this.flagShip = flagShip;
	}
	public void setUrl(String url) {
		this.url = url;
	}
//	public BrandDto getBrand() {
//		return brand;
//	}
//	public void setBrand(BrandDto brand) {
//		this.brand = brand;
//	}
	public String getDescription() {
		return description;
	}
	public void setDescription(String description) {
		this.description = description;
	}
	public Double getReduction() {
		return reduction;
	}
	public void setReduction(Double reduction) {
		this.reduction = reduction;
	}

	public List<ShoesImageUrlsDisplayDto> getShoesImageUrls() {
		return shoesImageUrls;
	}
	public void setShoesImageUrls(List<ShoesImageUrlsDisplayDto> shoesImageUrls) {
		this.shoesImageUrls = shoesImageUrls;
	}
	public Long getId() {
		return id;
	}
	public void setId(Long id) {
		this.id = id;
	}
	public String getName() {
		return name;
	}
	public void setName(String name) {
		this.name = name;
	}
	public Integer getImportant() {
		return important;
	}
	public void setImportant(Integer important) {
		this.important = important;
	}
	public Double getFirstPrice() {
		return firstPrice;
	}
	public void setFirstPrice(Double firstPrice) {
		this.firstPrice = firstPrice;
	}
	public Double getSecondPrice() {
		return secondPrice;
	}
	public void setSecondPrice(Double secondPrice) {
		this.secondPrice = secondPrice;
	}

	public ShoesDisplayDto() {
		
	}
	public ShoesDisplayDto(Shoes domain) {
		this.id = domain.getId();
		this.name = domain.getName();
		this.url = domain.getUrl();
		this.important = domain.getImportant();
		this.firstPrice = domain.getFirstPrice();
		this.secondPrice = domain.getSecondPrice();
		this.reduction = domain.getReduction();
		this.description = domain.getDescription();
		this.type = domain.getType();
		this.flagShip = domain.getFlagShip();
		
		if(domain.getShoesImageUrls() != null && domain.getShoesImageUrls().size() > 0) {
			this.shoesImageUrls = new ArrayList<ShoesImageUrlsDisplayDto>();
			List<ShoesImageUrlsDisplayDto> ret = new ArrayList<ShoesImageUrlsDisplayDto>();
			int i = 0;
			for (ShoesImageUrls item : domain.getShoesImageUrls()) {
				ret.add(new ShoesImageUrlsDisplayDto(item));
				i++;
				if(i==2) break;
			}
			Collections.sort(ret, new sortByImageOrdinalNumberDisplay());
			this.shoesImageUrls.addAll(ret);
		}
		
	}
	
	public class sortBySizeVn implements Comparator<ShoesSizesDto> {
		public int compare(ShoesSizesDto a, ShoesSizesDto b)
	    {
			if(a.getAllSize().getSizeVn() != null && b.getAllSize().getSizeVn() != null) {
				return Integer.parseInt(a.getAllSize().getSizeVn()) - Integer.parseInt(b.getAllSize().getSizeVn());	
			}
			return 0;
	    }
	}
	
	
	public class sortByImageOrdinalNumber implements Comparator<ShoesImageUrlsDto> {
		public int compare(ShoesImageUrlsDto a, ShoesImageUrlsDto b)
	    {
			if(a.getOrdinalNumber() != null && b.getOrdinalNumber() != null) {
				return a.getOrdinalNumber() - b.getOrdinalNumber();	
			}
			return 0;
	    }
	}
	
	public class sortByImageOrdinalNumberDisplay implements Comparator<ShoesImageUrlsDisplayDto> {
		public int compare(ShoesImageUrlsDisplayDto a, ShoesImageUrlsDisplayDto b)
	    {
			if(a.getOrdinalNumber() != null && b.getOrdinalNumber() != null) {
				return a.getOrdinalNumber() - b.getOrdinalNumber();	
			}
			return 0;
	    }
	}
}
