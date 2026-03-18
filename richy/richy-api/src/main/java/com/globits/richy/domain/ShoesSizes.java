package com.globits.richy.domain;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import com.globits.core.domain.BaseObject;

@Entity
@Table(name = "tbl_shoes_sizes")
@XmlRootElement
public class ShoesSizes extends BaseObject{
	@ManyToOne
	@JoinColumn(name="shoes_id")
	private Shoes shoes;
	
	@ManyToOne
	@JoinColumn(name="all_sizes_id")
	private AllSizes allSize;
	
	@Column(name="quantity")
	private Integer quantity;

	public Shoes getShoes() {
		return shoes;
	}

	public void setShoes(Shoes shoes) {
		this.shoes = shoes;
	}

	public AllSizes getAllSize() {
		return allSize;
	}

	public void setAllSize(AllSizes allSize) {
		this.allSize = allSize;
	}

	public Integer getQuantity() {
		return quantity;
	}

	public void setQuantity(Integer quantity) {
		this.quantity = quantity;
	}

}
