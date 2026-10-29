package com.globits.security;

import static org.apache.commons.lang3.RandomStringUtils.randomAlphabetic;

import java.util.HashMap;
import java.util.Map;

import org.springframework.security.oauth2.common.DefaultOAuth2AccessToken;
import org.springframework.security.oauth2.common.OAuth2AccessToken;
import org.springframework.security.oauth2.common.ExpiringOAuth2RefreshToken;
import org.springframework.security.oauth2.provider.OAuth2Authentication;
import org.springframework.security.oauth2.provider.token.TokenEnhancer;

public class CustomTokenEnhancer implements TokenEnhancer {

	@Override
	public OAuth2AccessToken enhance(OAuth2AccessToken accessToken, OAuth2Authentication authentication) {

		final Map<String, Object> additionalInfo = new HashMap<>();

		additionalInfo.put("organization", authentication.getName() + randomAlphabetic(4));
		if (accessToken.getRefreshToken() != null
				&& !(accessToken.getRefreshToken() instanceof ExpiringOAuth2RefreshToken)) {
			additionalInfo.put("persistent_session", true);
		}
		if (accessToken.getRefreshToken() instanceof ExpiringOAuth2RefreshToken) {
			ExpiringOAuth2RefreshToken refresh = (ExpiringOAuth2RefreshToken) accessToken.getRefreshToken();
			if (refresh.getExpiration() != null) {
				additionalInfo.put("refresh_token_expires_at", refresh.getExpiration().getTime());
				// A refresh near the session deadline must not mint an access
				// token that remains usable after that deadline.
				if (accessToken.getExpiration() == null || accessToken.getExpiration().after(refresh.getExpiration())) {
					((DefaultOAuth2AccessToken) accessToken).setExpiration(refresh.getExpiration());
				}
			}
		}
		((DefaultOAuth2AccessToken) accessToken).setAdditionalInformation(additionalInfo);

		return accessToken;
	}

}
