package com.globits.richy.schedule;

import com.globits.richy.domain.*;
import java.io.File;
import java.util.*;
import org.hibernate.Session;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.Test;
import static org.junit.Assert.*;

/** Real Hibernate/H2 persistence exercises the production entity annotations. */
public class MultiTopicVocabularyPersistenceTest {
    static void register(Configuration cfg, Class<?> sample, String packageName) throws Exception {
        File source = new File(sample.getProtectionDomain().getCodeSource().getLocation().toURI());
        String prefix = packageName.replace('.', '/') + "/";
        List<String> names = new ArrayList<String>();
        if (source.isDirectory()) {
            File[] files = new File(source, prefix).listFiles();
            if (files == null) { throw new IllegalStateException("Entity package not found: " + packageName); }
            for (File file : files) { names.add(file.getName()); }
        } else {
            try (java.util.jar.JarFile jar = new java.util.jar.JarFile(source)) {
                java.util.Enumeration<java.util.jar.JarEntry> entries = jar.entries();
                while (entries.hasMoreElements()) {
                    String name = entries.nextElement().getName();
                    if (name.startsWith(prefix) && name.substring(prefix.length()).indexOf('/') < 0) {
                        names.add(name.substring(prefix.length()));
                    }
                }
            }
        }
        for (String name : names) {
            if (!name.endsWith(".class") || name.contains("$")) { continue; }
            Class<?> type = Class.forName(packageName + "." + name.replace(".class", ""));
            if (type.isAnnotationPresent(javax.persistence.Entity.class)) { cfg.addAnnotatedClass(type); }
        }
    }
    private String migrationSql() throws Exception {
        java.nio.file.Path path = java.nio.file.Paths.get(System.getProperty("assignment.migration",
                "../database/daily-vocab-assignment-topics.sql"));
        return new String(java.nio.file.Files.readAllBytes(path), java.nio.charset.StandardCharsets.UTF_8);
    }
    private void useMigrationJoinTable(org.h2.jdbcx.JdbcDataSource dataSource) throws Exception {
        String migration = migrationSql();
        int start = migration.indexOf("CREATE TABLE");
        int end = migration.indexOf("    );", start) + "    );".length();
        try (java.sql.Connection connection = dataSource.getConnection(); java.sql.Statement sql = connection.createStatement()) {
            sql.execute("DROP TABLE dbo.tbl_enrolment_class_schedule_task_topic");
            sql.execute(migration.substring(start, end));
        }
    }
    private TestResult evidence(Session session, com.globits.security.domain.User user, long taskId, Long topicId,
            String status, org.joda.time.LocalDateTime date, Topic... tags) {
        TestResult result = new TestResult(); result.setUser(user); result.setAssignmentTaskId(taskId);
        result.setAssignmentTopicId(topicId); result.setTestType(1); result.setResultStatus(status);
        session.save(result); session.flush();
        result.setCreateDate(date);
        result.getTopics().addAll(Arrays.asList(tags)); session.flush(); return result;
    }
    @Test public void orderedTopicsPersistAndReloadWithoutChangingLegacySingleTopic() throws Exception {
        org.h2.jdbcx.JdbcDataSource dataSource = new org.h2.jdbcx.JdbcDataSource();
        dataSource.setURL("jdbc:h2:mem:" + UUID.randomUUID().toString() + ";MODE=MSSQLServer;DB_CLOSE_DELAY=-1");
        try (java.sql.Connection connection = dataSource.getConnection(); java.sql.Statement sql = connection.createStatement()) {
            sql.execute("CREATE SCHEMA dbo");
        }
        Configuration cfg = new Configuration();
        cfg.getProperties().put("hibernate.connection.datasource", dataSource);
        cfg.setProperty("hibernate.default_schema", "dbo");
        cfg.setProperty("hibernate.dialect", "org.hibernate.dialect.H2Dialect");
        cfg.setProperty("hibernate.hbm2ddl.auto", "create-drop");
        cfg.setProperty("hibernate.show_sql", "false");
        cfg.setProperty("hibernate.temp.use_jdbc_metadata_defaults", "false");
        cfg.setProperty("hibernate.hbm2ddl.halt_on_error", "true");
        register(cfg, Topic.class, "com.globits.richy.domain");
        register(cfg, com.globits.core.domain.Organization.class, "com.globits.core.domain");
        register(cfg, com.globits.security.domain.User.class, "com.globits.security.domain");
        SessionFactory factory = cfg.buildSessionFactory();
        try {
            useMigrationJoinTable(dataSource);
            Session first = factory.openSession(); first.beginTransaction();
            EnrolmentClass clazz = new EnrolmentClass(); clazz.setName("Class"); clazz.setSchoolId(2); first.save(clazz);
            EnrolmentClassScheduleDay day = new EnrolmentClassScheduleDay(); day.setScheduleDate("2026-10-19"); day.setEnrolmentClass(clazz); first.save(day);
            Topic a = new Topic(); a.setName("A"); first.save(a); Topic b = new Topic(); b.setName("B"); first.save(b); Topic c = new Topic(); c.setName("C"); first.save(c);
            EnrolmentClassScheduleTask task = new EnrolmentClassScheduleTask(); task.setScheduleDay(day); task.setSection("HOMEWORK");
            task.setStatus("TODO"); task.setTitle("Three"); task.setActivityType("DAILY_VOCAB"); task.setTopics(Arrays.asList(c, a, b)); first.save(task);
            Long id = task.getId(); Long aId = a.getId(), bId = b.getId(), cId = c.getId();
            first.getTransaction().commit(); first.close();
            Session second = factory.openSession(); second.beginTransaction();
            EnrolmentClassScheduleTask loaded = second.get(EnrolmentClassScheduleTask.class, id);
            assertEquals(Arrays.asList(cId, aId, bId), new com.globits.richy.dto.EnrolmentClassScheduleTaskDto(loaded).getTopicIds());
            assertEquals(cId, loaded.getTopic().getId());
            loaded.setTopics(new ArrayList<Topic>(Arrays.asList(loaded.getTopics().get(1), loaded.getTopics().get(2))));
            second.getTransaction().commit(); second.close();
            Session third = factory.openSession(); third.beginTransaction();
            loaded = third.get(EnrolmentClassScheduleTask.class, id);
            assertEquals(Arrays.asList(aId, bId), new com.globits.richy.dto.EnrolmentClassScheduleTaskDto(loaded).getTopicIds());
            assertEquals(aId, loaded.getTopic().getId());
            TestResult evidence = new TestResult(); evidence.setAssignmentTaskId(id); evidence.setAssignmentTopicId(bId); evidence.setTestType(1); evidence.setResultStatus("SUCCESS"); third.save(evidence);
            third.getTransaction().commit(); third.close();
            Session fourth = factory.openSession(); fourth.beginTransaction();
            assertEquals(bId, fourth.get(TestResult.class, evidence.getId()).getAssignmentTopicId());
            com.globits.security.domain.User student = new com.globits.security.domain.User(); student.setUsername("student");
            student.setPassword("unused"); student.setEmail("student@example.invalid"); fourth.save(student);
            org.joda.time.LocalDateTime from = org.joda.time.LocalDateTime.now().minusDays(1), until = from.plusDays(2);
            Topic topicA = fourth.get(Topic.class, aId), topicB = fourth.get(Topic.class, bId);
            evidence(fourth, student, id, bId, "SUCCESS", from.plusHours(1), topicA, topicB);
            evidence(fourth, student, id, aId, "FAILED", from.plusHours(1), topicA);
            evidence(fourth, student, id, aId, null, from.plusHours(1), topicA);
            evidence(fourth, student, id + 1, aId, "SUCCESS", from.plusHours(1), topicA);
            evidence(fourth, student, id, aId, "SUCCESS", from.minusMillis(1), topicA);
            evidence(fourth, student, id, aId, "SUCCESS", until, topicA);
            String countQuery = com.globits.richy.repository.TestResultRepository.class.getMethod(
                    "countSuccessfulVocabularyTopicAttempts", Long.class, Long.class, Long.class,
                    org.joda.time.LocalDateTime.class, org.joda.time.LocalDateTime.class)
                    .getAnnotation(org.springframework.data.jpa.repository.Query.class).value();
            org.hibernate.query.Query<?> count = fourth.createQuery(countQuery).setParameter("studentId", student.getId())
                    .setParameter("taskId", id).setParameter("topicId", bId).setParameter("fromDate", from).setParameter("toDate", until);
            assertEquals(Long.valueOf(1), count.uniqueResult());
            assertEquals("Legacy null status remains a valid completion; FAILED/foreign/expired attempts stay excluded",
                    Long.valueOf(1), count.setParameter("topicId", aId).uniqueResult());
            String projectionQuery = com.globits.richy.repository.TestResultRepository.class.getMethod(
                    "findVocabularyCompletions", List.class, List.class, org.joda.time.LocalDateTime.class, org.joda.time.LocalDateTime.class)
                    .getAnnotation(org.springframework.data.jpa.repository.Query.class).value();
            List<?> rows = fourth.createQuery(projectionQuery).setParameterList("students", Collections.singletonList(student.getId()))
                    .setParameterList("topics", Arrays.asList(aId, bId)).setParameter("fromDate", from).setParameter("toDate", until).list();
            assertFalse(rows.isEmpty());
            Object[] row = (Object[]) rows.get(0); assertEquals(8, row.length); assertTrue(row[7] instanceof Long);
            com.globits.richy.dto.EnrolmentClassScheduleTaskDto teacherTask = new com.globits.richy.dto.EnrolmentClassScheduleTaskDto();
            teacherTask.setId(id); teacherTask.setSection("HOMEWORK"); teacherTask.setActivityType("DAILY_VOCAB");
            teacherTask.setTopicIds(Arrays.asList(aId, bId)); teacherTask.setRequiredAttempts(1);
            List<Object[]> completionRows = new ArrayList<Object[]>();
            for (Object value : rows) { completionRows.add((Object[]) value); }
            com.globits.richy.service.impl.HomeworkTopicCompletion.apply(teacherTask, completionRows, from, until);
            assertEquals("Teacher and student projections count the same saved SUCCESS plus legacy null records", "DONE",
                    teacherTask.getStudentProgress().get(0).getStatus());
            assertEquals(Integer.valueOf(100), teacherTask.getStudentProgress().get(0).getProgressPercent());
            EnrolmentClassScheduleTask legacyTask = new EnrolmentClassScheduleTask();
            legacyTask.setScheduleDay(fourth.get(EnrolmentClassScheduleDay.class, day.getId())); legacyTask.setSection("HOMEWORK");
            legacyTask.setStatus("TODO"); legacyTask.setTitle("Legacy single"); legacyTask.setActivityType("DAILY_VOCAB");
            legacyTask.setTopic(topicA); fourth.save(legacyTask);
            TestResult unambiguous = evidence(fourth, student, legacyTask.getId(), null, null, from.plusHours(1), topicA);
            TestResult wrongTag = evidence(fourth, student, legacyTask.getId(), null, "SUCCESS", from.plusHours(1), topicB);
            TestResult grouped = evidence(fourth, student, id, null, "SUCCESS", from.plusHours(1), topicA, topicB);
            TestResult explicit = evidence(fourth, student, legacyTask.getId(), bId, "SUCCESS", from.plusHours(1), topicA, topicB);
            String migration = migrationSql();
            final String backfill = migration.substring(migration.indexOf("UPDATE dbo.tbl_test_result"));
            fourth.doWork(connection -> { try (java.sql.Statement sql = connection.createStatement()) { sql.execute(backfill); } });
            fourth.refresh(unambiguous); fourth.refresh(wrongTag); fourth.refresh(grouped); fourth.refresh(explicit);
            assertEquals(aId, unambiguous.getAssignmentTopicId()); assertNull(wrongTag.getAssignmentTopicId());
            assertNull("Rerunning the migration must never guess the first topic of a grouped task", grouped.getAssignmentTopicId());
            assertEquals("Explicit selected topic is immutable during backfill", bId, explicit.getAssignmentTopicId());
            // Idempotent backfill keeps the same evidence on a second run.
            fourth.doWork(connection -> { try (java.sql.Statement sql = connection.createStatement()) { sql.execute(backfill); } });
            fourth.refresh(unambiguous); assertEquals(aId, unambiguous.getAssignmentTopicId());
            fourth.getTransaction().commit(); fourth.close();
        } finally { factory.close(); }
    }
}
