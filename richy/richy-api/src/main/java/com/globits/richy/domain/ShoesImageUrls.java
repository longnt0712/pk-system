package com.globits.richy.domain;

import javax.persistence.Basic;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.JoinColumn;
import javax.persistence.Lob;
import javax.persistence.ManyToOne;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import com.globits.core.domain.BaseObject;

@Entity
@Table(name = "tbl_shoes_image_urls")
@XmlRootElement
public class ShoesImageUrls extends BaseObject{
	@ManyToOne
	@JoinColumn(name="shoes_id")
	private Shoes shoes;
	
//	@ManyToOne
//	@JoinColumn(name="image_urls_id")
//	private ImageUrls imageUrl;
	
	@Basic(fetch = FetchType.EAGER)	
	//@Column(name = "photo", nullable = true, columnDefinition = "LONGBLOB NULL")
	@Column(name = "photo", nullable = true,length=5242880)//Kích thước tối đa 5M, có thể để kích thước lớn hơn
	private byte[] photo;
	
	@Basic(fetch = FetchType.EAGER)
	//@Column(name = "photo", nullable = true, columnDefinition = "LONGBLOB NULL")
	@Column(name = "photo2", nullable = true,length=5242880)//Kích thước tối đa 5M, có thể để kích thước lớn hơn
	private byte[] photo2;

	
	@Column(name="ordinal_number")
	private Integer ordinalNumber; //ordinal = 100 => thumnail to display in bills
	
	@Lob
	@Column(name="image_path")
	private String imagePath;

	public String getImagePath() {
		return imagePath;
	}

	public void setImagePath(String imagePath) {
		this.imagePath = imagePath;
	}

	public Shoes getShoes() {
		return shoes;
	}

	public void setShoes(Shoes shoes) {
		this.shoes = shoes;
	}

//	public ImageUrls getImageUrl() {
//		return imageUrl;
//	}
//
//	public void setImageUrl(ImageUrls imageUrl) {
//		this.imageUrl = imageUrl;
//	}

	public Integer getOrdinalNumber() {
		return ordinalNumber;
	}

	public byte[] getPhoto2() {
		return photo2;
	}

	public void setPhoto2(byte[] photo2) {
		this.photo2 = photo2;
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

	
}
