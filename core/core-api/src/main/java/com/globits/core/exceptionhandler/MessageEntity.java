package com.globits.core.exceptionhandler;

import java.io.Serializable;

import org.springframework.http.HttpHeaders;

public class MessageEntity implements Serializable {

	private static final long serialVersionUID = 5498689480625016163L;

	// Fields that has issue
	private String field;

	// Error code
	private int code;

	// Message about the issue
	private String message;

	// Type of message, either SUCCESS, INFO, WARNING or ERROR
	private MessageType type;

	// Http header
	private HttpHeaders httpHeaders;

	public MessageEntity(String field, String message, MessageType type) {
		this.field = field;
		this.message = message;
		this.type = type;
		this.httpHeaders = null;
	}

	public MessageEntity(String field, int code, String message, MessageType type) {
		this.field = field;
		this.code = code;
		this.message = message;
		this.type = type;
		this.httpHeaders = null;
	}

	public MessageEntity(String field, String message, HttpHeaders httpHeaders, MessageType type) {
		this.field = field;
		this.message = message;
		this.type = type;
		this.httpHeaders = httpHeaders;
	}

	public String getField() {
		return field;
	}

	public void setField(String field) {
		this.field = field;
	}

	public int getCode() {
		return code;
	}

	public void setCode(int code) {
		this.code = code;
	}

	public String getMessage() {
		return message;
	}

	public void setMessage(String message) {
		this.message = message;
	}

	public MessageType getType() {
		return type;
	}

	public void setType(MessageType type) {
		this.type = type;
	}

	public HttpHeaders getHttpHeaders() {
		return httpHeaders;
	}

	public void setHttpHeaders(HttpHeaders httpHeaders) {
		this.httpHeaders = httpHeaders;
	}

}
