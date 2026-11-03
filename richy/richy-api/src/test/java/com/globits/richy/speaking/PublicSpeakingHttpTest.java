package com.globits.richy.speaking;

import com.globits.richy.config.PublicSpeakingSecurityConfig;
import com.globits.richy.rest.RestPublicSpeakingController;
import com.globits.richy.service.impl.SpeakingAnswerShareService;
import java.util.Collections;
import javax.servlet.Filter;
import org.junit.*;
import org.springframework.context.annotation.*;
import org.springframework.beans.factory.FactoryBean;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockServletContext;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

public class PublicSpeakingHttpTest {
    @Configuration @EnableWebMvc @EnableWebSecurity
    @Import({PublicSpeakingSecurityConfig.class, PrivateSecurity.class})
    public static class WebConfig {
        @Bean public FactoryBean<SpeakingAnswerShareService> shares(){return new FactoryBean<SpeakingAnswerShareService>(){
            private final SpeakingAnswerShareService value=mock(SpeakingAnswerShareService.class);
            public SpeakingAnswerShareService getObject(){return value;}
            public Class<?> getObjectType(){return SpeakingAnswerShareService.class;}
            public boolean isSingleton(){return true;}
        };}
        @Bean public RestPublicSpeakingController controller(){return new RestPublicSpeakingController();}
        @Bean public PrivateController privateController(){return new PrivateController();}
    }
    @Configuration @Order(10) public static class PrivateSecurity extends WebSecurityConfigurerAdapter {
        @Override protected void configure(HttpSecurity http)throws Exception {http.authorizeRequests().anyRequest().authenticated();}
    }
    @RestController public static class PrivateController {
        @RequestMapping("/api/speaking/sets") public String sets(){return "private";}
    }
    private AnnotationConfigWebApplicationContext context;private MockMvc mvc;private SpeakingAnswerShareService shares;
    @Before public void setup(){
        context=new AnnotationConfigWebApplicationContext();context.setServletContext(new MockServletContext());context.register(WebConfig.class);context.refresh();
        shares=context.getBean(SpeakingAnswerShareService.class);
        mvc=MockMvcBuilders.webAppContextSetup(context).addFilters(context.getBean("springSecurityFilterChain",Filter.class)).build();
    }
    @After public void close(){context.close();}
    @Test public void rootAndScopedReadsReachCapabilityValidationWithoutLogin()throws Exception{
        when(shares.bank("secret")).thenReturn(Collections.<String,Object>singletonMap("setId",11));
        org.springframework.mock.web.MockHttpServletResponse response=mvc.perform(get("/public/speaking").servletPath("/public/speaking").header("X-Speaking-Share","secret")).andReturn().getResponse();
        assertEquals(200,response.getStatus());assertTrue(response.getContentAsString().contains("11"));assertTrue(response.getHeader("Cache-Control").contains("no-store"));
        when(shares.answer("secret",42L,null)).thenReturn(Collections.<String,Object>singletonMap("questionId",42));
        assertEquals(200,mvc.perform(get("/public/speaking/answer").servletPath("/public/speaking/answer").param("questionId","42").header("X-Speaking-Share","secret")).andReturn().getResponse().getStatus());
    }
    @Test public void absentCapabilityAndViewOnlyWritesAreDeniedByRealController()throws Exception{
        when(shares.bank(null)).thenThrow(new AccessDeniedException("denied"));
        assertEquals(403,mvc.perform(get("/public/speaking").servletPath("/public/speaking")).andReturn().getResponse().getStatus());
        when(shares.save(eq("view"),any())).thenThrow(new AccessDeniedException("view"));
        assertEquals(403,mvc.perform(put("/public/speaking/answer").servletPath("/public/speaking/answer").header("X-Speaking-Share","view").contentType(MediaType.APPLICATION_JSON).content("{\"questionId\":42}")).andReturn().getResponse().getStatus());
    }
    @Test public void publicChainCannotExposeOtherPathsOrPrivateApi()throws Exception{
        for(String path:new String[]{"/public/speaking/pass","/public/speaking/sets","/api/speaking/sets"}){
            assertEquals(path,403,mvc.perform(get(path).servletPath(path).header("X-Speaking-Share","secret")).andReturn().getResponse().getStatus());
        }
        assertEquals(403,mvc.perform(post("/public/speaking/answer").servletPath("/public/speaking/answer")).andReturn().getResponse().getStatus());
        verifyZeroInteractions(shares);
    }
}
