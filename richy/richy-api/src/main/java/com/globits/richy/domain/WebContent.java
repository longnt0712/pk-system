package com.globits.richy.domain;

import javax.persistence.Basic;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.JoinColumn;
import javax.persistence.Lob;
import javax.persistence.ManyToOne;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import com.globits.core.domain.BaseObject;
import com.globits.core.domain.Organization;

@Entity
@Table(name = "tbl_web_content")
@XmlRootElement
public class WebContent extends BaseObject{
	@Lob
	@Column(name="header")
	private String header;
	
	@Lob
	@Column(name="text1")
	private String text1;
	
	@Lob
	@Column(name="text2")
	private String text2;
	
	@Lob
	@Column(name="text3")
	private String text3;
	
	@Lob
	@Column(name="text4")
	private String text4;
	
	@Lob
	@Column(name="text5")
	private String text5;
	
	@Lob
	@Column(name="text6")
	private String text6;
	
	@Lob
	@Column(name="text7")
	private String text7;
	
	@Lob
	@Column(name="text8")
	private String text8;
	
	@Lob
	@Column(name="text9")
	private String text9;
	
	@Lob
	@Column(name="text10")
	private String text10;
	
	@Lob
	@Column(name="video_url")
	private String videoUrl;
	
	@Column(name="content_for")
	private Integer contentFor;// 1: image home page; remarkable buildings: ; 3: service; 
	
	@Basic(fetch = FetchType.EAGER)
	//@Column(name = "photo", nullable = true, columnDefinition = "LONGBLOB NULL")
	@Column(name = "photo", nullable = true,length=10485760)//Kích thước tối đa 10M, có thể để kích thước lớn hơn
	private byte[] photo;

	public String getVideoUrl() {
		return videoUrl;
	}

	public void setVideoUrl(String videoUrl) {
		this.videoUrl = videoUrl;
	}

	public byte[] getPhoto() {
		return photo;
	}

	public void setPhoto(byte[] photo) {
		this.photo = photo;
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

	public Integer getContentFor() {
		return contentFor;
	}

	public void setContentFor(Integer contentFor) {
		this.contentFor = contentFor;
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
	
	
//	@Column(name="type")
//	private Integer type;// 1: thông báo; 2: tin tức; 3 lịch lễ; 4: Lời Chúa
	
//	@Column(name="website")
//	private Integer website;//1: church; 1: richy; 2: shop crocs; 4: furniture

	
	
}
