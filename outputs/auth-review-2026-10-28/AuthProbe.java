import java.util.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.oauth2.common.*;
import org.springframework.security.oauth2.provider.*;
import org.springframework.security.oauth2.provider.token.*;
import org.springframework.security.oauth2.provider.token.store.*;

/** Reproduces token-service behavior with local dependencies and in-memory test data. */
public class AuthProbe {
  static class MutableUser extends User {
    boolean enabled = true;
    MutableUser() { super("probe", "unused", Arrays.asList(new SimpleGrantedAuthority("ROLE_ADMIN"))); }
    public boolean isEnabled() { return enabled; }
  }
  public static void main(String[] args) {
    InMemoryTokenStore store = new InMemoryTokenStore();
    DefaultTokenServices services = new DefaultTokenServices();
    services.setTokenStore(store);
    services.setSupportRefreshToken(true);
    services.setAccessTokenValiditySeconds(86400);
    MutableUser user = new MutableUser();
    UsernamePasswordAuthenticationToken login = new UsernamePasswordAuthenticationToken(user, "unused", user.getAuthorities());
    OAuth2Request req = new OAuth2Request(Collections.<String,String>emptyMap(), "probe_client", null, true, new HashSet<String>(Arrays.asList("read")), null, null, null, null);
    OAuth2Authentication auth = new OAuth2Authentication(req, login);
    OAuth2AccessToken initial = services.createAccessToken(auth);
    user.enabled = false;
    OAuth2AccessToken refreshed = services.refreshAccessToken(initial.getRefreshToken().getValue(), new TokenRequest(Collections.<String,String>emptyMap(), "probe_client", null, "refresh_token"));
    OAuth2Authentication loaded = services.loadAuthentication(refreshed.getValue());
    System.out.println("disabledUserRefreshIssued=" + (refreshed != null));
    System.out.println("loadedPrincipalDisabled=" + !((MutableUser)loaded.getPrincipal()).isEnabled());
    System.out.println("staleAdminAuthority=" + loaded.getAuthorities().contains(new SimpleGrantedAuthority("ROLE_ADMIN")));
    System.out.println("accessLifetimeSeconds=" + Math.round((refreshed.getExpiration().getTime()-System.currentTimeMillis())/1000.0));
    System.out.println("refreshLifetimeDays=" + Math.round((((ExpiringOAuth2RefreshToken)refreshed.getRefreshToken()).getExpiration().getTime()-System.currentTimeMillis())/86400000.0));
    System.out.println("revokeOldAccessAfterRefresh=" + services.revokeToken(initial.getValue()));
    System.out.println("refreshSurvivesOldAccessRevoke=" + (store.readRefreshToken(initial.getRefreshToken().getValue()) != null));
  }
}
