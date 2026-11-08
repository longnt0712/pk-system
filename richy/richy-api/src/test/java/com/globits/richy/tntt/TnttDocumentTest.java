package com.globits.richy.tntt;

import static com.globits.richy.service.impl.TnttDocumentPayload.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

import com.globits.core.domain.Person;
import com.globits.richy.domain.*;
import com.globits.richy.dto.TnttDocumentRequest;
import com.globits.richy.service.impl.*;
import com.globits.security.domain.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.function.LongSupplier;
import javax.persistence.*;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

public class TnttDocumentTest {
    private static SessionFactory factory;
    private EntityManager em;
    private TnttDocumentService service;
    private TnttDocumentMail mail;
    private User admin, education, manager, leader, student, other;
    private long now = 1800000000000L;

    private static void register(Configuration cfg, String pkg) throws Exception {
        org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider scanner =
                new org.springframework.context.annotation
                        .ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(
                new org.springframework.core.type.filter.AnnotationTypeFilter(Entity.class));
        for (org.springframework.beans.factory.config.BeanDefinition bean :
                scanner.findCandidateComponents(pkg)) {
            cfg.addAnnotatedClass(Class.forName(bean.getBeanClassName()));
        }
    }

    @BeforeClass
    public static void database() throws Exception {
        org.h2.jdbcx.JdbcDataSource ds = new org.h2.jdbcx.JdbcDataSource();
        ds.setURL("jdbc:h2:mem:tntt_documents;MODE=MSSQLServer;DB_CLOSE_DELAY=-1");
        try (java.sql.Connection c = ds.getConnection();
                java.sql.Statement s = c.createStatement()) {
            s.execute("create schema dbo");
        }
        Configuration cfg =
                new Configuration()
                        .setProperty("hibernate.default_schema", "dbo")
                        .setProperty("hibernate.dialect", "org.hibernate.dialect.H2Dialect")
                        .setProperty("hibernate.hbm2ddl.auto", "create-drop")
                        .setProperty("hibernate.show_sql", "false")
                        .setProperty("hibernate.generate_statistics", "true")
                        .setProperty("hibernate.temp.use_jdbc_metadata_defaults", "false")
                        .setProperty("hibernate.hbm2ddl.halt_on_error", "true");
        cfg.getProperties().put("hibernate.connection.datasource", ds);
        register(cfg, "com.globits.richy.domain");
        register(cfg, "com.globits.core.domain");
        register(cfg, "com.globits.security.domain");
        for (Class<?> c :
                Arrays.asList(
                        TnttDocumentEntry.class,
                        TnttDocumentNotice.class,
                        TnttDocumentRecipient.class,
                        TnttDocumentVersion.class)) cfg.addAnnotatedClass(c);
        factory = cfg.buildSessionFactory();
        String sql =
                new String(
                        Files.readAllBytes(
                                System.getProperty("basedir") == null
                                        ? Paths.get("richy/database/tntt-documents.sql")
                                        : Paths.get(
                                                System.getProperty("basedir"),
                                                "..",
                                                "database",
                                                "tntt-documents.sql")),
                        StandardCharsets.UTF_8);
        java.util.regex.Matcher m =
                java.util.regex.Pattern.compile(
                                "(?s)CREATE TABLE dbo\\.tbl_tntt_\\w+ \\(.*?\n \\);")
                        .matcher(sql);
        List<String> ddl = new ArrayList<>();
        while (m.find()) ddl.add(m.group());
        assertEquals(4, ddl.size());
        try (java.sql.Connection c = ds.getConnection();
                java.sql.Statement s = c.createStatement()) {
            for (String t : Arrays.asList("version", "recipient", "notice", "entry"))
                s.execute("DROP TABLE dbo.tbl_tntt_document_" + t);
            for (String d : ddl) s.execute(d);
        }
    }

    @AfterClass
    public static void close() {
        if (factory != null) factory.close();
    }

    private User user(String role, String type) {
        Role r = new Role();
        r.setName(role);
        em.persist(r);
        User u = new User();
        u.setUsername("u" + UUID.randomUUID());
        u.setPassword("unused");
        u.setActive(true);
        u.setEmail(u.getUsername() + "@example.invalid");
        u.setRoles(new HashSet<>(Arrays.asList(r)));
        Person p = new Person();
        p.setFirstName("Người dùng kiểm thử");
        p.setTnttMemberType(type);
        p.setUser(u);
        u.setPerson(p);
        em.persist(u);
        em.flush();
        return u;
    }

