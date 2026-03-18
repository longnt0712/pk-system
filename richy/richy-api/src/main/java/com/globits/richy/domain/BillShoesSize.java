package com.globits.richy.domain;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import com.globits.core.domain.BaseObject;

@Entity
@Table(name = "tbl_bill_shoes_size")
@XmlRootElement
public class BillShoesSize extends BaseObject{
	@ManyToOne
	@JoinColumn(name="shoes_sizes_id")
	private ShoesSizes shoesSize;
	
	@ManyToOne
	@JoinColumn(name="bill_id")
	private Bill bill;
	
	@Column(name="quantity")
	private Integer quantity;

	public ShoesSizes getShoesSize() {
		return shoesSize;
	}

	public void setShoesSize(ShoesSizes shoesSize) {
		this.shoesSize = shoesSize;
	}

	public Bill getBill() {
		return bill;
	}

	public void setBill(Bill bill) {
		this.bill = bill;
	}

	public Integer getQuantity() {
		return quantity;
	}

	public void setQuantity(Integer quantity) {
		this.quantity = quantity;
	}

	
}
