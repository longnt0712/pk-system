package com.globits.security.config;

import javax.sql.DataSource;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.provider.ClientDetailsService;
import org.springframework.security.oauth2.provider.client.JdbcClientDetailsService;
import org.springframework.security.oauth2.provider.token.TokenStore;
import org.springframework.security.oauth2.provider.token.store.JdbcTokenStore;

import com.globits.security.SessionAuthenticationKeyGenerator;
import com.globits.security.ValidatingTokenServices;

/** One token store/service for issuance, API validation and revocation. */
@Configuration
public class TokenSecurityConfig {
    @Bean
    public TokenStore tokenStore(DataSource dataSource) {
        JdbcTokenStore store = new JdbcTokenStore(dataSource);
        store.setAuthenticationKeyGenerator(new SessionAuthenticationKeyGenerator());
        return store;
    }

    @Bean
    public ClientDetailsService oauthClientDetailsService(DataSource dataSource) {
        return new JdbcClientDetailsService(dataSource);
    }

    @Bean
    @Primary
    public ValidatingTokenServices tokenServices(TokenStore tokenStore,
            @Qualifier("userService") UserDetailsService users,
            @Qualifier("oauthClientDetailsService") ClientDetailsService clients) {
        return new ValidatingTokenServices(tokenStore, users, clients);
    }
}