    private void actor(User u) {
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new UsernamePasswordAuthenticationToken(
                                u, "unused", Collections.emptyList()));
    }

    @Before
    public void fixture() {
        em = factory.createEntityManager();
        em.getTransaction().begin();
        admin = user("ROLE_ADMIN", null);
        education = user("ROLE_EDUCATION_MANAGEMENT", null);
        manager = user("ROLE_STUDENT_MANAGEMENT", null);
        leader = user("ROLE_USER", "HUYNH_TRUONG");
        student = user("ROLE_STUDENT", "DOAN_SINH");
        other = user("ROLE_VIEWER", null);
        actor(admin);
        mail = mock(TnttDocumentMail.class);
        when(mail.configured()).thenReturn(true);
        service = new TnttDocumentService();
        ReflectionTestUtils.setField(service, "em", em);
        ReflectionTestUtils.setField(service, "mail", mail);
        ReflectionTestUtils.setField(service, "enabled", true);
        ReflectionTestUtils.setField(service, "clock", (LongSupplier) () -> now);
    }

    @After
    public void rollback() {
        SecurityContextHolder.clearContext();
        if (em.getTransaction().isActive()) em.getTransaction().rollback();
        em.close();
    }

    private Long create(String kind, Long parent) {
        TnttDocumentRequest r = new TnttDocumentRequest();
        r.kind = kind;
        r.title = kind.equals("FOLDER") ? "Thư mục" : "Biên bản họp";
        r.parentId = parent;
        r.document = blank();
        return (Long) service.create(r).get("id");
    }

    private long revision(Long id) {
        return (Long) service.read(id, null).get("revision");
    }

    private TnttDocumentRequest publishRequest(Long id, boolean email) {
        TnttDocumentRequest r = new TnttDocumentRequest();
        r.revision = revision(id);
        r.requestKey = UUID.randomUUID().toString();
        r.startsAt = now - 1;
        r.endsAt = now + 60000;
        r.groups = Arrays.asList("ADMIN", "EDUCATION", "STUDENT_MANAGEMENT", "LEADERS");
        r.email = email;
        r.summary = "Thông báo họp";
        return r;
    }

    private void denied(Runnable r) {
        try {
            r.run();
            fail("Expected denied");
        } catch (AccessDeniedException expected) {
        }
    }

    private void invalid(Runnable r) {
        try {
            r.run();
            fail("Expected invalid");
        } catch (IllegalArgumentException expected) {
        }
    }

    @Test
    public void permissionsExcludeStudentsAndSeparateEditingFromSharedReading() {
        Long id = create("DOCUMENT", null);
        actor(manager);
        denied(() -> create("DOCUMENT", null));
        denied(() -> service.read(id, null));
        actor(admin);
        Long n = (Long) service.publish(id, publishRequest(id, false)).get("id");
        actor(manager);
        assertEquals(false, service.read(id, null).get("canEdit"));
        assertEquals(1, service.notifications(true).size());
        TnttDocumentRequest save = new TnttDocumentRequest();
        save.revision = 0L;
        save.document = blank();
        denied(() -> service.save(id, save));
        actor(student);
        assertTrue(service.notifications(true).isEmpty());
        denied(() -> service.notificationDocument(n));
        denied(() -> service.markRead(n));
        actor(other);
        denied(() -> service.read(id, null));
        actor(education);
        assertEquals(true, service.read(id, null).get("canEdit"));
    }

    @Test
    public void publicLinkIsReadOnlyForGuestsAndCanBeRevoked() {
        Long id = create("DOCUMENT", null);
        assertNull(service.publicLink(id).get("token"));
        String token = service.enablePublicLink(id).get("token");
        assertTrue(token.matches("[a-f0-9]{32}"));
        assertEquals(token, service.enablePublicLink(id).get("token"));
        actor(student);
        denied(() -> service.enablePublicLink(id));
        denied(() -> service.revokePublicLink(id));
        SecurityContextHolder.clearContext();
        assertNull(service.readPublicLink(id.toString()));
        assertEquals(new HashSet<>(Arrays.asList("title", "document")), service.readPublicLink(token).keySet());
        actor(admin);
        service.revokePublicLink(id);
        assertNull(service.readPublicLink(token));
        assertNotEquals(token, service.enablePublicLink(id).get("token"));
    }

    @Test
    public void foldersAreNestedCycleSafeAndRecoverable() {
        Long a = create("FOLDER", null), b = create("FOLDER", a), doc = create("DOCUMENT", b);
        TnttDocumentEntry e = em.find(TnttDocumentEntry.class, a);
        TnttDocumentRequest r = new TnttDocumentRequest();
        r.title = e.title;
        r.revision = e.revision;
        r.parentId = b;
        invalid(() -> service.update(a, r));
        r.parentId = null;
        r.archived = true;
        invalid(() -> service.update(a, r));
        TnttDocumentEntry d = em.find(TnttDocumentEntry.class, doc);
        r.title = d.title;
        r.revision = d.revision;
        r.parentId = b;
        service.update(doc, r);
        assertTrue(em.find(TnttDocumentEntry.class, doc).archived);
        r.revision = em.find(TnttDocumentEntry.class, doc).revision;
        r.archived = false;
        service.update(doc, r);
        assertFalse(em.find(TnttDocumentEntry.class, doc).archived);
    }

    @Test
    public void textAndInkUseRevisionChecksAndDoNotLeakUnpublishedEdits() {
        Long id = create("DOCUMENT", null);
        TnttDocumentRequest r = new TnttDocumentRequest();
        r.revision = revision(id);
        r.document = blank();
        r.document.put("text", "Biên bản tiếng Việt");
        r.document.put("textColor", "#e06666");
        r.document.put(
                "strokes",
                Arrays.asList(
                        map(
                                "id",
                                "ink-1",
                                "tool",
                                "pen",
                                "color",
                                "#315bbe",
                                "width",
                                4,
                                "points",
                                Arrays.asList(
                                        Arrays.asList(10, 20, 0.5), Arrays.asList(30, 40, 0.7)))));
        service.save(id, r);
        long saved = revision(id);
        service.save(id, r);
        assertEquals(saved, revision(id));
        service.publish(id, publishRequest(id, false));
        r.revision = revision(id);
        r.document = blank();
        r.document.put("text", "Bản soạn chưa công bố");
        r.document.put("textColor", "#123abc");
        service.save(id, r);
        actor(manager);
        Map<?, ?> visible = (Map<?, ?>) service.read(id, null).get("document");
        assertEquals("Biên bản tiếng Việt", visible.get("text"));
        assertEquals("#e06666", visible.get("textColor"));
        actor(admin);
        r.revision = 0L;
        r.document.put("text", "Nội dung khác");
        try {
            service.save(id, r);
            fail();
        } catch (TnttDocumentService.Conflict expected) {
        }
    }

    @Test
    public void publicationIsIdempotentAndReadAcknowledgementsExpireAcrossSessions() {
        Long id = create("DOCUMENT", null);
        TnttDocumentRequest r = publishRequest(id, false);
        r.startsAt = now + 1000;
        r.endsAt = now + 2000;
        Long n = (Long) service.publish(id, r).get("id");
        assertEquals(n, service.publish(id, r).get("id"));
        actor(manager);
        assertTrue(service.notifications(true).isEmpty());
        denied(() -> service.read(id, null));
        now += 1000;
        assertEquals(1, service.notifications(true).size());
        service.markRead(n);
        assertTrue(service.notifications(true).isEmpty());
        actor(other);
        actor(manager);
        assertTrue(service.notifications(true).isEmpty());
        assertNotNull(service.notifications(false).get(0).get("readAt"));
        now += 1000;
        assertTrue(service.notifications(true).isEmpty());
        assertNotNull(service.read(id, null).get("document"));
    }

    @Test
    public void hidingSharingRevokesDirectLinksAndCancelsPendingEmailWithoutResendingOnToggle() {
        Long id = create("DOCUMENT", null);
        Long n = (Long) service.publish(id, publishRequest(id, true)).get("id");
        TnttDocumentRequest r = new TnttDocumentRequest();
        r.revision = revision(id);
        r.shared = false;
        service.sharing(id, r);
        assertTrue(service.claimEmails().isEmpty());
        actor(manager);
        denied(() -> service.notificationDocument(n));
        assertTrue(service.notifications(true).isEmpty());
        actor(admin);
        r.revision = revision(id);
        r.shared = true;
        service.sharing(id, r);
        assertTrue(service.claimEmails().isEmpty());
        actor(manager);
        assertNotNull(service.notificationDocument(n));
    }

    @Test
    public void emailQueueDeduplicatesAddressesAndNeverRunsOutsideTheNoticeWindow() {
        education.setEmail(admin.getEmail().toUpperCase(java.util.Locale.ROOT));
        Long id = create("DOCUMENT", null);
        TnttDocumentRequest r = publishRequest(id, true);
        r.startsAt = now + 1000;
        service.publish(id, r);
        assertTrue(service.claimEmails().isEmpty());
        now += 1000;
        List<Map<String, Object>> jobs = service.claimEmails();
        assertEquals(3, jobs.size());
        assertEquals(1, jobs.stream().filter(j -> admin.getEmail().equals(j.get("email"))).count());
        assertTrue(service.claimEmails().isEmpty());
        for (Map<String, Object> j : jobs)
            service.emailResult((Long) j.get("noticeId"), (String) j.get("email"), true);
        assertTrue(service.claimEmails().isEmpty());
        now += 60000;
        assertTrue(service.claimEmails().isEmpty());
    }

    @Test
    public void invalidAddressesStayVisibleOnWebAndConfiguredMailIsRequired() {
        manager.setEmail("invalid-address");
        Long id = create("DOCUMENT", null);
        service.publish(id, publishRequest(id, true));
        assertEquals(3, service.claimEmails().size());
        actor(manager);
        assertEquals(1, service.notifications(true).size());
        actor(admin);
        when(mail.configured()).thenReturn(false);
        invalid(() -> service.publish(id, publishRequest(id, true)));
        verify(mail, never()).send(anyString(), anyString(), anyString(), anyString());
    }

    @Test
    public void studentIdsCannotBeIncludedExplicitlyAndOtherSchoolUsersAreNotRecipients() {
        Long id = create("DOCUMENT", null);
        TnttDocumentRequest r = publishRequest(id, false);
        r.groups = Collections.emptyList();
        r.userIds = Arrays.asList(student.getId(), other.getId());
        invalid(() -> service.publish(id, r));
        assertFalse(
                service.recipients().stream()
                        .anyMatch(
                                x ->
                                        Objects.equals(x.get("id"), student.getId())
                                                || Objects.equals(x.get("id"), other.getId())));
    }

    @Test
    public void pageCountSurvivesSavingAndPublishedSnapshotsAndRejectsInvalidCounts() {
        assertEquals(3, blank().get("pageCount"));
        Map<String, Object> legacy = blank();
        legacy.remove("pageCount");
        assertFalse(decode(validate(legacy)).containsKey("pageCount"));
        for (Object count : Arrays.asList(0, -1, 81, 2.5, "3")) {
            Map<String, Object> document = blank();
            document.put("pageCount", count);
            invalid(() -> validate(document));
        }
        Long id = create("DOCUMENT", null);
        TnttDocumentRequest save = new TnttDocumentRequest();
        save.revision = revision(id);
        save.document = blank();
        save.document.put("pageCount", 5);
        service.save(id, save);
        assertEquals(5, ((Map<?, ?>) service.read(id, null).get("document")).get("pageCount"));
        Long notice = (Long) service.publish(id, publishRequest(id, false)).get("id");
        save.revision = revision(id);
        save.document.put("pageCount", 6);
        service.save(id, save);
        assertEquals(6, ((Map<?, ?>) service.read(id, null).get("document")).get("pageCount"));
        actor(manager);
        assertEquals(5, ((Map<?, ?>) service.notificationDocument(notice).get("document")).get("pageCount"));
    }

    @Test
    public void formattedTextSurvivesSavingAndRejectsUnsafeEmbedsOrMismatchedContent() {
        Long id = create("DOCUMENT", null);
        TnttDocumentRequest save = new TnttDocumentRequest();
        save.revision = revision(id);
        save.document = blank();
        save.document.put("text", "Abba Cha ơi");
        Map<String, Object> delta = map("ops", Arrays.asList(
                map("insert", "Abba", "attributes", map("bold", true, "italic", true, "underline", true, "color", "#ff0000")),
                map("insert", " Cha ơi\n")));
        save.document.put("textDelta", delta);
        service.save(id, save);
        assertEquals(delta, ((Map<?, ?>) service.read(id, null).get("document")).get("textDelta"));
        for (Map<String, Object> invalidDelta : Arrays.asList(
                map("ops", Arrays.asList(map("insert", "Khác\n"))),
                map("ops", Arrays.asList(map("insert", map("image", "bad")))),
                map("ops", Arrays.asList(map("insert", "Abba Cha ơi\n", "attributes", map("link", "bad")))))) {
            save.document.put("textDelta", invalidDelta);
            invalid(() -> validate(save.document));
        }
    }

    @Test
    public void pastedTablesAndImagesSurviveSavingPublicLinksAndPublishedSnapshots() {
        Long id = create("DOCUMENT", null);
        String image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=";
        Map<String, Object> delta = map("ops", Arrays.asList(
                map("insert", "Phân công", "attributes", map("bold", true)),
                map("insert", "\n", "attributes", map("table", "row-header", "table-colspan", "2")),
                map("insert", "An"), map("insert", map("softbreak", true)), map("insert", "Bình"), map("insert", "\n", "attributes", map("table", "row-body", "table-rowspan", "2")),
                map("insert", map("image", image), "attributes", map("width", "320")), map("insert", "\n\n")));
        TnttDocumentRequest save = new TnttDocumentRequest();
        save.revision = revision(id);
        save.document = blank();
        save.document.put("text", "Phân công\nAn\u2028Bình\n\n");
        save.document.put("textDelta", delta);
        service.save(id, save);
        assertEquals(delta, ((Map<?, ?>) service.read(id, null).get("document")).get("textDelta"));
        String token = service.enablePublicLink(id).get("token");
        Long notice = (Long) service.publish(id, publishRequest(id, false)).get("id");
        SecurityContextHolder.clearContext();
        assertEquals(delta, ((Map<?, ?>) service.readPublicLink(token).get("document")).get("textDelta"));
        actor(manager);
        assertEquals(delta, ((Map<?, ?>) service.notificationDocument(notice).get("document")).get("textDelta"));

        for (Map<String, Object> op : Arrays.asList(
                map("insert", map("image", "https://example.test/tracking.png")),
                map("insert", map("image", "data:image/svg+xml;base64,PHN2Zz4=")),
                map("insert", map("image", "data:image/png;base64,iVBORw0KGgo=")),
                map("insert", map("image", image.replace("image/png", "image/jpeg"))),
                map("insert", map("image", image), "attributes", map("width", "4097")),
                map("insert", map("image", image), "attributes", map("onload", "alert(1)")),
                map("insert", map("softbreak", "true")),
                map("insert", map("softbreak", true), "attributes", map("width", "320")),
                map("insert", "text", "attributes", map("color", "url(evil)")),
                map("insert", "text", "attributes", map("underline", "true")),
                map("insert", "text", "attributes", map("table", "row-header")),
                map("insert", "\n", "attributes", map("table", "<script>")),
                map("insert", "\n", "attributes", map("table-colspan", "2")),
                map("insert", "\n", "attributes", map("table", "row-header", "table-rowspan", "999")))) {
            Map<String, Object> bad = blank();
            bad.put("textDelta", map("ops", Arrays.asList(op, map("insert", "\n"))));
            invalid(() -> validate(bad));
        }
    }

    @Test
    public void liveMutationReceiptsAreIdempotentAndNeverLeakIntoPublicContent() {
        Long id = create("DOCUMENT", null);
        TnttDocumentRequest first = new TnttDocumentRequest();
        first.revision = revision(id); first.mutationId = "11111111-1111-4111-8111-111111111111"; first.document = blank(); first.document.put("text", "Máy A");
        service.save(id, first);
        actor(education);
        TnttDocumentRequest second = new TnttDocumentRequest();
        second.revision = revision(id); second.mutationId = "22222222-2222-4222-8222-222222222222"; second.document = blank(); second.document.put("text", "Máy A và máy B");
        service.save(id, second);
        invalid(() -> service.save(id, first)); // Another account cannot claim an existing mutation id.
        actor(admin);
        Long head = revision(id);
        Map<String, Object> acknowledged = service.save(id, first);
        assertEquals(head.longValue(), revision(id));
        assertEquals("Máy A và máy B", ((Map<?, ?>) acknowledged.get("document")).get("text"));
        assertEquals(2, ((List<?>) ((Map<?, ?>) acknowledged.get("sync")).get("recent")).size());
        first.document.put("text", "Không được dùng lại mã cho nội dung khác");
        invalid(() -> service.save(id, first));
        TnttDocumentRequest stale = new TnttDocumentRequest(); stale.revision = 0L; stale.mutationId = "33333333-3333-4333-8333-333333333333"; stale.document = second.document;
        try { service.save(id, stale); fail("Distinct concurrent edits must be rebased, even if their text is identical."); } catch (TnttDocumentService.Conflict expected) {}
        String token = service.enablePublicLink(id).get("token");
        SecurityContextHolder.clearContext();
        assertFalse(((Map<?, ?>) service.readPublicLink(token).get("document")).containsKey("_live"));
        actor(manager); denied(() -> service.liveAccess(id));
        actor(student); denied(() -> service.liveAccess(id));
        actor(education); assertEquals(education.getId(), service.liveAccess(id).get("userId"));
    }

    @Test
    public void liveRevisionHintsWaitUntilTheDatabaseTransactionCommits() {
        Long id = create("DOCUMENT", null);
        List<Object> sent = new ArrayList<>();
        ReflectionTestUtils.setField(service, "events", new org.springframework.context.ApplicationEventPublisher() {
            @Override public void publishEvent(org.springframework.context.ApplicationEvent event) { sent.add(event); }
            @Override public void publishEvent(Object event) { sent.add(event); }
        });
        org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
        try {
            TnttDocumentRequest save = new TnttDocumentRequest(); save.revision = revision(id); save.document = blank(); save.document.put("text", "Chỉ gửi sau commit");
            service.save(id, save);
            assertTrue(sent.isEmpty());
            for (org.springframework.transaction.support.TransactionSynchronization synchronization : org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations()) synchronization.afterCommit();
            assertEquals(1, sent.size());
            assertEquals(id, ((TnttDocumentChanged) sent.get(0)).documentId);
            assertEquals(revision(id), ((TnttDocumentChanged) sent.get(0)).revision.longValue());
        } finally { org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization(); }
    }

    @Test
    public void payloadRejectsInvalidInkInsteadOfSavingAPartialDocument() {
        final Map<String, Object> v = blank();
        v.put(
                "strokes",
                Arrays.asList(
                        map(
                                "id",
                                "i",
                                "tool",
                                "pen",
                                "color",
                                "red",
                                "width",
                                4,
                                "points",
                                Arrays.asList(Arrays.asList(1, 2)))));
        invalid(() -> validate(v));
        final Map<String, Object> bad = blank();
        bad.put(
                "strokes",
                Arrays.asList(
                        map(
                                "id",
                                "i",
                                "tool",
                                "pen",
                                "color",
                                "#123456",
                                "width",
                                4,
                                "points",
                                Arrays.asList(Arrays.asList(-1, 2)))));
        invalid(() -> validate(bad));
    }

    @Test
    public void versionRestoreCreatesANewRevisionAndSendingATestOnlyTargetsTheActor() {
        Long id = create("DOCUMENT", null);
        TnttDocumentRequest r = new TnttDocumentRequest();
        r.revision = revision(id);
        r.document = blank();
        r.document.put("text", "Nội dung mới");
        service.save(id, r);
        List<Map<String, Object>> history = service.history(id);
        assertTrue(history.size() >= 2);
        r.revision = revision(id);
        r.versionId = (Long) history.get(history.size() - 1).get("id");
        service.restore(id, r);
        assertEquals("", ((Map<?, ?>) service.read(id, null).get("document")).get("text"));
        service.testEmail(id);
        verify(mail).send(eq(admin.getEmail()), contains("Biên bản"), anyString(), anyString());
    }

    @Test
    public void laterPublicationKeepsThePreviouslySentSnapshotInHistory() {
        Long id = create("DOCUMENT", null);
        Long first = (Long) service.publish(id, publishRequest(id, false)).get("id");
        now += 1000;
        Long second = (Long) service.publish(id, publishRequest(id, false)).get("id");
        actor(manager);
        assertEquals(1, service.notifications(true).size());
        assertEquals(second, service.notifications(true).get(0).get("id"));
        assertEquals(2, service.notifications(false).size());
        assertNotNull(service.notificationDocument(first).get("document"));
    }

    private EnrolmentClass teamClass(String name, EnrolmentClass parent) {
        EnrolmentClass c = new EnrolmentClass();
        c.setName(name);
        c.setSchoolId(2);
        c.setParent(parent);
        em.persist(c);
        em.flush();
        return c;
    }

    private EnrolmentClassServiceImpl teams() {
        EnrolmentClassServiceImpl t = new EnrolmentClassServiceImpl();
        com.globits.richy.repository.EnrolmentClassRepository classes =
                mock(com.globits.richy.repository.EnrolmentClassRepository.class);
        com.globits.security.repository.UserRepository users =
                mock(com.globits.security.repository.UserRepository.class);
        when(classes.findOne(anyLong()))
                .thenAnswer(i -> em.find(EnrolmentClass.class, (Long) i.getArguments()[0]));
        when(classes.findByParentId(anyLong()))
                .thenAnswer(
                        i ->
                                em.createQuery(
                                                "select c from EnrolmentClass c where c.parent.id=:id",
                                                EnrolmentClass.class)
                                        .setParameter("id", i.getArguments()[0])
                                        .getResultList());
        when(users.findOne(anyLong()))
                .thenAnswer(i -> em.find(User.class, (Long) i.getArguments()[0]));
        when(users.findByUsername(anyString()))
                .thenAnswer(
                        i ->
                                em.createQuery(
                                                "select u from User u where u.username=:name",
                                                User.class)
                                        .setParameter("name", i.getArguments()[0])
                                        .getSingleResult());
        when(users.getUsersByEnrollmentClassIds(anyList()))
                .thenAnswer(
                        i -> {
                            List<Long> ids = (List<Long>) i.getArguments()[0];
                            List<User> out = new ArrayList<>();
                            for (User u :
                                    em.createQuery("select u from User u", User.class)
                                            .getResultList()) {
                                boolean match =
                                        u.getPerson() != null
                                                && u.getPerson().getEnrollmentClassId() != null
                                                && ids.contains(
                                                        u.getPerson()
                                                                .getEnrollmentClassId()
                                                                .longValue());
                                if (u.getEnrollmentClassIds() != null)
                                    for (Long id : u.getEnrollmentClassIds())
                                        match |= ids.contains(id);
                                if (match) out.add(u);
                            }
                            return out;
                        });
        ReflectionTestUtils.setField(t, "enrolmentClassRepository", classes);
        ReflectionTestUtils.setField(t, "userRepository", users);
        ReflectionTestUtils.setField(t, "teamEntityManager", em);
        return t;
    }

    private com.globits.richy.dto.EnrolmentClassTeamSettingsDto command(
            String key, String gender, Long user, String role) {
        com.globits.richy.dto.EnrolmentClassTeamSettingsDto r =
                new com.globits.richy.dto.EnrolmentClassTeamSettingsDto();
        r.expectedKey = key;
        r.gender = gender;
        r.userId = user;
        r.role = role;
        return r;
    }

    @Test
    public void teamGenderAndInlineLeadershipPersistWithoutGrantingPermissions() {
        EnrolmentClass root = teamClass("Lớp", null), team = teamClass("Đội", root);
        student.getEnrollmentClassIds().add(root.getId());
        student.getEnrollmentClassIds().add(team.getId());
        em.flush();
        EnrolmentClassServiceImpl t = teams();
        String key = t.getTeamBoard(root.getId()).getTeams().get(0).getLeadershipKey();
        t.updateTeamSettings(
                root.getId(), team.getId(), command(key, "F", student.getId(), "CAPTAIN"));
        em.flush();
        em.clear();
        team = em.find(EnrolmentClass.class, team.getId());
        assertEquals("F", team.getTeamGender());
        assertEquals(student.getId(), team.getPrimaryTeacherId());
        assertEquals(1, em.find(User.class, student.getId()).getRoles().size());
        key = t.getTeamBoard(root.getId()).getTeams().get(0).getLeadershipKey();
        t.updateTeamSettings(
                root.getId(), team.getId(), command(key, "MIXED", student.getId(), "DEPUTY"));
        assertNull(team.getPrimaryTeacherId());
        assertTrue(team.getTeachers().stream().anyMatch(u -> u.getId().equals(student.getId())));
        com.globits.richy.dto.EnrolmentClassMoveStudentDto move =
                new com.globits.richy.dto.EnrolmentClassMoveStudentDto();
        move.setUserId(student.getId());
        move.setTargetTeamId(null);
        t.moveStudentToTeam(root.getId(), move);
        assertTrue(team.getTeachers().isEmpty());
        assertTrue(
                em.find(User.class, student.getId())
                        .getEnrollmentClassIds()
                        .contains(root.getId()));
    }

    @Test
    public void staleTeamCommandsAndNonMembersCannotOverwriteLeaders() {
        EnrolmentClass root = teamClass("Lớp", null),
                team = teamClass("Đội", root),
                otherRoot = teamClass("Khác", null),
                foreign = teamClass("Đội khác", otherRoot);
        EnrolmentClassServiceImpl t = teams();
        String key = t.getTeamBoard(root.getId()).getTeams().get(0).getLeadershipKey();
        try {
            t.updateTeamSettings(
                    root.getId(), team.getId(), command(key, null, student.getId(), "CAPTAIN"));
            fail();
        } catch (com.globits.richy.service.EnrolmentClassScheduleException expected) {
            assertEquals(org.springframework.http.HttpStatus.BAD_REQUEST, expected.getStatus());
        }
        t.updateTeamSettings(root.getId(), team.getId(), command(key, "M", null, null));
        try {
            t.updateTeamSettings(root.getId(), team.getId(), command(key, "F", null, null));
            fail();
        } catch (com.globits.richy.service.EnrolmentClassScheduleException expected) {
            assertEquals(org.springframework.http.HttpStatus.CONFLICT, expected.getStatus());
        }
        assertEquals("M", team.getTeamGender());
        denied(
                () ->
                        t.updateTeamSettings(
                                root.getId(), foreign.getId(), command(key, "F", null, null)));
        actor(student);
        denied(
                () ->
                        t.updateTeamSettings(
                                root.getId(), team.getId(), command(key, "F", null, null)));
    }

    @Test
    public void assignedChurchTeachersAreRecipientsEvenWithoutStudentClassEnrollment() {
        leader.getPerson().setTnttMemberType(null);
        EnrolmentClass root = teamClass("Lớp giáo lý", null);
        root.getTeachers().add(leader);
        em.flush();
        assertTrue(service.recipients().stream().anyMatch(x -> leader.getId().equals(x.get("id"))));
        Long id = create("DOCUMENT", null);
        TnttDocumentRequest r = publishRequest(id, false);
        r.groups = Arrays.asList("LEADERS");
        service.publish(id, r);
        actor(leader);
        assertEquals(1, service.notifications(true).size());
    }

    @Test
    public void noticePollingAndDirectoryDoNotLoadHandwritingSnapshots() {
        Long id = create("DOCUMENT", null);
        service.publish(id, publishRequest(id, false));
        actor(manager);
        em.clear();
        factory.getStatistics().clear();
        assertEquals(1, service.notifications(true).size());
        assertEquals(1, service.list(false, "").size());
        assertEquals(
                0,
                factory.getStatistics()
                        .getEntityStatistics(TnttDocumentNotice.class.getName())
                        .getLoadCount());
        assertEquals(
                0,
                factory.getStatistics()
                        .getEntityStatistics(TnttDocumentEntry.class.getName())
                        .getLoadCount());
    }

    @Test
    public void unpublishedTitleChangesStayPrivateAsWellAsTheBody() {
        Long id = create("DOCUMENT", null);
        service.publish(id, publishRequest(id, false));
        TnttDocumentRequest r = new TnttDocumentRequest();
        r.title = "Tên bản soạn chưa công bố";
        r.revision = revision(id);
        service.update(id, r);
        actor(manager);
        assertEquals("Biên bản họp", service.read(id, null).get("title"));
        assertEquals("Biên bản họp", service.list(false, "").get(0).get("title"));
        assertTrue(service.list(false, "chưa công bố").isEmpty());
    }
}
