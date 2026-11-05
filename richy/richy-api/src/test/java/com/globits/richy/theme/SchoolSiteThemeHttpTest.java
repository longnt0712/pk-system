package com.globits.richy.theme;

import com.globits.richy.domain.School;
import com.globits.richy.dto.SchoolSiteThemeDto;
import com.globits.richy.rest.RestSchoolSiteThemeController;
import com.globits.richy.service.impl.SchoolSiteThemeService;
import java.util.*;
import org.junit.*;
import org.springframework.security.access.annotation.Secured;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

public class SchoolSiteThemeHttpTest {
    @Test public void publicResolutionIsUncachedAndBulkPayloadBindsSchoolIds() throws Exception {
        SchoolSiteThemeService service=mock(SchoolSiteThemeService.class);
        RestSchoolSiteThemeController controller=new RestSchoolSiteThemeController();
        ReflectionTestUtils.setField(controller,"service",service);
        School school=new School();school.setId(2L);school.setName("School two");school.setDomain("school.example");
        SchoolSiteThemeDto choice=new SchoolSiteThemeDto(school,"CHRISTMAS");
        when(service.forDomain("school.example")).thenReturn(choice);
        when(service.save("CHRISTMAS",Arrays.asList(1L,2L))).thenReturn(Arrays.asList(choice));
        MockMvc mvc=MockMvcBuilders.standaloneSetup(controller).build();
        String publicJson=mvc.perform(get("/public/site-theme").param("domain","school.example"))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store, no-cache, must-revalidate"))
                .andReturn().getResponse().getContentAsString();
        com.fasterxml.jackson.databind.ObjectMapper json=new com.fasterxml.jackson.databind.ObjectMapper();
        assertEquals(2,json.readTree(publicJson).path("schoolId").asInt());
        assertEquals("CHRISTMAS",json.readTree(publicJson).path("theme").asText());
        assertTrue(json.readTree(publicJson).path("configured").asBoolean());
        String savedJson=mvc.perform(put("/api/site-theme/schools").contentType("application/json").content("{\"theme\":\"CHRISTMAS\",\"schoolIds\":[1,2]}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertEquals(2,json.readTree(savedJson).get(0).path("schoolId").asInt());
        verify(service).save("CHRISTMAS",Arrays.asList(1L,2L));
        when(service.save("CHRISTMAS",Collections.<Long>emptyList())).thenThrow(new IllegalArgumentException("Chọn trường"));
        mvc.perform(put("/api/site-theme/schools").contentType("application/json").content("{\"theme\":\"CHRISTMAS\",\"schoolIds\":[]}"))
                .andExpect(status().isBadRequest());
        assertNull(RestSchoolSiteThemeController.class.getMethod("current",String.class).getAnnotation(Secured.class));
        assertArrayEquals(new String[]{"ROLE_ADMIN"},RestSchoolSiteThemeController.class.getMethod("schools").getAnnotation(Secured.class).value());
        assertArrayEquals(new String[]{"ROLE_ADMIN"},RestSchoolSiteThemeController.class.getMethod("save",RestSchoolSiteThemeController.Selection.class).getAnnotation(Secured.class).value());
    }
}
