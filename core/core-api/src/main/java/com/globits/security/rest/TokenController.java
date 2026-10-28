package com.globits.security.rest;

import javax.servlet.http.HttpServletRequest;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.provider.ClientDetails;
import org.springframework.security.oauth2.provider.ClientDetailsService;
import org.springframework.security.oauth2.provider.ClientRegistrationException;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.globits.security.ValidatingTokenServices;
import com.globits.security.SessionTokenServices;

@RestController
public class TokenController {
    @Autowired
    private SessionTokenServices tokenServices;

    @Autowired
    @Qualifier("oauthClientDetailsService")
    private ClientDetailsService clients;

    /** Compatibility for older clients whose access token is still valid. */
    @PreAuthorize("isAuthenticated()")
    @RequestMapping(method = RequestMethod.DELETE, value = "/oauth/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
            tokenServices.revokeToken(authorization.substring(7).trim());
        }
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).build();
    }

    /**
     * Revoke by token possession and matching client. No access bearer is needed:
     * logout must also work after access expiry. Unknown tokens are idempotent.
     */
    @RequestMapping(method = RequestMethod.POST, value = "/oauth/revoke",
            consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public ResponseEntity<Void> revoke(@RequestParam("token") String token,
            @RequestParam("client_id") String clientId, @RequestParam("client_secret") String secret) {
        ClientDetails client;
        try {
            client = clients.loadClientByClientId(clientId);
        } catch (ClientRegistrationException ex) {
            return unauthorized();
        }
        if (!client.isSecretRequired() || !ValidatingTokenServices.sameSecret(secret, client.getClientSecret())) {
            return unauthorized();
        }
        tokenServices.revokeForClient(token, clientId);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).build();
    }

    private ResponseEntity<Void> unauthorized() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).cacheControl(CacheControl.noStore()).build();
    }
}
