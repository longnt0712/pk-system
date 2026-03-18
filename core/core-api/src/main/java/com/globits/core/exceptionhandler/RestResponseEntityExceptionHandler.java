package com.globits.core.exceptionhandler;

import java.util.Locale;

import javax.persistence.EntityNotFoundException;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.MessageSource;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.InvalidDataAccessApiUsageException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

@ControllerAdvice
public class RestResponseEntityExceptionHandler {

	@Autowired
	private MessageSource msgSource;

	public RestResponseEntityExceptionHandler() {
		super();
	}

	// API

	@ExceptionHandler(AccessDeniedException.class)
	protected ResponseEntity<MessageEntity> processSecurityError(Exception ex, Locale locale) {
		ex.printStackTrace();

		final String bodyOfResponse = msgSource.getMessage("edu.errors.access_denied", null, locale);
		MessageEntity msg = new MessageEntity(null, bodyOfResponse, MessageType.ERROR);

		return new ResponseEntity<MessageEntity>(msg, HttpStatus.FORBIDDEN);
	}

	// 400
	@ExceptionHandler(MethodArgumentNotValidException.class)
	protected ResponseEntity<MessageEntity> processValidationError(MethodArgumentNotValidException ex, Locale locale) {

		BindingResult result = ex.getBindingResult();
		FieldError error = result.getFieldError();

		return new ResponseEntity<MessageEntity>(processFieldError(error, locale), HttpStatus.BAD_REQUEST);
	}

	// 403

	// 404

	@ExceptionHandler(value = { EntityNotFoundException.class })
	protected ResponseEntity<MessageEntity> handleNotFound(final RuntimeException ex, Locale locale) {

		ex.printStackTrace();

		final String bodyOfResponse = msgSource.getMessage("edu.errors.404", null, locale);
		MessageEntity msg = new MessageEntity(null, bodyOfResponse, MessageType.ERROR);

		return new ResponseEntity<MessageEntity>(msg, HttpStatus.NOT_FOUND);
	}

	// 409

	@ExceptionHandler({ InvalidDataAccessApiUsageException.class, DataAccessException.class })
	protected ResponseEntity<MessageEntity> handleConflict(final RuntimeException ex, Locale locale) {

		ex.printStackTrace();

		final String bodyOfResponse = msgSource.getMessage("edu.errors.409", null, locale);
		MessageEntity msg = new MessageEntity(null, bodyOfResponse, MessageType.ERROR);

		return new ResponseEntity<MessageEntity>(msg, HttpStatus.CONFLICT);
	}

	// 412

	// 500

	@ExceptionHandler({ NullPointerException.class, IllegalArgumentException.class, IllegalStateException.class })
	public ResponseEntity<MessageEntity> handleInternal(final RuntimeException ex, Locale locale) {

		ex.printStackTrace();

		final String bodyOfResponse = msgSource.getMessage("edu.errors.500", null, locale);
		MessageEntity msg = new MessageEntity(null, bodyOfResponse, MessageType.ERROR);

		return new ResponseEntity<MessageEntity>(msg, HttpStatus.INTERNAL_SERVER_ERROR);
	}

	/**
	 * Create a response entity in accordance to the error raised
	 * 
	 * @param error
	 * @return
	 */
	private MessageEntity processFieldError(FieldError error, Locale locale) {
		MessageEntity message = null;

		if (error != null) {
			// Locale currentLocale = LocaleContextHolder.getLocale();
			String msg = msgSource.getMessage(error.getDefaultMessage(), null, locale);
			message = new MessageEntity(error.getField(), msg, MessageType.ERROR);
		}

		return message;
	}
}
