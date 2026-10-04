package com.globits.richy.users;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;
import javax.persistence.Entity;
import javax.persistence.EntityManager;

import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.After;
import org.junit.AfterClass;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.data.domain.Page;
import org.springframework.test.util.ReflectionTestUtils;

import com.globits.core.domain.Person;
import com.globits.richy.domain.EnrolmentClass;
import com.globits.security.domain.Role;
import com.globits.security.domain.User;
import com.globits.security.dto.UserDto;
import com.globits.security.dto.UserFilterDto;
import com.globits.security.service.impl.UserServiceImpl;

import static org.junit.Assert.assertEquals;

/** Runs the real search/count HQL against isolated Hibernate entity mappings. */
public class UnassignedStudentSearchTest {
    private static SessionFactory factory;
    private EntityManager manager;
    private UserServiceImpl service;
    private EnrolmentClass ieltsClass;

    @BeforeClass public static void createDatabase() throws Exception {
        Configuration configuration = new Configuration()
                .setProperty("hibernate.connection.driver_class", "org.h2.Driver")
                .setProperty("hibernate.connection.url", "jdbc:h2:mem:unassigned_students;MODE=MSSQLServer")
                .setProperty("hibernate.dialect", "org.hibernate.dialect.H2Dialect")
                .setProperty("hibernate.hbm2ddl.auto", "create-drop")
                .setProperty("hibernate.show_sql", "false");
        ClassPathScanningCandidateComponentProvider scanner =
                new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));
        for (org.springframework.beans.factory.config.BeanDefinition definition
                : scanner.findCandidateComponents("com.globits")) {
            configuration.addAnnotatedClass(Class.forName(definition.getBeanClassName()));
        }
        factory = configuration.buildSessionFactory();
    }

    @AfterClass public static void closeDatabase() {
        if (factory != null) factory.close();
    }

    @Before public void seedStudents() {
        manager = factory.createEntityManager();
        manager.getTransaction().begin();
        service = new UserServiceImpl();
        ReflectionTestUtils.setField(service, "manager", manager);
        Role viewer = role("ROLE_VIEWER");
        Role student = role("ROLE_STUDENT");
        Role admin = role("ROLE_ADMIN");
        ieltsClass = enrollmentClass(1);
        EnrolmentClass tnttClass = enrollmentClass(2);
        user("unassigned", viewer, true, null, null);
        user("legacy-zero", viewer, true, 0, null);
        user("inactive", viewer, false, null, null);
        user("ielts-primary", viewer, true, ieltsClass.getId().intValue(), null);
        user("ielts-extra", viewer, true, null, ieltsClass.getId());
        user("tntt-primary", viewer, true, tnttClass.getId().intValue(), null);
        user("tntt-extra", viewer, true, null, tnttClass.getId());
        user("tntt-student", student, true, null, null);
        user("administrator", admin, true, null, null);
        manager.flush();
        manager.clear();
    }

    @After public void rollbackStudents() {
        if (manager != null) {
            if (manager.getTransaction().isActive()) manager.getTransaction().rollback();
            manager.close();
        }
    }

    private Role role(String name) {
        Role role = new Role(); role.setName(name); manager.persist(role); return role;
    }

    private EnrolmentClass enrollmentClass(int schoolId) {
        EnrolmentClass value = new EnrolmentClass();
        value.setName("Class " + schoolId); value.setSchoolId(schoolId);
        manager.persist(value); return value;
    }

    private void user(String username, Role role, boolean active, Integer primaryId, Long extraId) {
        User user = new User();
        user.setUsername(username); user.setEmail(username + "@example.test");
        user.setPassword("unused"); user.setActive(active); user.getRoles().add(role);
        if (extraId != null) user.getEnrollmentClassIds().add(extraId);
        Person person = new Person();
        person.setFirstName(username); person.setLastName("Student");
        person.setEnrollmentClassId(primaryId); person.setUser(user); user.setPerson(person);
        manager.persist(user);
    }

    private UserFilterDto filter(int schoolId, boolean withoutClass) {
        UserFilterDto filter = new UserFilterDto();
        filter.setSchoolId(schoolId); filter.setActive(true);
        filter.setWithoutEnrollmentClass(withoutClass); return filter;
    }

    private void expect(UserFilterDto filter, String... usernames) {
        Page<UserDto> page = service.findAllPageable(filter, 1, 100);
        Set<String> actual = page.getContent().stream().map(UserDto::getUsername).collect(Collectors.toSet());
        assertEquals(new HashSet<>(Arrays.asList(usernames)), actual);
        assertEquals(usernames.length, page.getTotalElements());
    }

    @Test public void onlyViewerStudentsWithoutAnyPrimaryOrExtraClassAreReturned() {
        expect(filter(1, true), "unassigned", "legacy-zero");
    }

    @Test public void staleClassSelectionsDoNotExcludeUnassignedStudents() {
        UserFilterDto filter = filter(1, true);
        filter.setEnrollmentClass(ieltsClass.getId().intValue());
        filter.setEnrollmentClassIds(new Long[]{ieltsClass.getId()});
        expect(filter, "unassigned", "legacy-zero");
    }

    @Test public void inactiveAndKeywordFiltersStillApply() {
        UserFilterDto filter = filter(1, true); filter.setActive(null);
        expect(filter, "unassigned", "legacy-zero", "inactive");
        filter.setKeyword("INACTIVE"); expect(filter, "inactive");
        filter.setActive(true); expect(filter);
    }

    @Test public void uncheckingPreservesTheRegularIeltsDirectoryScope() {
        expect(filter(1, false), "ielts-primary", "ielts-extra", "administrator");
    }

    @Test public void otherSchoolsIgnoreTheIeltsOnlyFilter() {
        expect(filter(2, true), "tntt-primary", "tntt-extra", "tntt-student", "administrator");
    }

    @Test public void paginationUsesTheFilteredCount() {
        Page<UserDto> first = service.findAllPageable(filter(1, true), 1, 1);
        Page<UserDto> second = service.findAllPageable(filter(1, true), 2, 1);
        assertEquals(2, first.getTotalElements());
        assertEquals(2, second.getTotalElements());
        assertEquals("legacy-zero", first.getContent().get(0).getUsername());
        assertEquals("unassigned", second.getContent().get(0).getUsername());
    }
}
