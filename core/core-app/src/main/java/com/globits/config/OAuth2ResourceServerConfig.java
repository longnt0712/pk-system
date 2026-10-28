package com.globits.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.config.annotation.web.configuration.EnableResourceServer;
import org.springframework.security.oauth2.config.annotation.web.configuration.ResourceServerConfigurerAdapter;
import org.springframework.security.oauth2.config.annotation.web.configurers.ResourceServerSecurityConfigurer;
import org.springframework.security.web.access.channel.ChannelProcessingFilter;

import com.globits.security.filter.CorsFilter;
import com.globits.security.filter.JsonToUrlEncodedAuthenticationFilter;
import com.globits.security.SessionTokenServices;
import com.globits.security.config.TokenSecurityConfig;

@Configuration
@EnableResourceServer
@Import(TokenSecurityConfig.class)
public class OAuth2ResourceServerConfig extends ResourceServerConfigurerAdapter {

	@Autowired
	private SessionTokenServices tokenServices;

	@Autowired
	private JsonToUrlEncodedAuthenticationFilter jsonFilter;

	@Autowired
	private CorsFilter corsFilter;

	@Override
	public void configure(final HttpSecurity http) throws Exception {
		// Filters

		http.addFilterBefore(jsonFilter, ChannelProcessingFilter.class)

				.addFilterBefore(corsFilter, ChannelProcessingFilter.class)

				.sessionManagement()

				.sessionCreationPolicy(SessionCreationPolicy.STATELESS)

				.and().httpBasic().disable()

				.anonymous()

				.and().authorizeRequests()

				.antMatchers(HttpMethod.POST, "/oauth/revoke").permitAll()

				.antMatchers("/tokens/**").denyAll()

				// .antMatchers("/public").permitAll()

				// .antMatchers("/oauth/**").permitAll()

				.antMatchers("/api/**").authenticated()

				.anyRequest().authenticated()

				.and().csrf().disable();

	}

	@Override
	public void configure(final ResourceServerSecurityConfigurer config) {
		config.tokenServices(tokenServices).stateless(true);
	}
}
