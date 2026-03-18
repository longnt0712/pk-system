package com.globits.core.dto;

import com.globits.core.domain.PersonAddress;

public class PersonAddressDto {

	private Long id;

	private String address;

	private String city;

	private String province;

	private String country;

	private String postalCode;

	private String latitude;

	private String longitude;

	private Long personId;
	private Integer type;// loại địa chỉ(1=hộ khẩu thường trú, 2-nguyên quán,3-địa chỉ hiện tại)

	public PersonAddress toEntity() {
		PersonAddress entity = new PersonAddress();

		entity.setId(id);
		entity.setAddress(address);
		entity.setCity(city);
		entity.setProvince(province);
		entity.setCountry(country);
		entity.setPostalCode(postalCode);
		entity.setLatitude(latitude);
		entity.setLongitude(longitude);
		entity.setType(type);

		return entity;
	}

	public PersonAddressDto() {

	}

	public PersonAddressDto(PersonAddress p) {

		if (p == null) {
			return;
		}

		this.id = p.getId();
		this.address = p.getAddress();
		this.city = p.getCity();
		this.country = p.getCountry();
		this.latitude = p.getLatitude();
		this.longitude = p.getLongitude();
		this.postalCode = p.getPostalCode();
		this.province = p.getProvince();
		this.type=p.getType();

		if (p.getPerson() != null) {
			this.personId = p.getPerson().getId();
		}
	}

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

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

	public Long getPersonId() {
		return personId;
	}

	public void setPersonId(Long personId) {
		this.personId = personId;
	}

	public Integer getType() {
		return type;
	}

	public void setType(Integer type) {
		this.type = type;
	}

}
