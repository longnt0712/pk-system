package com.globits.richy.config;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter;
import org.springframework.security.config.http.SessionCreationPolicy;

/** Exact public read path only; existing login and /api write rules stay untouched. */
@Configuration
@Order(-100)
public class PublicStudentMarkSecurityConfig extends WebSecurityConfigurerAdapter {
    @Override
    protected void configure(HttpSecurity http)throws Exception {
        http.antMatcher("/public/student-marks/**").authorizeRequests()
                .antMatchers(HttpMethod.GET,"/public/student-marks/*").permitAll().anyRequest().denyAll();
        http.sessionManagement().sessionCreationPolicy(SessionCreationPolicy.STATELESS);
        http.requestCache().disable();http.formLogin().disable();http.httpBasic().disable();http.logout().disable();
        // CSRF remains enabled. There is no public write controller.
    }
}
