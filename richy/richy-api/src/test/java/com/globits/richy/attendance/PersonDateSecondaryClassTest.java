package com.globits.richy.attendance;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.TimeZone;
import java.util.stream.Collectors;
import javax.persistence.Entity;
import javax.persistence.EntityManager;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.joda.JodaModule;
import com.globits.core.domain.Person;
import com.globits.core.dto.PersonDto;
import com.globits.richy.domain.EnrolmentClass;
import com.globits.richy.domain.PersonDate;
import com.globits.richy.dto.PersonDateDto;
import com.globits.richy.service.impl.PersonDateServiceImpl;
import com.globits.security.domain.User;
import com.globits.security.domain.UserGroup;
import com.globits.security.dto.UserDto;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.joda.time.LocalDateTime;
import org.joda.time.DateTime;
import org.joda.time.DateTimeZone;
import org.junit.After;
import org.junit.AfterClass;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.data.domain.Page;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.Assert.*;

/** Executes the actual attendance data/count HQL against an isolated in-memory database. */
public class PersonDateSecondaryClassTest {
    private static SessionFactory factory;
    private EntityManager manager;
    private PersonDateServiceImpl service;
    private EnrolmentClass primaryClass, choirClass, otherClass;
    private UserGroup choirGroup, otherGroup;
    private User multi, choirPrimary, secondaryOnly, inactive, nonmember, unassigned;

