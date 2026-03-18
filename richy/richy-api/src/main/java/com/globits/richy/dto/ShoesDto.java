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


public class ShoesDto implements Serializable{
	private Long id;
	private String name;
	private String url;
	private String code;
	private String textSearch;
	private Integer important;
	private Double firstPrice;
	private Double reduction; //% giảm giá
	private Double secondPrice;
	private Integer quantity;
	private Integer type; //1: công trình; 2 kiến trúc
	private Integer flagShip; // công trình nổi bật
	private List<ShoesImageUrlsDto> shoesImageUrls;
	private List<ShoesSizesDto> shoesSizes;
	private String videoUrl;
	private String description;
	private BrandDto brand;
	private Integer website;//1: church; 1: richy; 2: shop crocs; 5: clothes

	public Integer getFlagShip() {
		return flagShip;
	}
	public void setFlagShip(Integer flagShip) {
		this.flagShip = flagShip;
	}
	public Integer getWebsite() {
		return website;
	}
	public void setWebsite(Integer website) {
		this.website = website;
	}
	public String getUrl() {
		return url;
	}
	public void setUrl(String url) {
		this.url = url;
	}
	public BrandDto getBrand() {
		return brand;
	}
	public void setBrand(BrandDto brand) {
		this.brand = brand;
	}
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
	public List<ShoesImageUrlsDto> getShoesImageUrls() {
		return shoesImageUrls;
	}
	public void setShoesImageUrls(List<ShoesImageUrlsDto> shoesImageUrls) {
		this.shoesImageUrls = shoesImageUrls;
	}
	public List<ShoesSizesDto> getShoesSizes() {
		return shoesSizes;
	}
	public void setShoesSizes(List<ShoesSizesDto> shoesSizes) {
		this.shoesSizes = shoesSizes;
	}
	public String getVideoUrl() {
		return videoUrl;
	}
	public void setVideoUrl(String videoUrl) {
		this.videoUrl = videoUrl;
	}
	public String getTextSearch() {
		return textSearch;
	}
	public void setTextSearch(String textSearch) {
		this.textSearch = textSearch;
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
	public String getCode() {
		return code;
	}
	public void setCode(String code) {
		this.code = code;
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
	public Integer getQuantity() {
		return quantity;
	}
	public void setQuantity(Integer quantity) {
		this.quantity = quantity;
	}
	public Integer getType() {
		return type;
	}
	public void setType(Integer type) {
		this.type = type;
	}
	public ShoesDto() {
		
	}
	public ShoesDto(Shoes domain) {
		this.id = domain.getId();
		this.flagShip = domain.getFlagShip();
		this.name = domain.getName();
		this.code = domain.getCode();
		this.url = domain.getUrl();
		this.important = domain.getImportant();
		this.firstPrice = domain.getFirstPrice();
		this.secondPrice = domain.getSecondPrice();
		this.quantity = domain.getQuantity();
		this.type = domain.getType();
		this.videoUrl = domain.getVideoUrl();
		this.reduction = domain.getReduction();
		this.description = domain.getDescription();
		this.website = domain.getWebsite();
		
		if(domain.getBrand() != null) {
			this.brand = new BrandDto(domain.getBrand());
		}
		
		if(domain.getShoesImageUrls() != null && domain.getShoesImageUrls().size() > 0) {
			this.shoesImageUrls = new ArrayList<ShoesImageUrlsDto>();
			List<ShoesImageUrlsDto> ret = new ArrayList<ShoesImageUrlsDto>();
			for (ShoesImageUrls item : domain.getShoesImageUrls()) {
				ret.add(new ShoesImageUrlsDto(item));
			}
			Collections.sort(ret, new sortByImageOrdinalNumber());
			this.shoesImageUrls.addAll(ret);
		}
		
		if(domain.getShoesSizes() != null && domain.getShoesSizes().size() > 0) {
			this.shoesSizes = new ArrayList<ShoesSizesDto>();
			List<ShoesSizesDto> ret = new ArrayList<ShoesSizesDto>();
			for (ShoesSizes item : domain.getShoesSizes()) {
				ret.add(new ShoesSizesDto(item));
			}
			
			Collections.sort(ret, new sortBySizeImportant());
			this.shoesSizes.addAll(ret);
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
	
	public class sortBySizeImportant implements Comparator<ShoesSizesDto> {
		public int compare(ShoesSizesDto a, ShoesSizesDto b)
	    {
			if(a.getAllSize().getImportant() != null && b.getAllSize().getImportant() != null) {
				return a.getAllSize().getImportant() - b.getAllSize().getImportant();	
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
}
