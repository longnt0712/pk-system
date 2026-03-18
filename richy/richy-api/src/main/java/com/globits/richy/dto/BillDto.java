package com.globits.richy.dto;

import java.io.Serializable;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import org.joda.time.LocalDateTime;

import com.globits.richy.domain.Bill;
import com.globits.richy.domain.BillProduct;
import com.globits.security.dto.UserDto;

public class BillDto implements Serializable{
	private Long id;

	private String code;
	private List<BillProductDto> billProduct;
	private Double totalAmount;
	private String description;
//	private String username;
//	private String displayName;
	private UserDto user;
	private Date createDate;
	private Integer paymentMethod; //1: ck; 2: tm
	private Boolean voided;
	
	private LocalDateTime startDate;
	private LocalDateTime endDate;
	
	private Integer staffHasGivenMoney; //1: chưa: 2 rồi
	private Integer managerHasTakenMoney; //1: chưa; 2 rồi


//	public UserDto getUser() {
//		return user;
//	}
//
//	public void setUser(UserDto user) {
//		this.user = user;
//	}

	public Integer getStaffHasGivenMoney() {
		return staffHasGivenMoney;
	}



	public void setStaffHasGivenMoney(Integer staffHasGivenMoney) {
		this.staffHasGivenMoney = staffHasGivenMoney;
	}



	public Integer getManagerHasTakenMoney() {
		return managerHasTakenMoney;
	}



	public void setManagerHasTakenMoney(Integer managerHasTakenMoney) {
		this.managerHasTakenMoney = managerHasTakenMoney;
	}


	public LocalDateTime getStartDate() {
		return startDate;
	}

	

	public UserDto getUser() {
		return user;
	}



	public void setUser(UserDto user) {
		this.user = user;
	}



	public void setStartDate(LocalDateTime startDate) {
		this.startDate = startDate;
	}

	public LocalDateTime getEndDate() {
		return endDate;
	}

	public void setEndDate(LocalDateTime endDate) {
		this.endDate = endDate;
	}

	private String textSearch;
	
	public String getTextSearch() {
		return textSearch;
	}

	public Integer getPaymentMethod() {
		return paymentMethod;
	}

	public void setPaymentMethod(Integer paymentMethod) {
		this.paymentMethod = paymentMethod;
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

	public String getCode() {
		return code;
	}

	public void setCode(String code) {
		this.code = code;
	}

	public List<BillProductDto> getBillProduct() {
		return billProduct;
	}

	public void setBillProduct(List<BillProductDto> billProduct) {
		this.billProduct = billProduct;
	}

	public Double getTotalAmount() {
		return totalAmount;
	}

	public void setTotalAmount(Double totalAmount) {
		this.totalAmount = totalAmount;
	}

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}


	public Date getCreateDate() {
		return createDate;
	}

	public void setCreateDate(Date createDate) {
		this.createDate = createDate;
	}

	public Boolean getVoided() {
		return voided;
	}

	public void setVoided(Boolean voided) {
		this.voided = voided;
	}

	public BillDto() {
		
	}
	
	public BillDto(Bill domain) {
		this.id = domain.getId();
		this.code = domain.getCode();
		this.description = domain.getDescription();
		this.totalAmount = domain.getTotalAmount();		
		try {
			this.createDate = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss").parse(domain.getCreateDate().toString());
		} catch (ParseException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		
		if(domain.getBillProduct() != null && domain.getBillProduct().size() > 0) {
			this.billProduct = new ArrayList<BillProductDto>();
			List<BillProductDto> ret = new ArrayList<BillProductDto>();
			for (BillProduct item : domain.getBillProduct()) {
				ret.add(new BillProductDto(item));
			}
			this.billProduct.addAll(ret);
		}
		this.voided = domain.getVoided();
		this.paymentMethod = domain.getPaymentMethod();
		if(domain != null && domain.getUser() != null) {
			this.user = new UserDto(domain.getUser());
		}
		this.staffHasGivenMoney = domain.getStaffHasGivenMoney();
		this.managerHasTakenMoney = domain.getManagerHasTakenMoney();
	}
	
}
