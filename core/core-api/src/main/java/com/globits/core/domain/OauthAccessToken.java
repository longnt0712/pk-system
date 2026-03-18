package com.globits.core.domain;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;
import javax.xml.bind.annotation.XmlRootElement;

import org.hibernate.annotations.GenericGenerator;
@Entity
@Table(name = "oauth_access_token")
@XmlRootElement
public class OauthAccessToken {
	@Column(name="token_id")
	String tokenId;
	@Column(name = "token", nullable = true,length=16777125)
	byte[] token;
	@Id
	@Column(name="authentication_id",unique = true, nullable = false, length=255)
	String authenticationId;
	@Column(name="user_name")
	String userName;
	@Column(name="client_id")
	String clientId;
	@Column(name = "authentication", nullable = true,length=16777125)
	byte[] authentication;
	@Column(name="refresh_token")
	String refreshToken;
	@Column(name="defaultOAuth2AccessToken")
	byte[] defaultOAuth2AccessToken;
	
	public String getTokenId() {
		return tokenId;
	}
	public void setTokenId(String tokenId) {
		this.tokenId = tokenId;
	}
	public byte[] getToken() {
		return token;
	}
	public void setToken(byte[] token) {
		this.token = token;
	}
	public String getAuthenticationId() {
		return authenticationId;
	}
	public void setAuthenticationId(String authenticationId) {
		this.authenticationId = authenticationId;
	}
	public String getUserName() {
		return userName;
	}
	public void setUserName(String userName) {
		this.userName = userName;
	}
	public String getClientId() {
		return clientId;
	}
	public void setClientId(String clientId) {
		this.clientId = clientId;
	}
	public byte[] getAuthentication() {
		return authentication;
	}
	public void setAuthentication(byte[] authentication) {
		this.authentication = authentication;
	}
	public String getRefreshToken() {
		return refreshToken;
	}
	public void setRefreshToken(String refreshToken) {
		this.refreshToken = refreshToken;
	}
	public byte[] getDefaultOAuth2AccessToken() {
		return defaultOAuth2AccessToken;
	}
	public void setDefaultOAuth2AccessToken(byte[] defaultOAuth2AccessToken) {
		this.defaultOAuth2AccessToken = defaultOAuth2AccessToken;
	}
	
	
}
