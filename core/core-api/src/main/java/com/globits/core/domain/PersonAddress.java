package com.globits.core.domain;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "tbl_person_address")
@XmlRootElement
public class PersonAddress extends BaseObject {
	private static final long serialVersionUID = -726825325771876837L;
	@Column(name = "address")
	private String address;
	@Column(name = "city", nullable = true)
	private String city;
	@Column(name = "province", nullable = true)
	private String province;
	@Column(name = "country", nullable = true)
	private String country;
	@Column(name = "postal_code", nullable = true)
	private String postalCode;
	@ManyToOne(fetch = FetchType.EAGER)
	@JoinColumn(name = "person_id")
	@JsonIgnore
	private Person person;

	private String latitude;
	private String longitude;
	private Integer type;// loại địa chỉ(1=hộ khẩu thường trú, 2-địa chỉ hiện tại,3-nguyên quán)

	public String getAddress() {
		return address;
	}

	public void setAddress(String address) {
		this.address = address;
	}

	public String getCity() {
		return city;
	}

	public void setCity(String city) {
		this.city = city;
	}

	public String getProvince() {
		return province;
	}

	public void setProvince(String province) {
		this.province = province;
	}

	public String getCountry() {
		return country;
	}

	public void setCountry(String country) {
		this.country = country;
	}

	public String getPostalCode() {
		return postalCode;
	}

	public void setPostalCode(String postalCode) {
		this.postalCode = postalCode;
	}

	public String getLatitude() {
		return latitude;
	}

	public void setLatitude(String latitude) {
		this.latitude = latitude;
	}

	public String getLongitude() {
		return longitude;
	}

	public void setLongitude(String longitude) {
		this.longitude = longitude;
	}

	public Person getPerson() {
		return person;
	}

	public void setPerson(Person person) {
		this.person = person;
	}
	

	public Integer getType() {
		return type;
	}

	public void setType(Integer type) {
		this.type = type;
	}

	public PersonAddress() {

	}

	public PersonAddress(PersonAddress personAddress) {
		super(personAddress);
		this.address = personAddress.getAddress();
		this.city = personAddress.getCity();
		this.country = personAddress.getCountry();
		this.latitude = personAddress.getLatitude();
		this.longitude = personAddress.getLongitude();
		this.postalCode = personAddress.getPostalCode();
		this.province = personAddress.getProvince();
		this.type=personAddress.getType();
		if (personAddress.getPerson() != null)
			this.person = new Person(personAddress.getPerson().getId(), personAddress.getPerson().getLastName(),
					personAddress.getPerson().getFirstName(), personAddress.getPerson().getDisplayName(),
					personAddress.getPerson().getBirthDate(), personAddress.getPerson().getPhoneNumber());
	}

}
