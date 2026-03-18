package com.globits.security.filter;

import java.io.IOException;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.WebUtils;

public class CsrfFilter extends OncePerRequestFilter {

	private final Log log = LogFactory.getLog(getClass());

	// name of the cookie
	public static final String XSRF_TOKEN_COOKIE_NAME = "XSRF-TOKEN";

	// name of the header to be receiving from the client
	public static final String XSRF_TOKEN_HEADER_NAME = "X-XSRF-TOKEN";

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
			throws ServletException, IOException {

		log.debug("Inside csrfFilter ...");

		CsrfToken csrf = (CsrfToken) request.getAttribute(CsrfToken.class.getName());

		if (csrf != null) {

			Cookie cookie = WebUtils.getCookie(request, XSRF_TOKEN_COOKIE_NAME);
			String token = csrf.getToken();

			if (cookie == null || token != null && !token.equals(cookie.getValue())) {

				cookie = new Cookie(XSRF_TOKEN_COOKIE_NAME, token);
				cookie.setPath("/");
				response.addCookie(cookie);

				// CORS requests can't see the cookie if domains are different,
				// even if httpOnly is false. So, let's add it as a header as
				// well.
				response.addHeader(XSRF_TOKEN_HEADER_NAME, token);
			}
		}

		filterChain.doFilter(request, response);

		// Get csrf attribute from request
		// CsrfToken csrf = (CsrfToken)
		// request.getAttribute(CsrfToken.class.getName());
		//
		// System.out.println("csrf object = " + csrf);
		//
		// if (csrf != null) { // if csrf attribute was found
		//
		// String token = csrf.getToken();
		//
		// if (token != null) { // if there is a token
		//
		// // set the cookie
		// Cookie cookie = new Cookie(XSRF_TOKEN_COOKIE_NAME, token);
		// cookie.setPath("/");
		// response.addCookie(cookie);
		//
		// // CORS requests can't see the cookie if domains are different,
		// // even if httpOnly is false. So, let's add it as a header as
		// // well.
		// response.addHeader(XSRF_TOKEN_HEADER_NAME, token);
		//
		// System.out.println("Sending CSRF token to client: " + token);
		// log.debug("Sending CSRF token to client: " + token);
		// }
		// }
		//
		// filterChain.doFilter(request, response);
	}

}
