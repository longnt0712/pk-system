package com.globits.core.exceptionhandler;

import java.util.Locale;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.web.ErrorController;
import org.springframework.context.MessageSource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SpringBootErrorReplacer implements ErrorController {
	private static final String PATH = "/error";

	@Autowired
	private MessageSource msgSource;

	@RequestMapping(value = PATH)
	public ResponseEntity<MessageEntity> error(HttpServletRequest request, HttpServletResponse response,
			Locale locale) {

		HttpHeaders responseHeaders = new HttpHeaders();
		HttpStatus httpStatus = org.springframework.http.HttpStatus.valueOf(response.getStatus());

		final String bodyOfResponse = msgSource.getMessage("edu.errors.500", null, locale);
		MessageEntity msg = new MessageEntity(null, bodyOfResponse, responseHeaders, MessageType.ERROR);

		return new ResponseEntity<MessageEntity>(msg, httpStatus);
	}

	@Override
	public String getErrorPath() {
		return PATH;
	}
}
