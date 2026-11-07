package com.globits.richy.result;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
import javax.persistence.Entity;
import javax.persistence.EntityManager;

import com.globits.core.domain.Person;
import com.globits.richy.domain.TestResult;
import com.globits.richy.dto.TestResultDto;
import com.globits.richy.service.impl.TestResultServiceImpl;
import com.globits.security.domain.User;
import org.h2.jdbcx.JdbcDataSource;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.joda.time.LocalDateTime;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.test.util.ReflectionTestUtils;

public class TestResultRankingTest {
    private static SessionFactory factory;

    @BeforeClass
    public static void createDatabase() throws Exception {
        JdbcDataSource dataSource = new JdbcDataSource();
        dataSource.setURL("jdbc:h2:mem:test_result_ranking;MODE=MSSQLServer;DB_CLOSE_DELAY=-1");
        Configuration config = new Configuration()
                .setProperty("hibernate.dialect", "org.hibernate.dialect.H2Dialect")
                .setProperty("hibernate.hbm2ddl.auto", "create-drop")
                .setProperty("hibernate.generate_statistics", "true");
        config.getProperties().put("hibernate.connection.datasource", dataSource);
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));
        for (String base : Arrays.asList("com.globits.richy", "com.globits.core", "com.globits.security")) {
            for (BeanDefinition entity : scanner.findCandidateComponents(base)) {
                config.addAnnotatedClass(Class.forName(entity.getBeanClassName()));
            }
        }
        factory = config.buildSessionFactory();
    }

    @AfterClass
    public static void closeDatabase() {
        if (factory != null) {
            factory.close();
        }
    }

    @Test
    public void ranksDailyVocabWithTwoQueriesAndPreservesExistingFilters() {
        EntityManager em = factory.createEntityManager();
        em.getTransaction().begin();
        try {
            User alex = user(em, "alex", 5, true);
            alex.getEnrollmentClassIds().add(8L);
            User bao = user(em, "bao", 5, true);
            User cam = user(em, "cam", 5, true);
            user(em, "zero", 5, true);
            User otherClass = user(em, "other", 7, true);
            otherClass.getEnrollmentClassIds().add(5L);
            User inactive = user(em, "inactive", 5, false);

            result(em, alex, 1, "SUCCESS", 40, "2026-11-01T00:00");
            result(em, alex, 1, null, 5, "2026-11-03T17:00");
            result(em, alex, 1, "SUCCESS", null, "2026-11-03T18:00");
            result(em, alex, 1, "FAILED", 1000, "2026-11-03T17:00");
            result(em, alex, 3, "SUCCESS", 1000, "2026-11-03T17:00");
            result(em, alex, 1, "SUCCESS", 500, "2026-10-31T23:59");
            result(em, alex, 1, "SUCCESS", 500, "2026-11-08T00:00");
            result(em, bao, 1, "SUCCESS", 15, "2026-11-04T17:00");
            result(em, bao, 1, "SUCCESS", 30, "2026-11-05T17:00");
            result(em, cam, 1, "SUCCESS", 60, "2026-11-06T17:00");
            result(em, otherClass, 1, "SUCCESS", 200, "2026-11-06T17:00");
            result(em, inactive, 1, "SUCCESS", 200, "2026-11-06T17:00");
            em.flush();
            em.clear();

            TestResultServiceImpl service = new TestResultServiceImpl();
            ReflectionTestUtils.setField(service, "manager", em);
            TestResultDto search = new TestResultDto();
            search.setEnrollmentClassId(5);
            search.setStartDate(LocalDateTime.parse("2026-10-31T17:00"));
            search.setEndDate(LocalDateTime.parse("2026-11-06T17:00"));
            factory.getStatistics().clear();
            List<TestResultDto> ranking = service.getRanking(search);
            assertEquals(2L, factory.getStatistics().getPrepareStatementCount());
            assertEquals(Arrays.asList("alex", "bao", "cam", "zero", "cam", "alex", "bao", "zero"), usernames(ranking));
            assertEquals(Integer.valueOf(3), ranking.get(0).getTimes());
            assertEquals(Integer.valueOf(45), ranking.get(0).getNumberOfWords());
            assertEquals(Integer.valueOf(0), ranking.get(3).getTimes());
            assertEquals(Integer.valueOf(0), ranking.get(3).getNumberOfWords());
            assertEquals("alex Student", ranking.get(0).getTestTakerName());
            assertEquals(2, ranking.get(0).getUser().getEnrollmentClassIds().size());
            assertTrue(ranking.get(0).getUser().getEnrollmentClassIds().containsAll(Arrays.asList(5L, 8L)));

            search.setEnrollmentClassId(null);
            search.setNumberOfRanking(1);
            assertEquals(Arrays.asList("alex", "other"), usernames(service.getRanking(search)));
            search.setGrade("ao");
            search.setEndDate(null);
            assertEquals(Arrays.asList("bao", "bao"), usernames(service.getRanking(search)));
        } finally {
            em.getTransaction().rollback();
            em.close();
        }
    }

    private static List<String> usernames(List<TestResultDto> ranking) {
        return ranking.stream().map(score -> score.getUser().getUsername()).collect(Collectors.toList());
    }

    private static User user(EntityManager em, String name, int classId, boolean active) {
        User user = new User();
        user.setUsername(name);
        user.setEmail(name + "@example.invalid");
        user.setPassword("unused");
        user.setActive(active);
        Person person = new Person();
        person.setUser(user);
        person.setFirstName(name);
        person.setLastName("Student");
        person.setDisplayName(name + " Student");
        person.setEnrollmentClassId(classId);
        user.setPerson(person);
        em.persist(user);
        return user;
    }

    private static void result(EntityManager em, User user, int testType, String status, Integer words, String created) {
        TestResult result = new TestResult();
        result.setUser(user);
        result.setTestType(testType);
        result.setResultStatus(status);
        result.setNumberOfWords(words);
        em.persist(result);
        result.setCreateDate(LocalDateTime.parse(created));
    }
}
