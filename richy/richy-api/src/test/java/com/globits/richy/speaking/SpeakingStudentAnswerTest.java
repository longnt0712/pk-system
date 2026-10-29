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
        String sql=new String(Files.readAllBytes(Paths.get("richy/database/speaking-student-answers.sql")),StandardCharsets.UTF_8);java.util.regex.Matcher ddl=java.util.regex.Pattern.compile("(?s)CREATE TABLE dbo\\.tbl_speaking_student_answer \\(.*?\\n    \\);").matcher(sql);assertTrue(ddl.find());try(java.sql.Connection c=ds.getConnection();java.sql.Statement s=c.createStatement()){s.execute("DROP TABLE dbo.tbl_speaking_student_answer");s.execute(ddl.group());}
    }
    @AfterClass public static void close(){if(factory!=null)factory.close();}
    private User user(String name){User u=new User();u.setUsername(name+UUID.randomUUID());u.setPassword("unused");u.setEmail(u.getUsername()+"@example.invalid");em.persist(u);return u;}
    private SpeakingQuestion question(String key){SpeakingQuestion q=new SpeakingQuestion();q.setOwnerId(teacher.getId());q.setPart(1);q.setTopic("Home");q.setPrompt("Question "+key);q.setSample("Shared sample unchanged");q.setContentKey(key+UUID.randomUUID());em.persist(q);SpeakingSetEntry e=new SpeakingSetEntry();e.setSetId(set.getId());e.setQuestionId(q.getId());e.setEntryKey(key);e.setImportCode(key);em.persist(e);return q;}
    @Before public void fixture(){
        em=factory.createEntityManager();em.getTransaction().begin();student=user("student");teacher=user("teacher");other=user("other");actor=student;
        set=new SpeakingSet();set.setOwnerId(teacher.getId());set.setSeasonYear(2026);set.setSetNumber(1);set.setName("Common bank");set.setClassIdsJson("[]");set.setStudentIdsJson("[]");em.persist(set);first=question("HOME_1");second=question("HOME_2");em.flush();
        speaking=mock(SpeakingServiceImpl.class);when(speaking.readableSet(anyLong())).thenAnswer(call->{if(!set.getId().equals(call.getArguments()[0]))throw new AccessDeniedException("Wrong set");return set;});when(speaking.currentUser()).thenAnswer(call->actor);
        when(speaking.reviewableStudent(eq(set),any())).thenAnswer(call->{Long id=(Long)call.getArguments()[1];if(id==null||id.equals(actor.getId()))return actor;if(actor.getId().equals(teacher.getId())&&id.equals(student.getId()))return student;throw new AccessDeniedException("Not your student");});
        answers=new SpeakingStudentAnswerService();ReflectionTestUtils.setField(answers,"em",em);ReflectionTestUtils.setField(answers,"speaking",speaking);
    }
    @After public void cleanup(){if(em!=null){if(em.getTransaction().isActive())em.getTransaction().rollback();em.close();}}
    private WriteRequest request(Long question,String html,long revision){WriteRequest r=new WriteRequest();r.setId=set.getId();r.studentId=student.getId();r.questionId=question;r.html=html;r.revision=revision;return r;}
    @SuppressWarnings("unchecked") private List<Map<String,Object>> rows(Map<String,Object> data){return (List<Map<String,Object>>)data.get("answers");}
    @SuppressWarnings("unchecked") private List<Map<String,Object>> previewRows(Map<String,Object> data){return (List<Map<String,Object>>)data.get("rows");}
    private long revision(Map<String,Object> data){return ((Number)data.get("revision")).longValue();}
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
        answers.save(request(first.getId(),"Keep this",0));byte[] template=answers.template(set.getId(),student.getId());assertTrue(previewRows(answers.preview(set.getId(),student.getId(),template)).isEmpty());
        try(XSSFWorkbook b=new XSSFWorkbook(new ByteArrayInputStream(template));ByteArrayOutputStream out=new ByteArrayOutputStream()){b.getSheet("THONG_TIN").getRow(2).getCell(1).setCellValue(String.valueOf(other.getId()));b.write(out);try{answers.preview(set.getId(),student.getId(),out.toByteArray());fail();}catch(IllegalArgumentException expected){assertTrue(expected.getMessage().contains("học sinh"));}}
        assertEquals("Keep this",rows(answers.list(set.getId(),null,first.getId())).get(0).get("html"));
    }
    @Test public void excelRichTextAndFormulaValidationArePreviewedBeforeAnyWrite()throws Exception{
        byte[] bytes=workbook("Bold and underline",null);try(XSSFWorkbook b=new XSSFWorkbook(new ByteArrayInputStream(bytes));ByteArrayOutputStream out=new ByteArrayOutputStream()){
            XSSFRichTextString rich=new XSSFRichTextString("Bold and underline");XSSFFont bold=b.createFont();bold.setBold(true);rich.applyFont(0,4,bold);XSSFFont underline=b.createFont();underline.setUnderline(Font.U_SINGLE);rich.applyFont(9,18,underline);b.getSheet("CAU_TRA_LOI").getRow(1).getCell(5).setCellValue(rich);b.getSheet("CAU_TRA_LOI").getRow(2).getCell(5).setCellFormula("1+1");b.write(out);bytes=out.toByteArray();}
        List<Map<String,Object>> rows=previewRows(answers.preview(set.getId(),student.getId(),bytes));assertEquals(2,rows.size());assertEquals("NEW",rows.get(0).get("status"));assertTrue(String.valueOf(rows.get(0).get("html")).contains("<strong>Bold</strong>"));assertTrue(String.valueOf(rows.get(0).get("html")).contains("<u>underline</u>"));assertEquals("INVALID",rows.get(1).get("status"));assertEquals(0L,(long)em.createQuery("select count(a) from SpeakingStudentAnswer a where a.studentId=:student",Long.class).setParameter("student",student.getId()).getSingleResult());
    }
    @Test public void importChecksAllRevisionsBeforeWritingAndKeepsQuestionAndStudentIdentity(){
        answers.save(request(second.getId(),"Someone else already saved",0));ImportRequest stale=new ImportRequest();stale.setId=set.getId();stale.studentId=student.getId();stale.rows=Arrays.asList(request(first.getId(),"Do not partly save",0),request(second.getId(),"Stale",0));
        try{answers.confirm(stale);fail();}catch(SpeakingStudentAnswerService.Conflict expected){}assertEquals(0L,revision(rows(answers.list(set.getId(),null,first.getId())).get(0)));
        stale.rows=Arrays.asList(request(first.getId(),"A new answer",0),request(second.getId(),"Updated",1));Map<String,Object> ack=answers.confirm(stale);assertEquals(2,ack.get("saved"));assertEquals(student.getId(),ack.get("studentId"));assertEquals(2,rows(ack).size());assertEquals(2,answers.confirm(stale).get("saved"));assertEquals(2L,(long)em.createQuery("select count(a) from SpeakingStudentAnswer a where a.studentId=:student",Long.class).setParameter("student",student.getId()).getSingleResult());
    }
    @Test public void duplicateImportAndMissingMetadataCannotSilentlyApplyResponses()throws Exception{
        byte[] bytes=workbook("One","Two");try(XSSFWorkbook b=new XSSFWorkbook(new ByteArrayInputStream(bytes));ByteArrayOutputStream out=new ByteArrayOutputStream()){b.getSheet("CAU_TRA_LOI").getRow(2).getCell(0).setCellValue(String.valueOf(first.getId()));b.getSheet("CAU_TRA_LOI").getRow(2).getCell(1).setCellValue("HOME_1");b.write(out);bytes=out.toByteArray();}
        List<Map<String,Object>> preview=previewRows(answers.preview(set.getId(),student.getId(),bytes));assertEquals("INVALID",preview.get(0).get("status"));assertEquals("INVALID",preview.get(1).get("status"));ImportRequest duplicate=new ImportRequest();duplicate.setId=set.getId();duplicate.studentId=student.getId();duplicate.rows=Arrays.asList(request(first.getId(),"one",0),request(first.getId(),"two",0));try{answers.confirm(duplicate);fail();}catch(IllegalArgumentException expected){}
        assertEquals(0L,(long)em.createQuery("select count(a) from SpeakingStudentAnswer a where a.studentId=:student",Long.class).setParameter("student",student.getId()).getSingleResult());
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
