package com.globits.security;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.globits.core.utils.CommonUtils;
import com.globits.security.domain.User;
import com.globits.security.dto.UserDto;
import com.globits.security.service.UserService;

@Service("userService")
public class CustomUserDetailsService implements UserDetailsService, InitializingBean {

	@Autowired
	private UserService userService;

	@Override
	@Transactional(readOnly = true, noRollbackFor = UsernameNotFoundException.class)
	public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
		User entity = userService.findEntityByUsername(username);
		if (entity == null || !CommonUtils.isPositive(entity.getId(), true)) {
			throw new UsernameNotFoundException("User with username (" + username + ") not found.");
		}

		// Build a detached principal while the user's roles/profile are available.
		// The public DTO conversion defaults these flags for newly created users;
		// authentication must retain the persisted flags instead.
		User user = new UserDto(entity).toEntity();
		user.setAccountNonExpired(entity.getAccountNonExpired());
		user.setAccountNonLocked(entity.getAccountNonLocked());
		user.setCredentialsNonExpired(entity.getCredentialsNonExpired());
		user.setAuthVersion(entity.getAuthVersion());
		return user;
	}

	@Override
	public void afterPropertiesSet() throws Exception {
		if (CommonUtils.isNull(userService)) {
			System.out.println("User Service not initialized!");
		}
	}

}
