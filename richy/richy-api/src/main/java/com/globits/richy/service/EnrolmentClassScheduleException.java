package com.globits.richy.service;
import org.springframework.http.HttpStatus;
public class EnrolmentClassScheduleException extends RuntimeException {
    private static final long serialVersionUID = 1L;
    private final HttpStatus status;
    public EnrolmentClassScheduleException(HttpStatus status, String message) { super(message); this.status = status; }
    public HttpStatus getStatus() { return status; }
}
