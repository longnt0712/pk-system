package com.globits.richy.dto;

import java.io.Serializable;
import java.util.Base64;

import javax.persistence.Column;

import com.globits.richy.domain.Folder;
import com.globits.richy.domain.WebContent;

public class WebContentDto implements Serializable{
	private Long id;

	private String header;
	private String text1;
	private String text2;
	private String text3;
	private String text4;
	private String text5;
	private String text6;
	private String text7;
	private String text8;
	private String text9;
	private String text10;
	private byte[] photo;
	private String displayPhoto;
	private String videoUrl;
	
	private String textSearch;
	private Integer contentFor;// 1: image home page; remarkable buildings: ; 3: service; 
	
	public String getVideoUrl() {
		return videoUrl;
	}
	public void setVideoUrl(String videoUrl) {
		this.videoUrl = videoUrl;
	}
	public String getDisplayPhoto() {
		return displayPhoto;
	}
	public void setDisplayPhoto(String displayPhoto) {
		this.displayPhoto = displayPhoto;
	}
	public byte[] getPhoto() {
		return photo;
	}
	public void setPhoto(byte[] photo) {
		this.photo = photo;
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
	public String getHeader() {
		return header;
	}
	public void setHeader(String header) {
		this.header = header;
	}
	public String getText1() {
		return text1;
	}
	public void setText1(String text1) {
		this.text1 = text1;
	}
	public String getText2() {
		return text2;
	}
	public void setText2(String text2) {
		this.text2 = text2;
	}
	public String getText3() {
		return text3;
	}
	public void setText3(String text3) {
		this.text3 = text3;
	}
	public String getText4() {
		return text4;
	}
	public void setText4(String text4) {
		this.text4 = text4;
	}
	public Integer getContentFor() {
		return contentFor;
	}
	public void setContentFor(Integer contentFor) {
		this.contentFor = contentFor;
	}
	public String getText5() {
		return text5;
	}
	public void setText5(String text5) {
		this.text5 = text5;
	}
	public String getText6() {
		return text6;
	}
	public void setText6(String text6) {
		this.text6 = text6;
	}
	public String getText7() {
		return text7;
	}
	public void setText7(String text7) {
		this.text7 = text7;
	}
	public String getText8() {
		return text8;
	}
	public void setText8(String text8) {
		this.text8 = text8;
	}
	public String getText9() {
		return text9;
	}
	public void setText9(String text9) {
		this.text9 = text9;
	}
	public String getText10() {
		return text10;
	}
	public void setText10(String text10) {
		this.text10 = text10;
	}
	public WebContentDto() {
		
	}
	public WebContentDto(WebContent domain) {
		this.id = domain.getId();
		this.header = domain.getHeader();
		this.text1 = domain.getText1();
		this.text2 = domain.getText2();
		this.text3 = domain.getText3();
		this.text4 = domain.getText4();
		this.text5 = domain.getText5();
		this.text6 = domain.getText6();
		this.text7 = domain.getText7();
		this.text8 = domain.getText8();
		this.text9 = domain.getText9();
		this.text10 = domain.getText10();
		this.contentFor = domain.getContentFor();
		this.photo = domain.getPhoto();
		this.videoUrl = domain.getVideoUrl();
		if(domain.getPhoto() != null) {
			
			String encodedString = 
					  Base64.getEncoder().withoutPadding().encodeToString(domain.getPhoto());
			
			this.displayPhoto = "data:image/png;base64," + encodedString;
		}
	}
	
}
