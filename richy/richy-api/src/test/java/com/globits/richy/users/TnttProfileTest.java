package com.globits.richy.users;

import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.util.Collections;
import javax.persistence.Entity;
import javax.persistence.EntityManager;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.globits.core.domain.Person;
import com.globits.core.dto.PersonDto;
import com.globits.core.repository.PersonRepository;
import com.globits.core.utils.TnttProfileSupport;
import com.globits.security.domain.User;
import com.globits.security.dto.UserDto;
import com.globits.security.repository.UserRepository;
import com.globits.security.rest.RestUserController;
import com.globits.security.service.impl.UserServiceImpl;
import org.junit.After;
import org.junit.Test;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.junit.Assert.*;

public class TnttProfileTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private User storedUser;
    private int saves;

    @After public void clearAuthentication() { SecurityContextHolder.clearContext(); }

    private PersonDto profile(String type, String branch, Integer level) {
        PersonDto dto = new PersonDto();
        dto.setTnttMemberType(type); dto.setTnttBranch(branch); dto.setTnttLevel(level);
        return dto;
    }

    private void expectInvalid(PersonDto dto) {
        try { dto.toEntity(); fail("Invalid TNTT profile was accepted"); }
        catch (TnttProfileSupport.InvalidProfileException expected) { assertNotNull(expected.getMessage()); }
    }

    @Test public void allFiveStudentBranchesSupportThreeRanksAndJsonRoundTrips() throws Exception {
        for (String branch : new String[]{"CHIEN_CON", "AU_NHI", "THIEU_NHI", "NGHIA_SI", "HIEP_SI"}) {
            for (int rank = 1; rank <= 3; rank++) {
                Person person = profile("DOAN_SINH", branch, rank).toEntity();
                PersonDto response = mapper.readValue(mapper.writeValueAsString(new PersonDto(person)), PersonDto.class);
                assertEquals("DOAN_SINH", response.getTnttMemberType());
                assertEquals(branch, response.toEntity().getTnttBranch());
                assertEquals(Integer.valueOf(rank), response.toEntity().getTnttLevel());
            }
        }
    }

    @Test public void leaderRanksAndOtherMemberTypesHaveDifferentRules() {
        for (int rank = 1; rank <= 4; rank++)
            assertEquals(Integer.valueOf(rank), profile("HUYNH_TRUONG", null, rank).toEntity().getTnttLevel());
        for (String type : new String[]{"DU_TRUONG", "TRO_TA", "TRO_UY", "TUYEN_UY"}) {
            assertEquals(type, profile(type, null, null).toEntity().getTnttMemberType());
            expectInvalid(profile(type, null, 1));
        }
        expectInvalid(profile("DOAN_SINH", "AU_NHI", 4));
        expectInvalid(profile("DOAN_SINH", null, 2));
        expectInvalid(profile("HUYNH_TRUONG", "AU_NHI", 2));
        expectInvalid(profile("HUYNH_TRUONG", null, 0));
        expectInvalid(profile("HUYNH_TRUONG", null, 5));
        expectInvalid(profile("UNKNOWN", null, null));
        expectInvalid(profile("DOAN_SINH", "UNKNOWN", null));
        expectInvalid(profile(null, "AU_NHI", null));
    }

    @Test public void unclassifiedProfilesRemainValidAndCodesAreNormalized() {
        assertNull(new PersonDto().toEntity().getTnttLevel());
        Person person = profile(" doan_sinh ", " au_nhi ", 1).toEntity();
        assertEquals("DOAN_SINH", person.getTnttMemberType());
        assertEquals("AU_NHI", person.getTnttBranch());
    }

    @Test public void omittedFieldsPreserveExistingRanksButExplicitNullClearsThem() throws Exception {
        Person person = profile("DOAN_SINH", "AU_NHI", 3).toEntity();
        PersonDto legacy = mapper.readValue("{\"firstName\":\"An\"}", PersonDto.class);
        TnttProfileSupport.apply(legacy, person);
        assertEquals(Integer.valueOf(3), person.getTnttLevel());
        PersonDto clearLevel = mapper.readValue("{\"tnttLevel\":null}", PersonDto.class);
        TnttProfileSupport.apply(clearLevel, person);
        assertNull(person.getTnttLevel());
        assertEquals("AU_NHI", person.getTnttBranch());
        TnttProfileSupport.apply(mapper.readValue("{\"tnttMemberType\":null}", PersonDto.class), person);
        assertNull(person.getTnttMemberType()); assertNull(person.getTnttBranch());
        String json = mapper.writeValueAsString(new PersonDto(person));
        assertFalse(json.contains("Specified"));
    }

    @Test public void changingBranchOrMemberTypeDoesNotCarryAnOldRank() throws Exception {
        Person person = profile("DOAN_SINH", "AU_NHI", 3).toEntity();
        TnttProfileSupport.apply(mapper.readValue("{\"tnttBranch\":\"THIEU_NHI\"}", PersonDto.class), person);
        assertEquals("THIEU_NHI", person.getTnttBranch()); assertNull(person.getTnttLevel());
        person.setTnttLevel(2);
        TnttProfileSupport.apply(mapper.readValue("{\"tnttMemberType\":\"HUYNH_TRUONG\"}", PersonDto.class), person);
        assertNull(person.getTnttBranch()); assertNull(person.getTnttLevel());
    }

    private UserServiceImpl service(User initial) throws Exception {
        storedUser = initial;
        UserServiceImpl service = new UserServiceImpl();
        UserRepository users = (UserRepository) Proxy.newProxyInstance(UserRepository.class.getClassLoader(),
                new Class<?>[]{UserRepository.class}, (proxy, method, args) -> {
                    if ("findById".equals(method.getName())) return storedUser;
                    if ("save".equals(method.getName())) {
                        storedUser = (User) args[0]; saves++;
                        if (storedUser.getId() == null) storedUser.setId(7L);
                        if (storedUser.getPerson().getId() == null) storedUser.getPerson().setId(9L);
                        return storedUser;
                    }
                    throw new AssertionError("Unexpected user repository call: " + method.getName());
                });
        PersonRepository persons = (PersonRepository) Proxy.newProxyInstance(PersonRepository.class.getClassLoader(),
                new Class<?>[]{PersonRepository.class}, (proxy, method, args) -> {
                    if ("findOne".equals(method.getName())) return storedUser.getPerson();
                    throw new AssertionError("Unexpected person repository call: " + method.getName());
                });
        setField(service, "userRepository", users); setField(service, "personRepos", persons);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("admin", "unused",
                Collections.singletonList(new SimpleGrantedAuthority("ROLE_ADMIN"))));
        return service;
    }

    private void setField(Object target, String name, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(name); field.setAccessible(true); field.set(target, value);
    }

    private UserDto request() {
        UserDto request = new UserDto();
        request.setUsername("student"); request.setEmail("student@example.test"); request.setActive(true);
        request.setPerson(profile("DOAN_SINH", "AU_NHI", 2));
        return request;
    }

    @Test public void allThreeSavePathsPersistAndReturnTheNewFields() throws Exception {
        UserServiceImpl service = service(null);
        UserDto response = service.save(request());
        assertEquals("AU_NHI", response.getPerson().getTnttBranch());
        response.getPerson().setTnttLevel(3);
        response = service.saveBasicInfo(response);
        assertEquals(Integer.valueOf(3), storedUser.getPerson().getTnttLevel());
        response.getPerson().setTnttMemberType("HUYNH_TRUONG");
        response.getPerson().setTnttBranch(null); response.getPerson().setTnttLevel(4);
        User entity = service.saveUser(response);
        assertEquals(Integer.valueOf(4), new UserDto(entity).getPerson().getTnttLevel());
        assertEquals(3, saves);
    }

    @Test public void legacyUpdatesAndClassTransfersPreserveTnttClassification() throws Exception {
        UserServiceImpl service = service(null);
        service.save(request());
        UserDto legacy = mapper.readValue("{\"id\":7,\"username\":\"student\",\"email\":\"student@example.test\","
                + "\"active\":true,\"person\":{\"id\":9,\"firstName\":\"An\",\"enrollmentClassId\":123}}", UserDto.class);
        service.saveBasicInfo(legacy);
        assertEquals("AU_NHI", storedUser.getPerson().getTnttBranch());
        assertEquals(Integer.valueOf(2), storedUser.getPerson().getTnttLevel());
        assertEquals(Integer.valueOf(123), storedUser.getPerson().getEnrollmentClassId());
    }

    @Test public void invalidInputDoesNotReachStorageAndReportsBadRequest() throws Exception {
        UserServiceImpl service = service(null);
        UserDto request = request(); request.getPerson().setTnttLevel(4);
        try { service.save(request); fail("Invalid student rank was saved"); }
        catch (TnttProfileSupport.InvalidProfileException error) {
            assertEquals(HttpStatus.BAD_REQUEST, new RestUserController().invalidTnttProfile(error).getStatusCode());
        }
        assertEquals(0, saves);
    }

    @Test public void tnttColumnsPersistThroughRealHibernateMappings() throws Exception {
        Configuration configuration = new Configuration()
                .setProperty("hibernate.connection.driver_class", "org.h2.Driver")
                .setProperty("hibernate.connection.url", "jdbc:h2:mem:tntt_profiles;MODE=MSSQLServer")
                .setProperty("hibernate.dialect", "org.hibernate.dialect.H2Dialect")
                .setProperty("hibernate.hbm2ddl.auto", "create-drop")
                .setProperty("hibernate.show_sql", "false");
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));
        for (String entityPackage : new String[]{"com.globits.core.domain", "com.globits.security.domain"})
            for (org.springframework.beans.factory.config.BeanDefinition definition : scanner.findCandidateComponents(entityPackage))
                configuration.addAnnotatedClass(Class.forName(definition.getBeanClassName()));
        try (SessionFactory factory = configuration.buildSessionFactory()) {
            EntityManager manager = factory.createEntityManager();
            try {
                manager.getTransaction().begin();
                Person student = profile("DOAN_SINH", "NGHIA_SI", 3).toEntity();
                Person leader = profile("HUYNH_TRUONG", null, 4).toEntity();
                manager.persist(student); manager.persist(leader); manager.flush(); manager.clear();
                PersonDto loadedStudent = new PersonDto(manager.find(Person.class, student.getId()));
                assertEquals("NGHIA_SI", loadedStudent.getTnttBranch());
                assertEquals(Integer.valueOf(3), loadedStudent.getTnttLevel());
                PersonDto loadedLeader = new PersonDto(manager.find(Person.class, leader.getId()));
                assertEquals("HUYNH_TRUONG", loadedLeader.getTnttMemberType());
                assertEquals(Integer.valueOf(4), loadedLeader.getTnttLevel());
                manager.getTransaction().rollback();
            } finally {
                if (manager.getTransaction().isActive()) manager.getTransaction().rollback();
                manager.close();
            }
        }
    }
}
