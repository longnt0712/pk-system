package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

import javax.persistence.Column;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;

import com.globits.richy.domain.Bill;
import com.globits.richy.domain.BillProduct;
import com.globits.richy.domain.BillShoesSize;
import com.globits.richy.domain.Brand;
import com.globits.richy.domain.Folder;
import com.globits.richy.domain.Product;
import com.globits.richy.domain.ShoesSizes;

public class BillProductDto implements Serializable{
	private Long id;
	private ProductDto product;
	private BillDto bill;
	private Integer quantity;
	private Double totalAmount;
	
	public Long getId() {
		return id;
	}
	public void setId(Long id) {
		this.id = id;
	}
	public ProductDto getProduct() {
		return product;
	}
	public void setProduct(ProductDto product) {
		this.product = product;
	}
	public BillDto getBill() {
		return bill;
	}
	public void setBill(BillDto bill) {
		this.bill = bill;
	}
	public Integer getQuantity() {
		return quantity;
	}
	public void setQuantity(Integer quantity) {
		this.quantity = quantity;
	}
	
	public Double getTotalAmount() {
		return totalAmount;
	}
	public void setTotalAmount(Double totalAmount) {
		this.totalAmount = totalAmount;
	}
	public BillProductDto() {
		
	}
	public BillProductDto(BillProduct domain) {
		this.id = domain.getId();
		if(domain.getProduct() != null) {
			this.product = new ProductDto(domain.getProduct());
		}
		
		if(domain.getBill() != null) {
			
			this.bill = new BillDto();
			this.bill.setId(domain.getBill().getId());
		}
		
		this.quantity = domain.getQuantity();
		this.totalAmount = domain.getTotalAmount();
	}
	
	public BillProductDto(Product product, Long quantity, Double totalAmount) {
		if(product!= null) {
			this.product = new ProductDto(product);
		}
		
//		if(domain.getBill() != null) {
//			
//			this.bill = new BillDto();
//			this.bill.setId(domain.getBill().getId());
//		}
		
		this.quantity = quantity.intValue();;
		this.totalAmount = totalAmount;
	}
	
}
