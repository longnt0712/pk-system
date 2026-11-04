package com.globits.richy.speaking;

import com.globits.richy.domain.*;
import com.globits.richy.dto.SpeakingStudentAnswerDto.*;
import com.globits.richy.service.impl.*;
import com.globits.security.domain.User;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import javax.persistence.*;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

/** Real SQL mappings, capability scopes and existing answer/history writes against isolated H2. */
public class SpeakingAnswerSharingTest {
    private static SessionFactory factory;
    private EntityManager em;private SpeakingServiceImpl speaking;private SpeakingStudentAnswerService answers;private SpeakingAnswerShareService shares;
    private User owner,student,other,actor;private SpeakingSet set,anotherSet;private SpeakingQuestion question,outside;
    private static void register(Configuration cfg,Class<?> sample,String name)throws Exception{
        File root=new File(sample.getProtectionDomain().getCodeSource().getLocation().toURI());
        for(File file:new File(root,name.replace('.','/')).listFiles())if(file.getName().endsWith(".class")&&!file.getName().contains("$")){Class<?> type=Class.forName(name+"."+file.getName().replace(".class",""));if(type.isAnnotationPresent(Entity.class))cfg.addAnnotatedClass(type);}
    }
    @BeforeClass public static void database()throws Exception{
        org.h2.jdbcx.JdbcDataSource ds=new org.h2.jdbcx.JdbcDataSource();ds.setURL("jdbc:h2:mem:speaking_shares;MODE=MSSQLServer;DB_CLOSE_DELAY=-1");try(java.sql.Connection c=ds.getConnection();java.sql.Statement s=c.createStatement()){s.execute("CREATE SCHEMA dbo");}
        Configuration cfg=new Configuration().setProperty("hibernate.default_schema","dbo").setProperty("hibernate.dialect","org.hibernate.dialect.H2Dialect").setProperty("hibernate.hbm2ddl.auto","create-drop").setProperty("hibernate.show_sql","false").setProperty("hibernate.temp.use_jdbc_metadata_defaults","false").setProperty("hibernate.hbm2ddl.halt_on_error","true");cfg.getProperties().put("hibernate.connection.datasource",ds);
        register(cfg,Topic.class,"com.globits.richy.domain");register(cfg,com.globits.core.domain.Organization.class,"com.globits.core.domain");register(cfg,User.class,"com.globits.security.domain");cfg.addAnnotatedClass(SpeakingAnswerShare.class);factory=cfg.buildSessionFactory();
        Path migrationFile=Paths.get("richy/database/speaking-answer-sharing.sql");
        if (!Files.isRegularFile(migrationFile)) migrationFile=Paths.get("../database/speaking-answer-sharing.sql");
        String sql=new String(Files.readAllBytes(migrationFile),StandardCharsets.UTF_8);assertFalse(sql.contains("THROW"));
        java.util.regex.Matcher ddl=java.util.regex.Pattern.compile("(?s)CREATE TABLE dbo\\.tbl_speaking_answer_share \\(.*?\\n\\s*\\);").matcher(sql);assertTrue(ddl.find());
        java.util.regex.Matcher migration=java.util.regex.Pattern.compile("ALTER TABLE dbo\\.tbl_speaking_answer_share ADD copy_nonce [^;]+;").matcher(sql);assertTrue(migration.find());
        try(java.sql.Connection c=ds.getConnection();java.sql.Statement s=c.createStatement()){s.execute("DROP TABLE dbo.tbl_speaking_answer_share");s.execute(ddl.group());s.execute(migration.group());}
    }
    @AfterClass public static void close(){if(factory!=null)factory.close();}
    private User user(){User value=new User();value.setUsername("share-"+UUID.randomUUID());value.setPassword("unused");value.setEmail(value.getUsername()+"@example.invalid");value.setActive(true);em.persist(value);return value;}
    private SpeakingSet set(int year){SpeakingSet value=new SpeakingSet();value.setOwnerId(owner.getId());value.setName("Speaking "+year);value.setSeasonYear(year);value.setSetNumber(1);em.persist(value);return value;}
    private SpeakingQuestion question(SpeakingSet bank,String code){SpeakingQuestion q=new SpeakingQuestion();q.setOwnerId(owner.getId());q.setPart(1);q.setTopic("Home");q.setPrompt("Question "+code);q.setContentKey(code+UUID.randomUUID());q.setSample("Shared sample stays unchanged");em.persist(q);SpeakingSetEntry e=new SpeakingSetEntry();e.setSetId(bank.getId());e.setQuestionId(q.getId());e.setEntryKey(code);e.setImportCode(code);em.persist(e);return q;}
    @Before public void setup(){em=factory.createEntityManager();em.getTransaction().begin();owner=user();student=user();other=user();actor=owner;set=set(2026);anotherSet=set(2027);question=question(set,"P1-01");outside=question(anotherSet,"P1-02");em.flush();
        speaking=mock(SpeakingServiceImpl.class);when(speaking.currentUser()).thenAnswer(c->{if(actor==null)throw new AccessDeniedException("No login");return actor;});
        when(speaking.readableSet(anyLong())).thenAnswer(c->{if(actor==null||actor==other)throw new AccessDeniedException("No access");return em.find(SpeakingSet.class,c.getArguments()[0]);});
        when(speaking.reviewableStudent(any(SpeakingSet.class),any())).thenAnswer(c->{Long id=(Long)c.getArguments()[1];if(actor==null||actor==other||actor==student&&id!=null&&!id.equals(student.getId()))throw new AccessDeniedException("Wrong student");return id==null?actor:em.find(User.class,id);});
        when(speaking.displayName(any(User.class))).thenReturn("Student's Speaking");answers=new SpeakingStudentAnswerService();ReflectionTestUtils.setField(answers,"em",em);ReflectionTestUtils.setField(answers,"speaking",speaking);
        shares=new SpeakingAnswerShareService();ReflectionTestUtils.setField(shares,"em",em);ReflectionTestUtils.setField(shares,"speaking",speaking);ReflectionTestUtils.setField(shares,"answers",answers);
    }
    @After public void cleanup(){if(em!=null){if(em.getTransaction().isActive())em.getTransaction().rollback();em.close();}}
    private Map<String,Object> link(String permission){SpeakingAnswerShareService.Request r=new SpeakingAnswerShareService.Request();r.setId=set.getId();r.studentId=student.getId();r.permission=permission;return shares.create(r);}
    private WriteRequest write(String html,long revision){WriteRequest r=new WriteRequest();r.setId=set.getId();r.studentId=student.getId();r.questionId=question.getId();r.html=html;r.revision=revision;return r;}
    private void denied(Runnable action){try{action.run();fail("Unauthorized capability accepted");}catch(AccessDeniedException expected){}}
    @Test public void tokensAreRandomHashedAndListNeverExposesTheSecret(){Map<String,Object> one=link("VIEW"),two=link("EDIT");String token=(String)one.get("token");assertTrue(token.matches("[A-Za-z0-9_-]{43}"));assertNotEquals(token,two.get("token"));SpeakingAnswerShare stored=em.find(SpeakingAnswerShare.class,one.get("id"));assertEquals(SpeakingAnswerShareService.hash(token),stored.getTokenHash());assertNotEquals(token,stored.getTokenHash());for(Map<String,Object> row:shares.list(set.getId(),student.getId())){assertFalse(row.containsKey("token"));assertFalse(row.containsKey("tokenHash"));}}
    private void copyKey(SpeakingAnswerShareService service, int value) {
        byte[] key = new byte[32];
        Arrays.fill(key, (byte) value);
        ReflectionTestUtils.invokeMethod(service, "configureCopyKey", Base64.getEncoder().encodeToString(key));
    }
    @Test public void copyRecreatesTheExactLinkAcrossInstancesAndChecksAccess() {
        Map<String,Object> old = link("VIEW");
        copyKey(shares, 1);
        Map<String,Object> created = link("EDIT");
        Long id = (Long) created.get("id");
        assertEquals(true, created.get("copyable"));
        assertNotEquals(created.get("token"), em.find(SpeakingAnswerShare.class, id).getCopyNonce());
        List<Map<String,Object>> listed = shares.list(set.getId(), student.getId());
        assertEquals(true, listed.get(0).get("copyable"));
        assertFalse(listed.get(0).containsKey("token"));
        assertEquals(false, listed.get(1).get("copyable"));
        assertEquals(false, shares.bank((String) old.get("token")).get("canEdit"));
        try { shares.copy((Long) old.get("id")); fail("Legacy token cannot be reconstructed"); }
        catch (IllegalArgumentException expected) {}

        SpeakingAnswerShareService restarted = new SpeakingAnswerShareService();
        ReflectionTestUtils.setField(restarted, "em", em);
        ReflectionTestUtils.setField(restarted, "speaking", speaking);
        copyKey(restarted, 1);
        em.clear();
        assertEquals(created.get("token"), restarted.copy(id).get("token"));
        actor = other;
        denied(() -> restarted.copy(id));
        actor = owner;
        copyKey(restarted, 2);
        try { restarted.copy(id); fail("A different key cannot return a usable URL"); }
        catch (IllegalArgumentException expected) {}
        copyKey(restarted, 1);
        shares.revoke(id);
        denied(() -> restarted.copy(id));
    }
    @Test public void anonymousBankContainsOnlyTheChosenPersonsSetAndOpensTheirSavedAnswers(){answers.save(write("My answer",0));String token=(String)link("VIEW").get("token");actor=null;reset(speaking);Map<String,Object> bank=shares.bank(token);assertEquals(student.getId(),bank.get("studentId"));assertEquals(set.getId(),bank.get("setId"));assertEquals(false,bank.get("canEdit"));List<?> rows=(List<?>)bank.get("questions");assertEquals(1,rows.size());assertEquals(true,((Map<?,?>)rows.get(0)).get("hasAnswer"));assertFalse(bank.containsKey("importPreview"));assertFalse(bank.containsKey("students"));verify(speaking,never()).currentUser();}
    @Test public void viewLinksCannotWriteAnswersOrA4EvenIfTheCallerChangesTheRequest(){String token=(String)link("VIEW").get("token");actor=null;denied(()->shares.save(token,write("Changed",0)));NotebookRequest r=notebook();denied(()->shares.saveNotebook(token,r));assertEquals(Long.valueOf(0),em.createQuery("select count(a) from SpeakingStudentAnswer a",Long.class).getSingleResult());}
    private NotebookRequest notebook(){NotebookRequest r=new NotebookRequest();r.setId=set.getId();r.studentId=student.getId();r.questionId=question.getId();r.revision=0L;r.document=SpeakingServiceImpl.map("text","A4 notes","orientation","portrait","pattern","lined","strokes",new ArrayList<Object>());return r;}
    @Test public void anonymousEditsPreserveSanitizationRevisionsHistoryAndNeverChangePassOrSamples(){String token=(String)link("EDIT").get("token");actor=null;Map<String,Object> saved=shares.save(token,write("<b>Answer</b><script>bad()</script>",0));assertEquals("<b>Answer</b>",saved.get("html"));assertEquals(1L,saved.get("revision"));try{shares.save(token,write("Stale",0));fail();}catch(SpeakingStudentAnswerService.Conflict expected){}shares.saveNotebook(token,notebook());assertEquals("A4 notes",((Map<?,?>)shares.notebook(token,question.getId(),null).get("document")).get("text"));assertEquals(Long.valueOf(0),em.createQuery("select count(p) from SpeakingPass p",Long.class).getSingleResult());assertEquals("Shared sample stays unchanged",question.getSample());actor=owner;List<?> versions=(List<?>)answers.history(set.getId(),student.getId(),question.getId()).get("versions");assertFalse(versions.isEmpty());assertEquals("Qua link chia sẻ",((Map<?,?>)versions.get(0)).get("editorName"));assertTrue(versions.size()<=5);}
    @Test public void editLinksCannotSwitchStudentSetOrQuestion(){String token=(String)link("EDIT").get("token");actor=null;WriteRequest r=write("Other student",0);r.studentId=other.getId();denied(()->shares.save(token,r));r.studentId=student.getId();r.setId=anotherSet.getId();denied(()->shares.save(token,r));r.setId=set.getId();r.questionId=outside.getId();denied(()->shares.save(token,r));denied(()->shares.answer(token,outside.getId(),null));denied(()->shares.notebook(token,outside.getId(),null));}
    @Test public void revocationStopsBothReadingAndEditingAndCannotBeUndoneByRetry(){Map<String,Object> link=link("EDIT");String token=(String)link.get("token");shares.revoke((Long)link.get("id"));actor=null;denied(()->shares.bank(token));denied(()->shares.save(token,write("Retry",0)));assertEquals(Long.valueOf(0),em.createQuery("select count(a) from SpeakingStudentAnswer a",Long.class).getSingleResult());}
    @Test public void untrustedActorsCannotCreateOrRevokeAnotherPersonsLink(){Map<String,Object> link=link("VIEW");actor=other;denied(()->link("EDIT"));denied(()->shares.revoke((Long)link.get("id")));assertFalse(em.find(SpeakingAnswerShare.class,link.get("id")).isRevoked());actor=student;SpeakingAnswerShareService.Request r=new SpeakingAnswerShareService.Request();r.setId=set.getId();r.studentId=other.getId();r.permission="EDIT";denied(()->shares.create(r));}
    @Test public void invalidTokensAndInactiveSubjectsHaveNoAccess(){String token=(String)link("VIEW").get("token");actor=null;for(String invalid:new String[]{"", "../bad",token+"x",token.substring(1),String.join("",Collections.nCopies(43,"a"))})denied(()->shares.bank(invalid));student.setActive(false);em.flush();denied(()->shares.bank(token));}
}
