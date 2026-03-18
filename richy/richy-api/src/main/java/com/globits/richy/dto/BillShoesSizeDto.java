package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

import com.globits.richy.domain.Bill;
import com.globits.richy.domain.BillShoesSize;
import com.globits.richy.domain.Brand;
import com.globits.richy.domain.Folder;
import com.globits.richy.domain.ShoesSizes;

public class BillShoesSizeDto implements Serializable{
	private Long id;

	private ShoesSizesDto shoesSize;
	private BillDto bill;
	private Integer quantity;
	
	
	public Long getId() {
		return id;
	}
	public void setId(Long id) {
		this.id = id;
	}
	public ShoesSizesDto getShoesSize() {
		return shoesSize;
	}
	public void setShoesSize(ShoesSizesDto shoesSize) {
		this.shoesSize = shoesSize;
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
	public BillShoesSizeDto() {
		
	}
	public BillShoesSizeDto(BillShoesSize domain) {
		this.id = domain.getId();
		if(domain.getShoesSize() != null) {
			this.shoesSize = new ShoesSizesDto(domain.getShoesSize());
		}
		
		if(domain.getBill() != null) {
			
			this.bill = new BillDto();
			this.bill.setId(domain.getBill().getId());
		}
		
		this.quantity = domain.getQuantity();
	}
	
}
