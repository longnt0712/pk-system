package com.globits.richy.config;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter;
import org.springframework.security.config.http.SessionCreationPolicy;

/** Only these anonymous capability endpoints bypass login. Every operation validates the secret header. */
@Configuration
@Order(-101)
public class PublicSpeakingSecurityConfig extends WebSecurityConfigurerAdapter {
    @Override protected void configure(HttpSecurity http)throws Exception {
        http.antMatcher("/public/speaking/**").authorizeRequests()
            .antMatchers(HttpMethod.GET,"/public/speaking","/public/speaking/answer","/public/speaking/notebook").permitAll()
            .antMatchers(HttpMethod.PUT,"/public/speaking/answer","/public/speaking/notebook").permitAll().anyRequest().denyAll();
        // No cookie/session authority: unguessable header capability and JSON PUT are mandatory for writes.
        http.csrf().disable();http.sessionManagement().sessionCreationPolicy(SessionCreationPolicy.STATELESS);
        http.requestCache().disable();http.formLogin().disable();http.httpBasic().disable();http.logout().disable();
    }
}
