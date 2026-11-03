package com.globits.richy.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter;
import org.springframework.security.config.http.SessionCreationPolicy;

@Configuration
@Order(-102)
public class PublicTnttDocumentSecurityConfig extends WebSecurityConfigurerAdapter {
    @Override
    protected void configure(HttpSecurity http) throws Exception {
        http.antMatcher("/public/tntt-documents/**").authorizeRequests()
                .antMatchers(HttpMethod.GET, "/public/tntt-documents/*").permitAll()
                .anyRequest().denyAll();
        http.sessionManagement().sessionCreationPolicy(SessionCreationPolicy.STATELESS);
        http.requestCache().disable();
        http.formLogin().disable();
        http.httpBasic().disable();
        http.logout().disable();
    }
}
