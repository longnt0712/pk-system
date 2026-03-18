package com.globits.core.utils;

import java.util.Set;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.globits.security.domain.Role;
import com.globits.security.domain.User;

public class SecurityUtils {

	/**
	 * Check if the current user is authenticated
	 * 
	 * @return
	 */
	public static boolean isAuthenticated() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

		return CommonUtils.isNotNull(authentication) && authentication.isAuthenticated()
				&& !(authentication instanceof AnonymousAuthenticationToken);
	}

	/**
	 * Check if the current user has #role ro
	 * 
	 * @return
	 */
	public static boolean isUserInRole(User user, String role) {

		if (CommonUtils.isNull(user)) {
			return false;
		}

		Set<GrantedAuthority> roles = (Set<GrantedAuthority>) user.getAuthorities();
		for (GrantedAuthority ga : roles) {
			if (!(ga instanceof Role)) {
				continue;
			}

			if (ga.getAuthority().equals(role)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Return the currently authenticated user details
	 * 
	 * @return
	 */
	public static User getCurrentUser() {

		if (!isAuthenticated()) {
			return null;
		}

		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

		return (User) authentication.getPrincipal();
	}

	/**
	 * Force signing in a user
	 * 
	 * @param user
	 */
	public static void setCurrentUser(User user) {

		Authentication authentication = new UsernamePasswordAuthenticationToken(user, user.getPassword(),
				user.getAuthorities());

		SecurityContextHolder.getContext().setAuthentication(authentication);
	}

	/**
	 * Encrypt password with Spring Security's BCryptPasswordEncoder
	 * 
	 * @param password
	 * @return
	 */
	public static String getHashPassword(String password) {
		PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
		return passwordEncoder.encode(password);
	}

	/**
	 * Check if a plain password matches the encrypted password
	 * 
	 * @param encryptedPassword
	 * @param plainPassword
	 * @return
	 */
	public static boolean passwordsMatch(String encryptedPassword, String plainPassword) {
		PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

		return passwordEncoder.matches(plainPassword, encryptedPassword);
	}
}
