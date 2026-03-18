package com.globits.richy.domain;

import java.util.Set;

import javax.persistence.CascadeType;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.JoinColumn;
import javax.persistence.Lob;
import javax.persistence.ManyToOne;
import javax.persistence.OneToMany;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import com.globits.core.domain.BaseObject;

@Entity
@Table(name = "tbl_shoes")
@XmlRootElement
public class Shoes extends BaseObject{
	@Lob
	@Column(name="name")
	private String name;
	
	@Lob
	@Column(name="code")
	private String code;
	
	@Lob
	@Column(name="url")
	private String url;

	@Lob
	@Column(name="description")
	private String description;
	
	@Lob
	@Column(name="video_url")
	private String videoUrl;
	
	@Column(name="important")
	private Integer important;
	
	@Column(name="first_price")
	private Double firstPrice;
	
	@Column(name="reduction")
	private Double reduction; //% giảm giá
	
	@Column(name="seconPrice")
	private Double secondPrice;
	
	@Column(name="quantity")
	private Integer quantity;
	
	@Column(name="type")
	private Integer type; //1: KIẾN TRÚC; 2: NỘI THẤT; 3: HỖN HỢP CẢ 2; 4: KINH DOANH DỊCH VỤ
	
	@Column(name="flag_ship")
	private Integer flagShip; // 1: Nổi bật
	
	@OneToMany(mappedBy = "shoes", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval=true)
	private Set<ShoesSizes> shoesSizes;
	
	@OneToMany(mappedBy = "shoes", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval=true)
	private Set<ShoesImageUrls> shoesImageUrls;
	
	@ManyToOne
	@JoinColumn(name="brand_id")
	private Brand brand;
	
	@Column(name="website")
	private Integer website;//1: church; 1: richy; 2: shop crocs; 5: clothes;6: oad
	
	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getCode() {
		return code;
	}

	public Integer getFlagShip() {
		return flagShip;
	}

	public void setFlagShip(Integer flagShip) {
		this.flagShip = flagShip;
	}

	public void setCode(String code) {
		this.code = code;
	}

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
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

	public Integer getWebsite() {
		return website;
	}

	public void setWebsite(Integer website) {
		this.website = website;
	}

	public void setType(Integer type) {
		this.type = type;
	}

	public String getVideoUrl() {
		return videoUrl;
	}

	public void setVideoUrl(String videoUrl) {
		this.videoUrl = videoUrl;
	}


	public Double getReduction() {
		return reduction;
	}

	public void setReduction(Double reduction) {
		this.reduction = reduction;
	}

	public Set<ShoesSizes> getShoesSizes() {
		return shoesSizes;
	}

	public void setShoesSizes(Set<ShoesSizes> shoesSizes) {
		this.shoesSizes = shoesSizes;
	}

	public Set<ShoesImageUrls> getShoesImageUrls() {
		return shoesImageUrls;
	}

	public void setShoesImageUrls(Set<ShoesImageUrls> shoesImageUrls) {
		this.shoesImageUrls = shoesImageUrls;
	}

	public Brand getBrand() {
		return brand;
	}

	public void setBrand(Brand brand) {
		this.brand = brand;
	}

	public String getUrl() {
		return url;
	}

	public void setUrl(String url) {
		this.url = url;
	}
	
}
