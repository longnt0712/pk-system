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
import com.globits.core.domain.Organization;
import com.globits.security.domain.User;

@Entity
@Table(name = "tbl_bill")
@XmlRootElement
public class Bill extends BaseObject{
	
	@Lob
	@Column(name="code")
	private String code;
	
	@OneToMany(mappedBy = "bill", cascade = CascadeType.ALL, fetch = FetchType.EAGER)
	private Set<BillProduct> billProduct;
	
	//tổng tiền thu về
	@Column(name="totalAmount")
	private Double totalAmount;
	
	@Lob
	@Column(name="description")
	private String description;
	
	//1: chuyển khoản; 2: tiền mặt
	@Column(name="payment_method")
	private Integer paymentMethod; 
	
	//loại nhập: 0: chưa bị vô hiệu hóa => sẽ hiển thị; 1: đã bị vô hiệu quá,
	@Column(name="voided")
	private Boolean voided; 
	
	@ManyToOne
	@JoinColumn(name="user_id")
	private User user;
	
	@Column(name="staff_has_given_money")
	private Integer staffHasGivenMoney; //1: chưa: 2 rồi
	
	@Column(name="manager_has_take_money")
	private Integer managerHasTakenMoney; //1: chưa; 2 rồi

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

	public String getCode() {
		return code;
	}

	public Integer getPaymentMethod() {
		return paymentMethod;
	}

	public void setPaymentMethod(Integer paymentMethod) {
		this.paymentMethod = paymentMethod;
	}

	public void setCode(String code) {
		this.code = code;
	}

	public Set<BillProduct> getBillProduct() {
		return billProduct;
	}

	public void setBillProduct(Set<BillProduct> billProduct) {
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

	public Boolean getVoided() {
		return voided;
	}

	public void setVoided(Boolean voided) {
		this.voided = voided;
	}

	public User getUser() {
		return user;
	}

	public void setUser(User user) {
		this.user = user;
	}
	
	
}
