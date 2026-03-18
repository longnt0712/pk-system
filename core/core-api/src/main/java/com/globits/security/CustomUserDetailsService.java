package com.globits.security;

import java.util.Collection;
import java.util.Date;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import com.globits.core.utils.CommonUtils;
import com.globits.security.domain.User;
import com.globits.security.dto.UserDto;
import com.globits.security.service.UserService;

@Service("userService")
public class CustomUserDetailsService implements UserDetailsService, InitializingBean {

	@Autowired
	private UserService userService;

	@Override
	public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {

		UserDto userDto = null;
		try {
			userDto = userService.findByUsername(username);
		} catch (Exception ex) {
			ex.printStackTrace();
		}

		if (CommonUtils.isNull(userDto) || !CommonUtils.isPositive(userDto.getId(), true)) {
			throw new UsernameNotFoundException("User with username (" + username + ") not found.");
		}

		User user = userDto.toEntity();
		Collection<? extends GrantedAuthority> cols = user.getAuthorities();

		for (GrantedAuthority col : cols) {
			user.getAuthorities().add(col);
		}
		//userService.updateUserLastLogin(userDto.getId());
		return user;
	}

	@Override
	public void afterPropertiesSet() throws Exception {
		if (CommonUtils.isNull(userService)) {
			System.out.println("User Service not initialized!");
		}
	}

}
