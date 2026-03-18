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
import com.globits.richy.domain.StudentMark;
import com.globits.security.dto.UserDto;

public class StudentMarkDto implements Serializable{
	private Long id;
	private UserDto user;
	private MarkDto mark;
	private Double markNumber;
	private String markText;
	
	private String textSearch;

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
	public UserDto getUser() {
		return user;
	}
	public void setUser(UserDto user) {
		this.user = user;
	}
	public MarkDto getMark() {
		return mark;
	}
	public void setMark(MarkDto mark) {
		this.mark = mark;
	}
	public Double getMarkNumber() {
		return markNumber;
	}
	public void setMarkNumber(Double markNumber) {
		this.markNumber = markNumber;
	}
	public String getMarkText() {
		return markText;
	}
	public void setMarkText(String markText) {
		this.markText = markText;
	}
	public StudentMarkDto() {
		
	}
	public StudentMarkDto(StudentMark domain) {
		this.id = domain.getId();
		if(domain.getUser() != null) {
			this.user = new UserDto(domain.getUser());
		}
		
		if(domain.getMark() != null) {
			this.mark = new MarkDto(domain.getMark());
		}
		
		this.markNumber = domain.getMarkNumber();
		this.markText = domain.getMarkText();
	}
	
}
