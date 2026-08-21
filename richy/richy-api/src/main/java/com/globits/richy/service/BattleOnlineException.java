package com.globits.richy.service;

import org.springframework.http.HttpStatus;

public class BattleOnlineException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    private final HttpStatus status;

    public BattleOnlineException(HttpStatus status, String message) {
        super(message);
        this.status = status != null ? status : HttpStatus.BAD_REQUEST;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
