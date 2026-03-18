package com.globits.richy.dto;

import java.io.Serializable;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Set;

import javax.persistence.Column;

import org.joda.time.LocalDateTime;

import com.globits.richy.domain.Bill;
import com.globits.richy.domain.BillShoesSize;
import com.globits.richy.domain.Brand;
import com.globits.richy.domain.Folder;
import com.globits.richy.domain.Product;
import com.globits.richy.domain.ShoesSizes;
import com.globits.richy.dto.ShoesDto.sortBySizeVn;

public class BillStatisticsDto implements Serializable{
	private Long id;
	private Date createDate;
	
	//new
	private Integer type;
	private Long quantity; //sum
	private ProductDto product;
	private Double firstPrice;
	private Double totalAmountOfBills;
	
	private List<BillProductDto> billProductDtos;
	
	private Double totalAmountOfBillsCredit;
	private Double totalAmountOfBillsCash;
	
	public Double getTotalAmountOfBillsCredit() {
		return totalAmountOfBillsCredit;
	}
	public void setTotalAmountOfBillsCredit(Double totalAmountOfBillsCredit) {
		this.totalAmountOfBillsCredit = totalAmountOfBillsCredit;
	}
	public Double getTotalAmountOfBillsCash() {
		return totalAmountOfBillsCash;
	}
	public void setTotalAmountOfBillsCash(Double totalAmountOfBillsCash) {
		this.totalAmountOfBillsCash = totalAmountOfBillsCash;
	}
	public List<BillProductDto> getBillProductDtos() {
		return billProductDtos;
	}
	public void setBillProductDtos(List<BillProductDto> billProductDtos) {
		this.billProductDtos = billProductDtos;
	}
	public Double getTotalAmountOfBills() {
		return totalAmountOfBills;
	}
	public void setTotalAmountOfBills(Double totalAmountOfBills) {
		this.totalAmountOfBills = totalAmountOfBills;
	}
	public Long getId() {
		return id;
	}
	public void setId(Long id) {
		this.id = id;
	}
	public Date getCreateDate() {
		return createDate;
	}
	public void setCreateDate(Date createDate) {
		this.createDate = createDate;
	}
	public Long getQuantity() {
		return quantity;
	}
	public void setQuantity(Long quantity) {
		this.quantity = quantity;
	}
	public Integer getType() {
		return type;
	}
	public void setType(Integer type) {
		this.type = type;
	}
	
	public ProductDto getProduct() {
		return product;
	}
	public void setProduct(ProductDto product) {
		this.product = product;
	}
	public Double getFirstPrice() {
		return firstPrice;
	}
	public void setFirstPrice(Double firstPrice) {
		this.firstPrice = firstPrice;
	}
	
	public BillStatisticsDto() {
		
	}
	
	public BillStatisticsDto(Bill domain) {
		this.id = domain.getId();
	}
	
}
