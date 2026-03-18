package com.globits.richy.dto;

import java.io.Serializable;

import javax.persistence.Column;
import javax.persistence.JoinColumn;
import javax.persistence.Lob;
import javax.persistence.ManyToOne;

import com.globits.richy.domain.Bill;
import com.globits.richy.domain.Product;


public class ProductDto implements Serializable{
	private Long id;
	private String name;
	private String code;
	private Double firstPrice;
	private Double secondPrice;
	private String imageUrl;
	private String description;
	private Integer important;
	private Integer quantity;
	private Integer firstQuantity;
	//loại: 1: áo, 2: sách, 3: túi, 4: ủng hộ
	private Integer category; 
	
	private String textSearch;
	
	public Integer getFirstQuantity() {
		return firstQuantity;
	}
	public void setFirstQuantity(Integer firstQuantity) {
		this.firstQuantity = firstQuantity;
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
	public String getImageUrl() {
		return imageUrl;
	}
	public void setImageUrl(String imageUrl) {
		this.imageUrl = imageUrl;
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
	public Integer getQuantity() {
		return quantity;
	}
	public void setQuantity(Integer quantity) {
		this.quantity = quantity;
	}
	public Integer getCategory() {
		return category;
	}
	public void setCategory(Integer category) {
		this.category = category;
	}
	public ProductDto() {
		
	}
	public ProductDto(Product domain) {
		this.id = domain.getId();
		this.name = domain.getName();
		this.code = domain.getCode();
		this.description = domain.getDescription();
		this.imageUrl = domain.getImageUrl();
		this.important = domain.getImportant();
		this.firstPrice = domain.getFirstPrice();
		this.secondPrice = domain.getSecondPrice();
		this.quantity = domain.getQuantity();
		this.category = domain.getCategory();
		this.firstQuantity = domain.getQuantity();
	}
	
}