    @BeforeClass public static void createDatabase() throws Exception {
        Configuration configuration = new Configuration()
                .setProperty("hibernate.connection.driver_class", "org.h2.Driver")
                .setProperty("hibernate.connection.url", "jdbc:h2:mem:person_date_secondary;MODE=MSSQLServer")
                .setProperty("hibernate.dialect", "org.hibernate.dialect.H2Dialect")
                .setProperty("hibernate.hbm2ddl.auto", "create-drop")
                .setProperty("hibernate.show_sql", "false");
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));
        for (org.springframework.beans.factory.config.BeanDefinition definition : scanner.findCandidateComponents("com.globits")) {
            configuration.addAnnotatedClass(Class.forName(definition.getBeanClassName()));
        }
        factory = configuration.buildSessionFactory();
    }

    @AfterClass public static void closeDatabase() { if (factory != null) factory.close(); }

    @Before public void setup() {
        manager = factory.createEntityManager();
        manager.getTransaction().begin();
        service = new PersonDateServiceImpl();
        ReflectionTestUtils.setField(service, "manager", manager);
        primaryClass = enrollmentClass("Primary", 2);
        choirClass = enrollmentClass("Choir", 2);
        otherClass = enrollmentClass("Other", 2);
        choirGroup = group("Choir group");
        otherGroup = group("Other group");
        multi = user("multi", true, primaryClass, choirClass.getId(), otherClass.getId());
        multi.getGroups().add(choirGroup); multi.getGroups().add(otherGroup);
        choirPrimary = user("choir-primary", true, choirClass, choirClass.getId(), otherClass.getId());
        choirPrimary.getGroups().add(choirGroup);
        secondaryOnly = user("secondary-only", true, null, choirClass.getId());
        secondaryOnly.getGroups().add(otherGroup);
        inactive = user("inactive", false, primaryClass, choirClass.getId());
        nonmember = user("nonmember", true, otherClass);
        unassigned = user("unassigned", true, null);
        manager.flush();
    }

    @After public void rollback() {
        if (manager != null) {
            if (manager.getTransaction().isActive()) manager.getTransaction().rollback();
            manager.close();
        }
    }

    @Test public void choirQueryIncludesPrimarySecondaryAndSecondaryOnlyMembershipOnce() {
        PersonDate first = attendance(multi, 2, choirClass.getId());
        PersonDate second = attendance(choirPrimary, 2, choirClass.getId());
        PersonDate third = attendance(secondaryOnly, 2, choirClass.getId());
        attendance(inactive, 2, choirClass.getId());
        attendance(nonmember, 2, choirClass.getId());
        attendance(unassigned, 2, choirClass.getId());
        expect(filter(choirClass, 2), first, second, third);
        assertEquals(primaryClass.getId().intValue(), multi.getPerson().getEnrollmentClassId().intValue());
    }

    @Test public void attendanceClassAndSchoolRemainSeparateForTheSameStudent() {
        PersonDate choir = attendance(multi, 2, choirClass.getId());
        PersonDate primary = attendance(multi, 2, primaryClass.getId());
        PersonDate english = attendance(multi, 1, choirClass.getId());
        attendance(multi, 2, otherClass.getId());
        expect(filter(choirClass, 2), choir);
        expect(filter(primaryClass, 2), primary);
        expect(filter(choirClass, 1), english);
    }

    @Test public void groupAndKeywordFiltersStillIntersectSecondaryClassMembership() {
        PersonDate first = attendance(multi, 2, choirClass.getId());
        PersonDate second = attendance(choirPrimary, 2, choirClass.getId());
        attendance(secondaryOnly, 2, choirClass.getId());
        PersonDateDto search = filter(choirClass, 2);
        search.setGroupId(choirGroup.getId());
        expect(search, first, second);
        search.setTextSearch("MULTI");
        expect(search, first);
    }

    @Test public void legacyUnscopedRowsRetainExistingClassAndSchoolCompatibility() {
        PersonDate explicit = attendance(multi, 2, choirClass.getId());
        PersonDate unscopedClass = attendance(multi, 2, null);
        PersonDate legacyChurch = attendance(multi, null, null);
        PersonDate legacyEnglish = attendance(multi, null, null);
        legacyEnglish.setStatusMass(null); legacyEnglish.setExtraClass(null);
        expect(filter(choirClass, 2), explicit, unscopedClass, legacyChurch);
        expect(filter(choirClass, 1), legacyEnglish);
    }

    @Test public void dateBoundaryUsesTheExistingNumericVietnamMidnightSearchContract() throws Exception {
        PersonDate before = attendance(multi, 2, choirClass.getId());
        PersonDate start = attendance(multi, 2, choirClass.getId());
        PersonDate end = attendance(multi, 2, choirClass.getId());
        // Vietnam midnight is deserialized as the preceding UTC calendar day.
        before.setCreateDate(new LocalDateTime(2026, 10, 23, 23, 59));
        start.setCreateDate(new LocalDateTime(2026, 10, 24, 0, 0));
        end.setCreateDate(new LocalDateTime(2026, 10, 25, 0, 0));
        PersonDateDto search = filter(choirClass, 2);
        long midnight = new DateTime(2026, 10, 24, 0, 0, DateTimeZone.forID("Asia/Ho_Chi_Minh")).getMillis();
        ObjectMapper mapper = new ObjectMapper().registerModule(new JodaModule()).setTimeZone(TimeZone.getTimeZone("UTC"));
        PersonDateDto payload = mapper.readValue("{\"startDate\":" + midnight + ",\"endDate\":" + midnight + "}", PersonDateDto.class);
        assertEquals(new LocalDateTime(2026, 10, 23, 17, 0), payload.getStartDate());
        search.setStartDate(payload.getStartDate());
        search.setEndDate(payload.getEndDate());
        expect(search, start);
    }

    @Test public void countAndPaginatedTotalsDoNotMultiplySeveralMembershipsAndGroups() {
        PersonDate first = attendance(multi, 2, choirClass.getId());
        PersonDate second = attendance(choirPrimary, 2, choirClass.getId());
        PersonDate third = attendance(secondaryOnly, 2, choirClass.getId());
        manager.flush();
        PersonDateDto search = filter(choirClass, 2);
        expect(search, first, second, third);
        Set<Long> ids = new HashSet<Long>(Arrays.asList(first.getId(), second.getId(), third.getId()));
        for (int pageNumber = 1; pageNumber <= 3; pageNumber++) {
            Page<PersonDateDto> page = service.getPageObject(search, pageNumber, 1);
            assertEquals(3L, page.getTotalElements());
            assertEquals(1, page.getContent().size());
            // The existing query does not define ordering between separate requests.
            assertTrue(ids.contains(page.getContent().get(0).getId()));
        }
    }

    @Test public void absentClassFilterDoesNotRequireAnyEnrollmentMembership() {
        PersonDate first = attendance(unassigned, 2, null);
        PersonDate second = attendance(nonmember, 2, otherClass.getId());
        attendance(inactive, 2, null);
        expect(filter(null, 2), first, second);
    }

    private EnrolmentClass enrollmentClass(String name, int schoolId) {
        EnrolmentClass value = new EnrolmentClass(); value.setName(name); value.setSchoolId(schoolId);
        manager.persist(value); return value;
    }

    private UserGroup group(String name) {
        UserGroup value = new UserGroup(); value.setName(name); manager.persist(value); return value;
    }

    private User user(String name, boolean active, EnrolmentClass primary, Long... additional) {
        User user = new User(); user.setUsername(name); user.setEmail(name + "@example.test");
        user.setPassword("unused"); user.setActive(active); user.getEnrollmentClassIds().addAll(Arrays.asList(additional));
        Person person = new Person(); person.setLastName("Nguyễn Hoàng"); person.setFirstName(name);
        person.setEnrollmentClassId(primary == null ? null : primary.getId().intValue());
        person.setUser(user); user.setPerson(person); manager.persist(user); return user;
    }

    private PersonDate attendance(User user, Integer schoolId, Long classId) {
        PersonDate row = new PersonDate(); row.setUser(user); row.setSchoolId(schoolId);
        row.setAttendanceClassId(classId); row.setStatusMass(2); row.setStatusClass(2); row.setExtraClass(2);
        row.setCreateDate(new LocalDateTime(2026, 10, 24, 0, 0)); manager.persist(row); return row;
    }

    private PersonDateDto filter(EnrolmentClass selectedClass, Integer schoolId) {
        PersonDateDto search = new PersonDateDto(); search.setSchoolId(schoolId);
        UserDto user = new UserDto(); PersonDto person = new PersonDto(); user.setPerson(person); search.setUser(user);
        if (selectedClass != null) {
            person.setEnrollmentClassId(selectedClass.getId().intValue());
            search.setAttendanceClassId(selectedClass.getId());
        }
        return search;
    }

    private void expect(PersonDateDto search, PersonDate... expected) {
        manager.flush();
        Page<PersonDateDto> page = service.getPageObject(search, 1, 100);
        Set<Long> expectedIds = Arrays.stream(expected).map(PersonDate::getId).collect(Collectors.toSet());
        List<Long> actualIds = page.getContent().stream().map(PersonDateDto::getId).collect(Collectors.toList());
        assertEquals(expectedIds, new HashSet<Long>(actualIds));
        assertEquals(expectedIds.size(), actualIds.size());
        assertEquals(expectedIds.size(), page.getTotalElements());
    }
}
