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
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.*;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class SpeakingStudentAnswerTest {
    private static SessionFactory factory;
    private EntityManager em;
    private SpeakingStudentAnswerService answers;
    private SpeakingServiceImpl speaking;
    private User student,teacher,other,actor;
    private SpeakingSet set;
    private SpeakingQuestion first,second;
    private static void register(Configuration cfg,Class<?> sample,String name)throws Exception{
        File root=new File(sample.getProtectionDomain().getCodeSource().getLocation().toURI());File[] files=new File(root,name.replace('.','/')).listFiles();assertNotNull(files);
        for(File file:files)if(file.getName().endsWith(".class")&&!file.getName().contains("$")){Class<?> type=Class.forName(name+"."+file.getName().replace(".class",""));if(type.isAnnotationPresent(Entity.class))cfg.addAnnotatedClass(type);}
    }
    @BeforeClass public static void database()throws Exception{
        org.h2.jdbcx.JdbcDataSource ds=new org.h2.jdbcx.JdbcDataSource();ds.setURL("jdbc:h2:mem:speaking_answers;MODE=MSSQLServer;DB_CLOSE_DELAY=-1");try(java.sql.Connection c=ds.getConnection();java.sql.Statement s=c.createStatement()){s.execute("CREATE SCHEMA dbo");}
        Configuration cfg=new Configuration().setProperty("hibernate.default_schema","dbo").setProperty("hibernate.dialect","org.hibernate.dialect.H2Dialect").setProperty("hibernate.hbm2ddl.auto","create-drop").setProperty("hibernate.show_sql","false").setProperty("hibernate.temp.use_jdbc_metadata_defaults","false").setProperty("hibernate.hbm2ddl.halt_on_error","true");cfg.getProperties().put("hibernate.connection.datasource",ds);
        register(cfg,Topic.class,"com.globits.richy.domain");register(cfg,com.globits.core.domain.Organization.class,"com.globits.core.domain");register(cfg,User.class,"com.globits.security.domain");cfg.addAnnotatedClass(SpeakingStudentAnswer.class);factory=cfg.buildSessionFactory();
        String sql=new String(Files.readAllBytes(Paths.get("richy/database/speaking-student-answers.sql")),StandardCharsets.UTF_8);java.util.regex.Matcher ddl=java.util.regex.Pattern.compile("(?s)CREATE TABLE dbo\\.tbl_speaking_student_answer \\(.*?\\n    \\);").matcher(sql);assertTrue(ddl.find());
        String historySql=new String(Files.readAllBytes(Paths.get("richy/database/speaking-answer-history.sql")),StandardCharsets.UTF_8);java.util.regex.Matcher historyDdl=java.util.regex.Pattern.compile("(?s)CREATE TABLE dbo\\.tbl_speaking_answer_version \\(.*?\\n    \\);").matcher(historySql);assertTrue(historyDdl.find());
        try(java.sql.Connection c=ds.getConnection();java.sql.Statement s=c.createStatement()){s.execute("DROP TABLE dbo.tbl_speaking_answer_version");s.execute("DROP TABLE dbo.tbl_speaking_student_answer");s.execute(ddl.group());s.execute(historyDdl.group());}
    }
    @AfterClass public static void close(){if(factory!=null)factory.close();}
    private User user(String name){User u=new User();u.setUsername(name+UUID.randomUUID());u.setPassword("unused");u.setEmail(u.getUsername()+"@example.invalid");em.persist(u);return u;}
    private SpeakingQuestion question(String key){SpeakingQuestion q=new SpeakingQuestion();q.setOwnerId(teacher.getId());q.setPart(1);q.setTopic("Home");q.setPrompt("Question "+key);q.setSample("Shared sample unchanged");q.setContentKey(key+UUID.randomUUID());em.persist(q);SpeakingSetEntry e=new SpeakingSetEntry();e.setSetId(set.getId());e.setQuestionId(q.getId());e.setEntryKey(key);e.setImportCode(key);em.persist(e);return q;}
    @Before public void fixture(){
        em=factory.createEntityManager();em.getTransaction().begin();student=user("student");teacher=user("teacher");other=user("other");actor=student;
        set=new SpeakingSet();set.setOwnerId(teacher.getId());set.setSeasonYear(2026);set.setSetNumber(1);set.setName("Common bank");set.setClassIdsJson("[]");set.setStudentIdsJson("[]");em.persist(set);first=question("HOME_1");second=question("HOME_2");em.flush();
        speaking=mock(SpeakingServiceImpl.class);when(speaking.readableSet(anyLong())).thenAnswer(call->{if(!set.getId().equals(call.getArguments()[0]))throw new AccessDeniedException("Wrong set");return set;});when(speaking.currentUser()).thenAnswer(call->actor);
        when(speaking.requireAdmin()).thenAnswer(call->{if(actor.getId().equals(teacher.getId()))return actor;throw new AccessDeniedException("Admin only");});
        when(speaking.reviewableStudent(eq(set),any())).thenAnswer(call->{Long id=(Long)call.getArguments()[1];if(id==null||id.equals(actor.getId()))return actor;if(actor.getId().equals(teacher.getId())&&id.equals(student.getId()))return student;throw new AccessDeniedException("Not your student");});
        answers=new SpeakingStudentAnswerService();ReflectionTestUtils.setField(answers,"em",em);ReflectionTestUtils.setField(answers,"speaking",speaking);
    }
    @After public void cleanup(){if(em!=null){if(em.getTransaction().isActive())em.getTransaction().rollback();em.close();}}
    private WriteRequest request(Long question,String html,long revision){WriteRequest r=new WriteRequest();r.setId=set.getId();r.studentId=student.getId();r.questionId=question;r.html=html;r.revision=revision;return r;}
    @SuppressWarnings("unchecked") private List<Map<String,Object>> rows(Map<String,Object> data){return (List<Map<String,Object>>)data.get("answers");}
    @SuppressWarnings("unchecked") private List<Map<String,Object>> previewRows(Map<String,Object> data){return (List<Map<String,Object>>)data.get("rows");}
    private long revision(Map<String,Object> data){return ((Number)data.get("revision")).longValue();}
    @SuppressWarnings("unchecked") private List<Map<String,Object>> history(Long question){return(List<Map<String,Object>>)answers.history(set.getId(),student.getId(),question).get("versions");}
    private void minute(long minute){ReflectionTestUtils.setField(answers,"historyClock",java.time.Clock.fixed(java.time.Instant.ofEpochMilli(1700000000000L+minute*60000),java.time.ZoneOffset.UTC));}
    private Map<String,Object> paper(String text){return SpeakingServiceImpl.map("text",text,"orientation","landscape","pattern","grid","strokes",Collections.singletonList(SpeakingServiceImpl.map("id","stroke-1","tool","pen","color","#315bbe","width",4,"points",Arrays.asList(Arrays.asList(10,20,0.5),Arrays.asList(30,40,0.8)))));}
    private NotebookRequest notebookRequest(Long question,String text,long revision){NotebookRequest r=new NotebookRequest();r.setId=set.getId();r.studentId=student.getId();r.questionId=question;r.document=paper(text);r.revision=revision;return r;}
    private RestoreRequest restoreRequest(Long question,Map<String,Object> target,long revision){RestoreRequest r=new RestoreRequest();r.setId=set.getId();r.studentId=student.getId();r.questionId=question;r.versionId=((Number)target.get("id")).longValue();r.versionRevision=((Number)target.get("revision")).longValue();r.revision=revision;return r;}
    private byte[] workbook(String one,String two)throws Exception{
        byte[] template=answers.template(set.getId(),student.getId());try(XSSFWorkbook b=new XSSFWorkbook(new ByteArrayInputStream(template));ByteArrayOutputStream out=new ByteArrayOutputStream()){b.getSheet("CAU_TRA_LOI").getRow(1).getCell(5).setCellValue(one);if(two!=null)b.getSheet("CAU_TRA_LOI").getRow(2).getCell(5).setCellValue(two);b.write(out);return out.toByteArray();}
    }
    @Test public void htmlAllowlistPreservesFormattingAndAnchorsButDropsExecutableMarkup(){
        String html=SpeakingStudentAnswerService.sanitizeHtml("<p onclick='evil()'><b>Bold</b><u>Line</u><span class='evil ielts-annotation has-note is-highlighted' style='color:red' data-note-id='note-1' data-annotation-group='group-1' onmouseover='evil()'>Marked</span><img src=x onerror=evil()><script>evil()</script><a href='javascript:evil()'>Link text</a></p>");
        assertTrue(html,html.contains("<b>Bold</b><u>Line</u>"));assertTrue(html,html.contains("data-note-id=\"note-1\""));assertTrue(html,html.contains("ielts-annotation has-note is-highlighted"));assertFalse(html,html.contains("onclick"));assertFalse(html,html.contains("<script"));assertFalse(html,html.contains("evil()"));assertFalse(html,html.contains("style="));assertFalse(html,html.contains("href="));assertTrue(html,html.contains("Link text"));
    }
    @Test public void personalAnswersAndNotesSynchronizeAcrossTeacherAndStudentWithoutChangingSample(){
        Map<String,Object> empty=rows(answers.list(set.getId(),null,first.getId())).get(0);assertEquals(0L,revision(empty));assertEquals(student.getId(),empty.get("studentId"));
        WriteRequest input=request(first.getId(),"<strong>Hello</strong> <span class='ielts-annotation has-note' data-note-id='n1'>world</span>",0);input.notes=Collections.singletonList(new Note("n1","A useful note"));Map<String,Object> saved=answers.save(input);assertEquals(1L,revision(saved));assertEquals(1,((List<?>)saved.get("notes")).size());assertEquals(revision(saved),revision(answers.save(input)));
        actor=teacher;Map<String,Object> read=rows(answers.list(set.getId(),student.getId(),first.getId())).get(0);WriteRequest edit=request(first.getId(),"<u>Teacher correction</u>",revision(read));Map<String,Object> updated=answers.save(edit);assertEquals(2L,revision(updated));assertEquals(teacher.getId(),updated.get("editorId"));
        actor=student;assertEquals("<u>Teacher correction</u>",rows(answers.list(set.getId(),null,first.getId())).get(0).get("html"));assertEquals("Shared sample unchanged",em.find(SpeakingQuestion.class,first.getId()).getSample());assertEquals(0L,(long)em.createQuery("select count(p) from SpeakingPass p",Long.class).getSingleResult());
    }
    @Test public void staleDifferentWritesAreRejectedButLostAcknowledgementsCanRetry(){
        WriteRequest initial=request(first.getId(),"First",0);answers.save(initial);WriteRequest newer=request(first.getId(),"New correction",1);Map<String,Object> saved=answers.save(newer);assertEquals(2L,revision(saved));assertEquals(2L,revision(answers.save(newer)));
        try{answers.save(request(first.getId(),"Stale replacement",1));fail();}catch(SpeakingStudentAnswerService.Conflict expected){}assertEquals("New correction",rows(answers.list(set.getId(),null,first.getId())).get(0).get("html"));
    }
    @Test public void authorizationAndMembershipAreCheckedForEachReadWriteAndImport()throws Exception{
        actor=other;try{answers.list(set.getId(),student.getId(),first.getId());fail();}catch(AccessDeniedException expected){}try{answers.save(request(first.getId(),"forged",0));fail();}catch(AccessDeniedException expected){}
        actor=student;try{answers.save(request(999999L,"outside",0));fail();}catch(AccessDeniedException expected){}WriteRequest missing=request(first.getId(),"answer",0);missing.revision=null;try{answers.save(missing);fail();}catch(IllegalArgumentException expected){}
        WriteRequest orphan=request(first.getId(),"<span data-note-id='n1'>text</span>",0);try{answers.save(orphan);fail();}catch(IllegalArgumentException expected){}orphan.notes=Collections.singletonList(new Note("n2","Wrong anchor"));try{answers.save(orphan);fail();}catch(IllegalArgumentException expected){}
        assertEquals(0L,(long)em.createQuery("select count(a) from SpeakingStudentAnswer a where a.studentId=:student",Long.class).setParameter("student",student.getId()).getSingleResult());
    }
    @Test public void templateMetadataPreventsWrongStudentOrSetAndBlankCellsNeverClearExistingAnswers()throws Exception{
        actor=teacher;
        answers.save(request(first.getId(),"Keep this",0));byte[] template=answers.template(set.getId(),student.getId());assertTrue(previewRows(answers.preview(set.getId(),student.getId(),template)).isEmpty());
        try(XSSFWorkbook b=new XSSFWorkbook(new ByteArrayInputStream(template));ByteArrayOutputStream out=new ByteArrayOutputStream()){b.getSheet("THONG_TIN").getRow(2).getCell(1).setCellValue(String.valueOf(other.getId()));b.write(out);try{answers.preview(set.getId(),student.getId(),out.toByteArray());fail();}catch(IllegalArgumentException expected){assertTrue(expected.getMessage().contains("học sinh"));}}
        assertEquals("Keep this",rows(answers.list(set.getId(),student.getId(),first.getId())).get(0).get("html"));
    }
    @Test public void excelRichTextAndFormulaValidationArePreviewedBeforeAnyWrite()throws Exception{
        actor=teacher;
        byte[] bytes=workbook("Bold and underline",null);try(XSSFWorkbook b=new XSSFWorkbook(new ByteArrayInputStream(bytes));ByteArrayOutputStream out=new ByteArrayOutputStream()){
            XSSFRichTextString rich=new XSSFRichTextString("Bold and underline");XSSFFont bold=b.createFont();bold.setBold(true);rich.applyFont(0,4,bold);XSSFFont underline=b.createFont();underline.setUnderline(Font.U_SINGLE);rich.applyFont(9,18,underline);b.getSheet("CAU_TRA_LOI").getRow(1).getCell(5).setCellValue(rich);b.getSheet("CAU_TRA_LOI").getRow(2).getCell(5).setCellFormula("1+1");b.write(out);bytes=out.toByteArray();}
        List<Map<String,Object>> rows=previewRows(answers.preview(set.getId(),student.getId(),bytes));assertEquals(2,rows.size());assertEquals("NEW",rows.get(0).get("status"));assertTrue(String.valueOf(rows.get(0).get("html")).contains("<strong>Bold</strong>"));assertTrue(String.valueOf(rows.get(0).get("html")).contains("<u>underline</u>"));assertEquals("INVALID",rows.get(1).get("status"));assertEquals(0L,(long)em.createQuery("select count(a) from SpeakingStudentAnswer a where a.studentId=:student",Long.class).setParameter("student",student.getId()).getSingleResult());
    }
    @Test public void importChecksAllRevisionsBeforeWritingAndKeepsQuestionAndStudentIdentity(){
        actor=teacher;
        answers.save(request(second.getId(),"Someone else already saved",0));ImportRequest stale=new ImportRequest();stale.setId=set.getId();stale.studentId=student.getId();stale.rows=Arrays.asList(request(first.getId(),"Do not partly save",0),request(second.getId(),"Stale",0));
        try{answers.confirm(stale);fail();}catch(SpeakingStudentAnswerService.Conflict expected){}assertEquals(0L,revision(rows(answers.list(set.getId(),student.getId(),first.getId())).get(0)));
        stale.rows=Arrays.asList(request(first.getId(),"A new answer",0),request(second.getId(),"Updated",1));Map<String,Object> ack=answers.confirm(stale);assertEquals(2,ack.get("saved"));assertEquals(student.getId(),ack.get("studentId"));assertEquals(2,rows(ack).size());assertEquals(2,answers.confirm(stale).get("saved"));assertEquals(2L,(long)em.createQuery("select count(a) from SpeakingStudentAnswer a where a.studentId=:student",Long.class).setParameter("student",student.getId()).getSingleResult());
    }
    @Test public void duplicateImportAndMissingMetadataCannotSilentlyApplyResponses()throws Exception{
        actor=teacher;
        byte[] bytes=workbook("One","Two");try(XSSFWorkbook b=new XSSFWorkbook(new ByteArrayInputStream(bytes));ByteArrayOutputStream out=new ByteArrayOutputStream()){b.getSheet("CAU_TRA_LOI").getRow(2).getCell(0).setCellValue(String.valueOf(first.getId()));b.getSheet("CAU_TRA_LOI").getRow(2).getCell(1).setCellValue("HOME_1");b.write(out);bytes=out.toByteArray();}
        List<Map<String,Object>> preview=previewRows(answers.preview(set.getId(),student.getId(),bytes));assertEquals("INVALID",preview.get(0).get("status"));assertEquals("INVALID",preview.get(1).get("status"));ImportRequest duplicate=new ImportRequest();duplicate.setId=set.getId();duplicate.studentId=student.getId();duplicate.rows=Arrays.asList(request(first.getId(),"one",0),request(first.getId(),"two",0));try{answers.confirm(duplicate);fail();}catch(IllegalArgumentException expected){}
        assertEquals(0L,(long)em.createQuery("select count(a) from SpeakingStudentAnswer a where a.studentId=:student",Long.class).setParameter("student",student.getId()).getSingleResult());
    }
    @Test public void checkpointsUseFixedTenMinuteWindowsAndNoOpRetriesDoNotCreateVersions(){
        minute(0);answers.save(request(first.getId(),"First",0));long start=((Number)history(first.getId()).get(0).get("startedAt")).longValue();
        minute(9);answers.save(request(first.getId(),"At nine",1));assertEquals(1,history(first.getId()).size());assertEquals(start,history(first.getId()).get(0).get("startedAt"));assertEquals(2L,history(first.getId()).get(0).get("revision"));
        minute(11);WriteRequest latest=request(first.getId(),"After fixed window",2);Map<String,Object> saved=answers.save(latest);assertEquals(3L,revision(saved));assertEquals(2,history(first.getId()).size());
        answers.save(latest);answers.save(request(first.getId(),"After fixed window",3));assertEquals(3L,revision(rows(answers.list(set.getId(),null,first.getId())).get(0)));assertEquals(2,history(first.getId()).size());
        assertFalse(history(first.getId()).get(0).containsKey("html"));assertFalse(history(first.getId()).get(0).containsKey("notebook"));
        assertEquals(10,answers.history(set.getId(),null,first.getId()).get("checkpointMinutes"));assertEquals(5,answers.history(set.getId(),null,first.getId()).get("retainedLimit"));assertEquals(14,answers.history(set.getId(),null,first.getId()).get("retentionDays"));
    }
    @Test public void preexistingResponsesAndEditorChangesArePreservedAndImportsStartBoundaries(){
        SpeakingStudentAnswer legacy=new SpeakingStudentAnswer();legacy.setStudentId(student.getId());legacy.setQuestionId(first.getId());legacy.setHtml("Legacy original");legacy.setNotesJson("[]");legacy.setEditorId(student.getId());em.persist(legacy);em.flush();minute(0);
        answers.save(request(first.getId(),"Student edit",1));assertEquals(2,history(first.getId()).size());assertEquals("BASELINE",history(first.getId()).get(1).get("source"));
        actor=teacher;answers.save(request(first.getId(),"Teacher edit",2));assertEquals(3,history(first.getId()).size());
        ImportRequest imported=new ImportRequest();imported.setId=set.getId();imported.studentId=student.getId();imported.rows=Collections.singletonList(request(first.getId(),"Imported replacement",3));answers.confirm(imported);assertEquals(4,history(first.getId()).size());assertEquals("IMPORT",history(first.getId()).get(0).get("source"));
        answers.confirm(imported);assertEquals(4,history(first.getId()).size());answers.save(request(first.getId(),"After import",4));assertEquals(5,history(first.getId()).size());assertEquals("IMPORT",history(first.getId()).get(1).get("source"));
    }
    @Test public void sharedNotebookAndInlineEditsCoalesceTogetherAndNeverClearEachOther(){
        first.setPart(2);em.flush();
        minute(0);WriteRequest typed=request(first.getId(),"<b>Hello</b> <span class='ielts-annotation has-note is-highlighted' data-note-id='n1'>world</span>",0);typed.notes=Collections.singletonList(new Note("n1","Teacher note"));answers.save(typed);
        NotebookRequest paper=notebookRequest(first.getId(),"A4 notes",0);answers.saveNotebook(paper);assertEquals(1,history(first.getId()).size());assertEquals("NOTEBOOK",history(first.getId()).get(0).get("source"));
        Map<String,Object> response=rows(answers.list(set.getId(),null,first.getId())).get(0);assertTrue(String.valueOf(response.get("html")).contains("<b>Hello</b>"));assertEquals(1,((List<?>)response.get("notes")).size());assertEquals(2L,revision(response));
        answers.saveNotebook(paper);assertEquals(2L,revision(rows(answers.list(set.getId(),null,first.getId())).get(0)));assertEquals(1,history(first.getId()).size());
        WriteRequest updated=request(first.getId(),"<u>Typed again</u>",2);answers.save(updated);assertEquals(1L,answers.notebook(set.getId(),null,first.getId(),null).get("revision"));assertEquals(paper.document,answers.notebook(set.getId(),null,first.getId(),null).get("document"));assertEquals(1,history(first.getId()).size());
        actor=teacher;answers.saveNotebook(notebookRequest(first.getId(),"Teacher pen",1));assertEquals(2,history(first.getId()).size());assertEquals(student.getId(),history(first.getId()).get(1).get("editorId"));
    }
    @Test public void restoreRecoversFormattingNotesHighlightAndDrawingAsANewVersion(){
        first.setPart(2);em.flush();
        minute(0);WriteRequest typed=request(first.getId(),"<u>Original</u> <span class='ielts-annotation has-note is-highlighted' data-note-id='n1'>word</span>",0);typed.notes=Collections.singletonList(new Note("n1","Original note"));answers.save(typed);answers.saveNotebook(notebookRequest(first.getId(),"Original paper",0));Map<String,Object> original=history(first.getId()).get(0);
        minute(11);answers.save(request(first.getId(),"Changed answer",2));answers.saveNotebook(notebookRequest(first.getId(),"Changed paper",1));long current=revision(rows(answers.list(set.getId(),null,first.getId())).get(0));RestoreRequest restore=restoreRequest(first.getId(),original,current);
        Map<String,Object> restored=answers.restore(restore);assertEquals(current+1,revision(restored));assertEquals(original.get("id"),restored.get("restoredVersionId"));assertTrue(String.valueOf(restored.get("html")).contains("has-note is-highlighted"));assertEquals(1,((List<?>)restored.get("notes")).size());assertEquals(paper("Original paper"),answers.notebook(set.getId(),null,first.getId(),null).get("document"));assertEquals(3L,answers.notebook(set.getId(),null,first.getId(),null).get("revision"));assertEquals("RESTORE",history(first.getId()).get(0).get("source"));
        answers.restore(restore);assertEquals(3,history(first.getId()).size());assertEquals(current+1,revision(rows(answers.list(set.getId(),null,first.getId())).get(0)));assertEquals("Shared sample unchanged",first.getSample());
    }
    @Test public void retentionKeepsFiveAndRestoringTheOldestSupportsLostAckAfterSourcePruning(){
        long revision=0;for(int i=0;i<25;i++){minute(i*11);revision=revision(answers.save(request(first.getId(),"State "+i,revision)));}List<Map<String,Object>> versions=history(first.getId());assertEquals(5,versions.size());Map<String,Object> oldest=versions.get(4);RestoreRequest restore=restoreRequest(first.getId(),oldest,revision);
        Map<String,Object> saved=answers.restore(restore);assertEquals("State 20",saved.get("html"));assertEquals(5,history(first.getId()).size());assertEquals(revision+1,revision(saved));
        try{answers.historyVersion(set.getId(),student.getId(),first.getId(),restore.versionId);fail("Pruned checkpoint still exposed");}catch(AccessDeniedException expected){}
        Map<String,Object> retried=answers.restore(restore);assertEquals(revision(saved),revision(retried));assertEquals(5,history(first.getId()).size());
    }
    @Test public void expiredCheckpointsDisappearAtFourteenDaysButTheCurrentAnswerAndPaperSurviveCleanup(){
        first.setPart(2);em.flush();
        minute(0);answers.save(request(first.getId(),"Current answer survives",0));answers.saveNotebook(notebookRequest(first.getId(),"Current paper survives",0));Map<String,Object> old=history(first.getId()).get(0);Long id=((Number)old.get("id")).longValue();
        SpeakingAnswerHistoryCleanup cleanup=new SpeakingAnswerHistoryCleanup();ReflectionTestUtils.setField(cleanup,"em",em);
        minute(14L*24*60);ReflectionTestUtils.setField(cleanup,"historyClock",java.time.Clock.fixed(java.time.Instant.ofEpochMilli(1700000000000L+14L*24*60*60000),java.time.ZoneOffset.UTC));
        assertEquals(1,history(first.getId()).size());assertNotNull(answers.historyVersion(set.getId(),student.getId(),first.getId(),id));assertEquals(0,cleanup.purgeExpired());
        minute(14L*24*60+1);assertTrue(history(first.getId()).isEmpty());try{answers.historyVersion(set.getId(),student.getId(),first.getId(),id);fail("Expired detail exposed");}catch(AccessDeniedException expected){}
        try{answers.restore(restoreRequest(first.getId(),old,2));fail("Expired checkpoint restored");}catch(AccessDeniedException expected){}
        ReflectionTestUtils.setField(cleanup,"historyClock",java.time.Clock.fixed(java.time.Instant.ofEpochMilli(1700000000000L+(14L*24*60+1)*60000),java.time.ZoneOffset.UTC));assertEquals(1,cleanup.purgeExpired());
        assertEquals("Current answer survives",rows(answers.list(set.getId(),null,first.getId())).get(0).get("html"));assertEquals(paper("Current paper survives"),answers.notebook(set.getId(),null,first.getId(),null).get("document"));assertEquals("Shared sample unchanged",first.getSample());assertEquals(0L,(long)em.createQuery("select count(p) from SpeakingPass p",Long.class).getSingleResult());
    }
    @Test public void editingAfterExpiryPrunesOnlyHistoryAndCapturesTheExistingAnswerAsANewBaseline(){
        minute(0);answers.save(request(first.getId(),"Old but current",0));minute(14L*24*60+1);answers.save(request(first.getId(),"New edit",1));List<Map<String,Object>> snapshots=history(first.getId());assertEquals(2,snapshots.size());assertEquals("EDIT",snapshots.get(0).get("source"));assertEquals("BASELINE",snapshots.get(1).get("source"));
        Long baselineId=((Number)snapshots.get(1).get("id")).longValue();@SuppressWarnings("unchecked") Map<String,Object> baseline=(Map<String,Object>)answers.historyVersion(set.getId(),null,first.getId(),baselineId).get("version");assertEquals("Old but current",baseline.get("html"));
        assertEquals(2L,(long)em.createQuery("select count(v) from SpeakingStudentAnswerVersion v where v.answerId in (select a.id from SpeakingStudentAnswer a where a.studentId=:student)",Long.class).setParameter("student",student.getId()).getSingleResult());
    }
    @Test public void historyCleanupIsScheduledAndTransactional()throws Exception{
        java.lang.reflect.Method method=SpeakingAnswerHistoryCleanup.class.getMethod("purgeExpired");org.springframework.scheduling.annotation.Scheduled schedule=method.getAnnotation(org.springframework.scheduling.annotation.Scheduled.class);assertNotNull(schedule);assertEquals(3600000L,schedule.fixedDelay());assertNotNull(method.getAnnotation(org.springframework.transaction.annotation.Transactional.class));
        assertNotNull(com.globits.richy.config.SpeakingAnswerHistorySchedulingConfiguration.class.getAnnotation(org.springframework.scheduling.annotation.EnableScheduling.class));
    }
    @Test public void historyAndPaperEnforceStudentQuestionAndSnapshotOwnership(){
        minute(0);answers.save(request(first.getId(),"Private answer",0));Map<String,Object> version=history(first.getId()).get(0);Long id=((Number)version.get("id")).longValue();
        try{answers.historyVersion(set.getId(),student.getId(),second.getId(),id);fail();}catch(AccessDeniedException expected){}
        try{answers.history(set.getId(),student.getId(),999999L);fail();}catch(AccessDeniedException expected){}
        actor=other;try{answers.history(set.getId(),student.getId(),first.getId());fail();}catch(AccessDeniedException expected){}try{answers.sync(set.getId(),student.getId(),first.getId(),0L);fail();}catch(AccessDeniedException expected){}try{answers.notebook(set.getId(),student.getId(),first.getId(),null);fail();}catch(AccessDeniedException expected){}try{answers.saveNotebook(notebookRequest(first.getId(),"Forged",0));fail();}catch(AccessDeniedException expected){}try{answers.restore(restoreRequest(first.getId(),version,1));fail();}catch(AccessDeniedException expected){}
    }
    @Test public void staleRestoreOrChangedPreviewCannotOverwriteAnotherEditorsNewerContent(){
        minute(0);answers.save(request(first.getId(),"Original",0));Map<String,Object> selected=history(first.getId()).get(0);RestoreRequest stalePreview=restoreRequest(first.getId(),selected,1);
        answers.save(request(first.getId(),"Same checkpoint changed",1));try{answers.restore(stalePreview);fail();}catch(SpeakingStudentAnswerService.Conflict expected){}
        Map<String,Object> latest=history(first.getId()).get(0);minute(11);answers.save(request(first.getId(),"Later checkpoint",2));RestoreRequest staleCurrent=restoreRequest(first.getId(),latest,2);try{answers.restore(staleCurrent);fail();}catch(SpeakingStudentAnswerService.Conflict expected){}
        assertEquals("Later checkpoint",rows(answers.list(set.getId(),null,first.getId())).get(0).get("html"));
    }
    @Test public void incrementalSyncOnlyReturnsBodiesForChangedRevisionsAndPreservesNotebookConflicts(){
        first.setPart(2);em.flush();
        Map<String,Object> empty=answers.sync(set.getId(),null,first.getId(),0L);assertEquals(false,empty.get("changed"));assertFalse(empty.containsKey("answer"));
        answers.save(request(first.getId(),"Typed",0));Map<String,Object> changed=answers.sync(set.getId(),null,first.getId(),0L);assertEquals(true,changed.get("changed"));assertEquals(1L,changed.get("revision"));assertTrue(changed.containsKey("answer"));assertFalse(answers.sync(set.getId(),null,first.getId(),1L).containsKey("answer"));
        assertFalse(answers.notebook(set.getId(),null,first.getId(),0L).containsKey("document"));NotebookRequest saved=notebookRequest(first.getId(),"First paper",0);answers.saveNotebook(saved);assertEquals(true,answers.notebook(set.getId(),null,first.getId(),0L).get("changed"));assertFalse(answers.notebook(set.getId(),null,first.getId(),1L).containsKey("document"));
        try{answers.saveNotebook(notebookRequest(first.getId(),"Stale paper",0));fail();}catch(SpeakingStudentAnswerService.Conflict expected){}assertEquals(paper("First paper"),answers.notebook(set.getId(),null,first.getId(),null).get("document"));
        ImportRequest imported=new ImportRequest();actor=teacher;imported.setId=set.getId();imported.studentId=student.getId();imported.rows=Collections.singletonList(request(first.getId(),"Import preserves paper",2));answers.confirm(imported);assertEquals(paper("First paper"),answers.notebook(set.getId(),student.getId(),first.getId(),null).get("document"));
    }
    @Test public void notebookValidationRejectsBadPaperCoordinatesAndOversizedTextWithoutSaving(){
        first.setPart(2);em.flush();
        for(Map<String,Object> bad:Arrays.asList(SpeakingServiceImpl.map("text","Bad","orientation","round","pattern","grid","strokes",Collections.emptyList()),SpeakingServiceImpl.map("text",new String(new char[500001]),"orientation","portrait","pattern","grid","strokes",Collections.emptyList()),SpeakingServiceImpl.map("text","Bad","orientation","portrait","pattern","grid","strokes",Collections.singletonList(SpeakingServiceImpl.map("id","bad","tool","pen","color","#123456","width",4,"points",Collections.singletonList(Arrays.asList(1,2,1.5))))))){NotebookRequest request=notebookRequest(first.getId(),"",0);request.document=bad;try{answers.saveNotebook(request);fail();}catch(IllegalArgumentException expected){}}
        assertEquals(0L,answers.notebook(set.getId(),null,first.getId(),null).get("revision"));assertTrue(history(first.getId()).isEmpty());
    }
    @Test public void a4NotebookAndInlineNotesWorkForEverySpeakingPartAndRemainQuestionScoped(){
        second.setPart(3);SpeakingQuestion partTwo=question("NOTEBOOK_PART_2");partTwo.setPart(2);em.flush();
        for(SpeakingQuestion question:Arrays.asList(first,partTwo,second)){
            String text="Paper for Part "+question.getPart();assertEquals(0L,answers.notebook(set.getId(),null,question.getId(),null).get("revision"));assertEquals(1L,answers.saveNotebook(notebookRequest(question.getId(),text,0)).get("revision"));
            WriteRequest inline=request(question.getId(),"<span class='ielts-annotation has-note is-highlighted' data-note-id='n1'>Part "+question.getPart()+" text</span>",1);inline.notes=Collections.singletonList(new Note("n1","Inline note remains available"));assertEquals(2L,revision(answers.save(inline)));assertEquals(paper(text),answers.notebook(set.getId(),null,question.getId(),null).get("document"));
        }
        assertEquals(paper("Paper for Part 1"),answers.notebook(set.getId(),null,first.getId(),null).get("document"));assertEquals(paper("Paper for Part 3"),answers.notebook(set.getId(),null,second.getId(),null).get("document"));
    }
    @Test public void concurrentFirstSavesCreateOneRowAndRejectTheDifferentStaleResponse()throws Exception{
        final Long setId=set.getId(),studentId=student.getId(),teacherId=teacher.getId(),questionId=first.getId();em.getTransaction().commit();
        java.util.concurrent.CountDownLatch ready=new java.util.concurrent.CountDownLatch(2),go=new java.util.concurrent.CountDownLatch(1);java.util.concurrent.ExecutorService pool=java.util.concurrent.Executors.newFixedThreadPool(2);List<java.util.concurrent.Future<String>> futures=new ArrayList<java.util.concurrent.Future<String>>();
        try{
            for(int i=0;i<2;i++){final int worker=i;futures.add(pool.submit(()->{
                EntityManager local=factory.createEntityManager();try{local.getTransaction().begin();User user=local.find(User.class,worker==0?studentId:teacherId);SpeakingSet bank=local.find(SpeakingSet.class,setId);
                    SpeakingServiceImpl permissions=mock(SpeakingServiceImpl.class);when(permissions.currentUser()).thenReturn(user);when(permissions.readableSet(setId)).thenReturn(bank);when(permissions.reviewableStudent(bank,studentId)).thenReturn(local.find(User.class,studentId));SpeakingStudentAnswerService endpoint=new SpeakingStudentAnswerService();ReflectionTestUtils.setField(endpoint,"em",local);ReflectionTestUtils.setField(endpoint,"speaking",permissions);
                    WriteRequest input=new WriteRequest();input.setId=setId;input.studentId=studentId;input.questionId=questionId;input.html="Different answer "+worker;input.revision=0L;ready.countDown();assertTrue(go.await(10,java.util.concurrent.TimeUnit.SECONDS));
                    try{endpoint.save(input);local.getTransaction().commit();return "SAVED";}catch(SpeakingStudentAnswerService.Conflict expected){local.getTransaction().rollback();return "CONFLICT";}
                }finally{if(local.getTransaction().isActive())local.getTransaction().rollback();local.close();}
            }));}
            assertTrue(ready.await(10,java.util.concurrent.TimeUnit.SECONDS));go.countDown();List<String> status=Arrays.asList(futures.get(0).get(20,java.util.concurrent.TimeUnit.SECONDS),futures.get(1).get(20,java.util.concurrent.TimeUnit.SECONDS));assertTrue(status.contains("SAVED"));assertTrue(status.contains("CONFLICT"));em.clear();List<SpeakingStudentAnswer> result=em.createQuery("select a from SpeakingStudentAnswer a where a.studentId=:student and a.questionId=:question",SpeakingStudentAnswer.class).setParameter("student",studentId).setParameter("question",questionId).getResultList();assertEquals(1,result.size());assertEquals(Long.valueOf(0),result.get(0).getRevision());
        }finally{go.countDown();pool.shutdownNow();}
    }
}
