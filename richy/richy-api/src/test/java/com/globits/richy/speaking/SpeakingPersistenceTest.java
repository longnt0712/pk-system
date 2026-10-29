package com.globits.richy.speaking;

import com.globits.richy.domain.*;
import com.globits.richy.dto.SpeakingDto.*;
import com.globits.richy.repository.EnrolmentClassRepository;
import com.globits.richy.rest.RestSpeakingController;
import com.globits.richy.service.impl.*;
import com.globits.security.domain.User;
import com.globits.security.repository.UserRepository;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import javax.persistence.*;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.*;
import org.junit.rules.TemporaryFolder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

/** Production services, mappings, JPQL, Excel parser and chunk storage against an isolated H2 database. */
public class SpeakingPersistenceTest {
    private static SessionFactory factory;
    private EntityManager em;
    private SpeakingServiceImpl service;
    private SpeakingRecordingService recordings;
    private User teacher,student,stranger;
    private Long setId;
    @Rule public TemporaryFolder folder=new TemporaryFolder();
    private static void register(Configuration cfg,Class<?> sample,String name)throws Exception{
        File root=new File(sample.getProtectionDomain().getCodeSource().getLocation().toURI());
        File[] files=new File(root,name.replace('.','/')).listFiles();assertNotNull(files);
        for(File file:files)if(file.getName().endsWith(".class")&&!file.getName().contains("$")){
            Class<?> type=Class.forName(name+"."+file.getName().replace(".class",""));if(type.isAnnotationPresent(Entity.class))cfg.addAnnotatedClass(type);
        }
    }
    @BeforeClass public static void database()throws Exception{
        org.h2.jdbcx.JdbcDataSource ds=new org.h2.jdbcx.JdbcDataSource();ds.setURL("jdbc:h2:mem:speaking;MODE=MSSQLServer;DB_CLOSE_DELAY=-1");
        try(java.sql.Connection c=ds.getConnection();java.sql.Statement s=c.createStatement()){s.execute("CREATE SCHEMA dbo");}
        Configuration cfg=new Configuration().setProperty("hibernate.default_schema","dbo").setProperty("hibernate.dialect","org.hibernate.dialect.H2Dialect")
            .setProperty("hibernate.hbm2ddl.auto","create-drop").setProperty("hibernate.show_sql","false").setProperty("hibernate.temp.use_jdbc_metadata_defaults","false").setProperty("hibernate.hbm2ddl.halt_on_error","true");
        cfg.getProperties().put("hibernate.connection.datasource",ds);
        register(cfg,Topic.class,"com.globits.richy.domain");register(cfg,com.globits.core.domain.Organization.class,"com.globits.core.domain");register(cfg,User.class,"com.globits.security.domain");factory=cfg.buildSessionFactory();
        // Run every service test on the supplied deployment DDL, not only Hibernate-generated tables.
        try(java.sql.Connection c=ds.getConnection();java.sql.Statement s=c.createStatement()){
            for(String table:Arrays.asList("recording","pass","set_entry","practice","question","set"))s.execute("DROP TABLE dbo.tbl_speaking_"+table);
            java.util.regex.Matcher ddl=java.util.regex.Pattern.compile("(?s)CREATE TABLE dbo\\.tbl_speaking_.*?\\n    \\);").matcher(new String(Files.readAllBytes(Paths.get("richy/database/speaking-studio.sql")),StandardCharsets.UTF_8));while(ddl.find())s.execute(ddl.group());
        }
    }
    @AfterClass public static void closeDatabase(){if(factory!=null)factory.close();}
    private User user(String name){User u=new User();u.setUsername(name+UUID.randomUUID());u.setPassword("unused");u.setEmail(u.getUsername()+"@example.invalid");em.persist(u);return u;}
    private void as(User u){SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(u,"",Collections.emptyList()));}
    @Before public void fixture()throws Exception{
        em=factory.createEntityManager();em.getTransaction().begin();teacher=user("teacher");student=user("student");stranger=user("stranger");
        List<com.globits.security.domain.Role> adminRoles=em.createQuery("select r from Role r where r.name=:name",com.globits.security.domain.Role.class).setParameter("name","ROLE_ADMIN").getResultList();
        com.globits.security.domain.Role adminRole=adminRoles.isEmpty()?new com.globits.security.domain.Role():adminRoles.get(0);if(adminRole.getId()==null){adminRole.setName("ROLE_ADMIN");em.persist(adminRole);}teacher.getRoles().add(adminRole);
        EnrolmentClass clazz=new EnrolmentClass();clazz.setName("Speaking class");clazz.setSchoolId(1);clazz.getTeachers().add(teacher);em.persist(clazz);student.setEnrollmentClassIds(Collections.singleton(clazz.getId()));em.flush();
        UserRepository users=mock(UserRepository.class);when(users.findByUsernameAndPerson(anyString())).thenAnswer(c->em.createQuery("select u from User u where u.username=:name",User.class).setParameter("name",c.getArguments()[0]).getResultList().stream().findFirst().orElse(null));
        when(users.findOne(anyLong())).thenAnswer(c->em.find(User.class,c.getArguments()[0]));when(users.getUsersByEnrollmentClassIds(anyList())).thenReturn(Collections.singletonList(student));
        EnrolmentClassRepository classes=mock(EnrolmentClassRepository.class);when(classes.findAll()).thenReturn(Collections.singletonList(clazz));when(classes.findOne(anyLong())).thenAnswer(c->em.find(EnrolmentClass.class,c.getArguments()[0]));
        service=new SpeakingServiceImpl();ReflectionTestUtils.setField(service,"em",em);ReflectionTestUtils.setField(service,"users",users);ReflectionTestUtils.setField(service,"classes",classes);
        recordings=new SpeakingRecordingService();ReflectionTestUtils.setField(recordings,"em",em);ReflectionTestUtils.setField(recordings,"speaking",service);ReflectionTestUtils.setField(recordings,"storageDirectory",folder.getRoot().getAbsolutePath());
        as(teacher);SetRequest req=new SetRequest();req.year=2026;req.number=1;setId=((Number)service.createSet(req).get("id")).longValue();req.classIds=Collections.singletonList(clazz.getId());service.share(setId,req);
    }
    @After public void cleanup(){SecurityContextHolder.clearContext();if(em!=null){if(em.getTransaction().isActive())em.getTransaction().rollback();em.close();}}
    private byte[] file(String prompt,String sample,boolean all)throws Exception{
        try(Workbook book=new XSSFWorkbook();ByteArrayOutputStream out=new ByteArrayOutputStream()){
            Sheet info=book.createSheet("THONG_TIN");info.createRow(3).createCell(1).setCellValue(2026);info.createRow(4).createCell(1).setCellValue(1);
            Sheet p1=book.createSheet("PART_1"),p2=book.createSheet("PART_2"),p3=book.createSheet("PART_3");
            line(p1,0,"Topic *","Câu hỏi *","Sample","Mã câu (tuỳ chọn)","Ghi chú");line(p2,0,"Tên bài *","Cue card *","Sample","Mã bài (tuỳ chọn)","Ghi chú");line(p3,0,"Nhóm Part 3 *","Tên/mã Part 2 liên kết","Câu hỏi *","Sample","Mã câu (tuỳ chọn)","Ghi chú");
            line(p1,1,"Home",prompt,sample,"HOME_1","");if(all){line(p2,1,"A book","Describe a book.\nSay why you like it.","Cue sample","BOOK","");line(p3,1,"Reading habits","BOOK","Why do people read?","Third sample","READ_1","");}
            book.write(out);return out.toByteArray();
        }
    }
    private static void line(Sheet sheet,int index,String...values){Row row=sheet.createRow(index);for(int i=0;i<values.length;i++)row.createCell(i).setCellValue(values[i]);}
    @SuppressWarnings("unchecked") private List<Map<String,Object>> rows(Map<String,Object> preview){return (List<Map<String,Object>>)preview.get("rows");}
    private void confirm(Long id,Map<String,Object> preview,String action){ConfirmImport req=new ConfirmImport();req.token=(String)preview.get("token");for(Map<String,Object> r:rows(preview)){ImportChoice c=new ImportChoice();c.rowId=((ImportRow)r.get("row")).rowId;c.action="CHANGED".equals(r.get("status"))?action:"IMPORT";req.choices.add(c);}service.confirm(id,req);}
    @SuppressWarnings("unchecked") private List<Map<String,Object>> bank(Long id){return(List<Map<String,Object>>)service.bank(id,student.getId()).get("questions");}
    private void seed()throws Exception{confirm(setId,service.preview(setId,file("What do you like about home?","First sample",true)),"NEW_VARIANT");}
    private PracticeRequest request(){PracticeRequest req=new PracticeRequest();req.clientKey="attempt_12345678";req.setIds=Collections.singletonList(setId);req.parts=Arrays.asList(1,2,3);req.part1Count=10;req.part3Count=10;return req;}
    @SuppressWarnings("unchecked") private List<Map<String,Object>> questions(Map<String,Object> practice){return(List<Map<String,Object>>)((Map<String,Object>)practice.get("snapshot")).get("questions");}
    private PassRequest pass(Long question){PassRequest p=new PassRequest();p.studentId=student.getId();p.questionIds=Collections.singletonList(question);p.passed=true;return p;}
    @Test public void importVariantsPreserveOldPassHistoryAndSetSpecificSamples()throws Exception{
        seed();Long original=((Number)bank(setId).get(1).get("id")).longValue();
        // Find by Part, since import resolves cue cards before the other Parts.
        original=((Number)bank(setId).stream().filter(q->Integer.valueOf(1).equals(q.get("part"))).findFirst().get().get("id")).longValue();service.markPass(setId,pass(original));
        as(student);Map<String,Object> practice=service.startPractice(request());assertEquals(3,questions(practice).size());for(Map<String,Object> q:questions(practice))assertFalse(q.containsKey("sample"));
        as(teacher);Map<String,Object> updated=service.preview(setId,file("What do you like about home?","Better sample",false));assertEquals("UPDATE_SAMPLE",rows(updated).get(0).get("status"));confirm(setId,updated,"NEW_VARIANT");
        assertEquals(3,bank(setId).size());Map<String,Object> home=bank(setId).stream().filter(q->Integer.valueOf(1).equals(q.get("part"))).findFirst().get();assertEquals(original,home.get("id"));assertEquals(true,home.get("passed"));assertEquals("Better sample",home.get("sample"));
        updated=service.preview(setId,file("How would you improve your home?","New variant",false));assertEquals("CHANGED",rows(updated).get(0).get("status"));confirm(setId,updated,"NEW_VARIANT");home=bank(setId).stream().filter(q->Integer.valueOf(1).equals(q.get("part"))).findFirst().get();assertNotEquals(original,home.get("id"));assertEquals(false,home.get("passed"));assertNotNull(em.find(SpeakingQuestion.class,original));assertTrue(em.createQuery("select p from SpeakingPass p where p.questionId=:id",SpeakingPass.class).setParameter("id",original).getSingleResult().getPassed());
        assertEquals("What do you like about home?",questions(service.getPractice(((Number)practice.get("id")).longValue())).stream().filter(q->Integer.valueOf(1).equals(q.get("part"))).findFirst().get().get("prompt"));
    }
    @Test public void multiSetPracticeDeduplicatesCanonicalQuestionsAndKeepsSamplesSeparate()throws Exception{
        seed();SetRequest req=new SetRequest();req.year=2026;req.number=2;Long second=((Number)service.createSet(req).get("id")).longValue();req.studentIds=Collections.singletonList(student.getId());service.share(second,req);
        // Same file data with period metadata changed for the second set.
        byte[] bytes=file("What do you like about home?","Other set sample",true);try(Workbook b=WorkbookFactory.create(new ByteArrayInputStream(bytes));ByteArrayOutputStream out=new ByteArrayOutputStream()){b.getSheet("THONG_TIN").getRow(4).getCell(1).setCellValue(2);b.write(out);bytes=out.toByteArray();}
        confirm(second,service.preview(second,bytes),"NEW_VARIANT");assertEquals("First sample",bank(setId).stream().filter(q->Integer.valueOf(1).equals(q.get("part"))).findFirst().get().get("sample"));
        Long home=((Number)bank(second).stream().filter(q->Integer.valueOf(1).equals(q.get("part"))).findFirst().get().get("id")).longValue();service.markPass(second,pass(home));assertEquals(true,bank(setId).stream().filter(q->Integer.valueOf(1).equals(q.get("part"))).findFirst().get().get("passed"));
        as(student);PracticeRequest p=request();p.setIds=Arrays.asList(second,setId);Map<String,Object> practice=service.startPractice(p);List<Map<String,Object>> qs=questions(practice);assertEquals(3,qs.size());assertEquals(3,qs.stream().map(q->q.get("id")).distinct().count());Long cue=((Number)qs.stream().filter(q->Integer.valueOf(2).equals(q.get("part"))).findFirst().get().get("id")).longValue();assertEquals(cue.longValue(),((Number)qs.stream().filter(q->Integer.valueOf(3).equals(q.get("part"))).findFirst().get().get("linkedPart2Id")).longValue());
    }
    @Test public void anExistingAdminBankBecomesCommonWithoutCopyingQuestionsOrStudentHistory()throws Exception{
        seed();List<Map<String,Object>> before=bank(setId);Long home=((Number)before.stream().filter(q->Integer.valueOf(1).equals(q.get("part"))).findFirst().get().get("id")).longValue();
        service.markPass(setId,pass(home));as(student);Map<String,Object> existingPractice=service.startPractice(request());Long existingId=((Number)existingPractice.get("id")).longValue();
        as(teacher);SpeakingSet set=em.find(SpeakingSet.class,setId);set.setClassIdsJson("[]");set.setStudentIdsJson("[]");
        em.flush();
        as(stranger);Map<String,Object> loaded=service.bank(setId,null);Map<?,?> info=(Map<?,?>)loaded.get("set");assertEquals(true,info.get("sharedForEveryone"));assertEquals(false,info.get("canManage"));
        @SuppressWarnings("unchecked") List<Map<String,Object>> visible=(List<Map<String,Object>>)loaded.get("questions");assertEquals(before.size(),visible.size());for(int index=0;index<before.size();index++)assertEquals(before.get(index).get("id"),visible.get(index).get("id"));
        assertEquals(3,questions(service.startPractice(request())).size());try{service.getPractice(existingId);fail();}catch(AccessDeniedException expected){}
        try{service.preview(setId,file("forged","",false));fail();}catch(AccessDeniedException expected){}
        as(student);@SuppressWarnings("unchecked") List<Map<String,Object>> mine=(List<Map<String,Object>>)service.bank(setId,null).get("questions");assertEquals(true,mine.stream().filter(q->home.equals(((Number)q.get("id")).longValue())).findFirst().get().get("passed"));assertEquals(existingId,service.getPractice(existingId).get("id"));
    }
    @Test public void retriesAreIdempotentCompletionIsTerminalAndNeverMarksPass()throws Exception{
        seed();as(student);PracticeRequest req=request();Map<String,Object> p=service.startPractice(req);Long id=((Number)p.get("id")).longValue();assertEquals(id,service.startPractice(req).get("id"));
        req.part1Count=3;try{service.startPractice(req);fail();}catch(IllegalArgumentException expected){}
        PracticeProgress progress=new PracticeProgress();progress.currentIndex=2;progress.elapsedSeconds=90L;progress.finished=true;Map<String,Object> done=service.progress(id,progress);assertEquals("DONE",done.get("status"));assertTrue(questions(done).get(0).containsKey("sample"));progress.elapsedSeconds=2L;progress.finished=false;assertEquals("DONE",service.progress(id,progress).get("status"));assertEquals(90L,service.progress(id,progress).get("elapsedSeconds"));
        assertFalse(service.history(null,null).get(0).containsKey("snapshot"));assertEquals(0L,(long)em.createQuery("select count(p) from SpeakingPass p",Long.class).getSingleResult());
    }
    @Test public void accessControlsProtectImportsPassOtherStudentsAndPrivateRecordings()throws Exception{
        seed();Long q=((Number)bank(setId).get(0).get("id")).longValue();as(stranger);assertNotNull(service.bank(setId,null));try{service.preview(setId,file("forged","",false));fail();}catch(AccessDeniedException expected){}
        as(student);try{service.markPass(setId,pass(q));fail();}catch(AccessDeniedException expected){}try{service.bank(setId,teacher.getId());fail();}catch(AccessDeniedException expected){}
        Map<String,Object> p=service.startPractice(request());Long practice=((Number)p.get("id")).longValue();as(stranger);try{service.getPractice(practice);fail();}catch(AccessDeniedException expected){}
        as(teacher);assertTrue(questions(service.getPractice(practice)).get(0).containsKey("sample"));RecordingRequest r=new RecordingRequest();r.uploadKey="recording_12345";r.contentType="audio/webm";r.questionIndex=0;try{recordings.create(practice,r);fail();}catch(AccessDeniedException expected){}
        Map<String,Object> preview=service.preview(setId,file("What do you like about home?","First sample",true));ConfirmImport wrong=new ConfirmImport();wrong.token="stale";try{service.confirm(setId,wrong);fail();}catch(IllegalArgumentException expected){}
        wrong.token=(String)preview.get("token");ImportChoice forged=new ImportChoice();forged.rowId="PART_1:999";forged.action="IMPORT";wrong.choices.add(forged);try{service.confirm(setId,wrong);fail();}catch(IllegalArgumentException expected){}
    }
    @Test public void privateChunkStorageChecksHashesMissingPiecesRetriesAndQuestionBounds()throws Exception{
        seed();as(student);Long practice=((Number)service.startPractice(request()).get("id")).longValue();RecordingRequest r=new RecordingRequest();r.uploadKey="recording_12345";r.contentType="audio/webm";r.questionIndex=3;try{recordings.create(practice,r);fail();}catch(IllegalArgumentException expected){}
        r.questionIndex=0;Long id=((Number)recordings.create(practice,r).get("id")).longValue();assertEquals(id,recordings.create(practice,r).get("id"));byte[] first=new byte[]{0x1a,0x45,(byte)0xdf,(byte)0xa3,0,0,0,0,1,2,3,4},second="extra audio bytes".getBytes(StandardCharsets.UTF_8);
        recordings.chunk(id,0,first);recordings.chunk(id,0,first);assertEquals(Long.valueOf(first.length),em.find(SpeakingRecording.class,id).getByteCount());try{recordings.chunk(id,0,second);fail();}catch(IllegalArgumentException expected){}
        RecordingFinish finish=new RecordingFinish();finish.chunkCount=2;try{recordings.finish(id,finish);fail();}catch(IllegalArgumentException expected){}
        recordings.chunk(id,1,second);assertEquals(true,recordings.finish(id,finish).get("complete"));assertEquals(true,recordings.finish(id,finish).get("complete"));recordings.chunk(id,0,first);assertEquals(first.length+second.length,recordings.file(id).length());
        as(stranger);try{recordings.file(id);fail();}catch(AccessDeniedException expected){}as(teacher);assertTrue(recordings.file(id).exists());try{recordings.chunk(id,2,second);fail();}catch(AccessDeniedException expected){}
        as(student);PracticeProgress progress=new PracticeProgress();progress.currentIndex=0;progress.elapsedSeconds=30L;progress.finished=true;service.progress(practice,progress);r.uploadKey="late_record_12345";assertNotNull(recordings.create(practice,r).get("id"));
    }
    @Test public void exportedWorkbookRoundTripsAndBadLinksAreFlaggedBeforeImport()throws Exception{
        seed();RestSpeakingController rest=new RestSpeakingController();ReflectionTestUtils.setField(rest,"service",service);byte[] exported=rest.export(setId).getBody();List<ImportRow> parsed=SpeakingImportSupport.read(exported,2026,1);assertEquals(3,parsed.size());for(ImportRow row:parsed){assertNull(row.error);assertFalse(row.code.isEmpty());}
        byte[] bad=file("Question","sample",true);try(Workbook b=WorkbookFactory.create(new ByteArrayInputStream(bad));ByteArrayOutputStream out=new ByteArrayOutputStream()){b.getSheet("PART_3").getRow(1).getCell(1).setCellValue("unknown cue");b.write(out);bad=out.toByteArray();}
        assertEquals("INVALID",rows(service.preview(setId,bad)).stream().filter(row->((ImportRow)row.get("row")).part==3).findFirst().get().get("status"));
        try{SpeakingImportSupport.read(exported,2026,2);fail();}catch(IllegalArgumentException expected){}try{SpeakingImportSupport.read(new byte[]{1,2,3},2026,1);fail();}catch(IllegalArgumentException expected){}
    }
    @Test public void automaticImportCodesRemainStableWhenExportedAndImportedAgain()throws Exception{
        byte[] data=file("First question","Sample",false);try(Workbook b=WorkbookFactory.create(new ByteArrayInputStream(data));ByteArrayOutputStream out=new ByteArrayOutputStream()){b.getSheet("PART_1").getRow(1).getCell(3).setCellValue("");b.write(out);data=out.toByteArray();}
        confirm(setId,service.preview(setId,data),"NEW_VARIANT");Map<String,Object> original=bank(setId).get(0);assertTrue(String.valueOf(original.get("code")).matches("SP1-[a-f0-9]{32}"));
        RestSpeakingController rest=new RestSpeakingController();ReflectionTestUtils.setField(rest,"service",service);Map<String,Object> preview=service.preview(setId,rest.export(setId).getBody());assertEquals("UNCHANGED",rows(preview).get(0).get("status"));confirm(setId,preview,"NEW_VARIANT");assertEquals(1,bank(setId).size());assertEquals(original.get("id"),bank(setId).get(0).get("id"));assertEquals(original.get("code"),bank(setId).get(0).get("code"));
    }
    @Test public void simultaneousRetriesCreateOnlyOnePractice()throws Exception{
        seed();SetRequest share=new SetRequest();share.studentIds=Collections.singletonList(student.getId());service.share(setId,share);em.getTransaction().commit();
        final Long studentId=student.getId();final PracticeRequest req=request();java.util.concurrent.CountDownLatch ready=new java.util.concurrent.CountDownLatch(2),go=new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.ExecutorService workers=java.util.concurrent.Executors.newFixedThreadPool(2);
        java.util.concurrent.Callable<Long> create=()->{
            EntityManager local=factory.createEntityManager();try{local.getTransaction().begin();User actor=local.find(User.class,studentId);as(actor);
                UserRepository users=mock(UserRepository.class);when(users.findByUsernameAndPerson(anyString())).thenReturn(actor);when(users.findOne(anyLong())).thenAnswer(call->local.find(User.class,call.getArguments()[0]));
                SpeakingServiceImpl endpoint=new SpeakingServiceImpl();ReflectionTestUtils.setField(endpoint,"em",local);ReflectionTestUtils.setField(endpoint,"users",users);ReflectionTestUtils.setField(endpoint,"classes",mock(EnrolmentClassRepository.class));
                ready.countDown();assertTrue(go.await(10,java.util.concurrent.TimeUnit.SECONDS));Long result=((Number)endpoint.startPractice(req).get("id")).longValue();local.getTransaction().commit();return result;
            }finally{if(local.getTransaction().isActive())local.getTransaction().rollback();local.close();SecurityContextHolder.clearContext();}
        };
        try{java.util.concurrent.Future<Long> a=workers.submit(create),b=workers.submit(create);assertTrue(ready.await(10,java.util.concurrent.TimeUnit.SECONDS));go.countDown();assertEquals(a.get(20,java.util.concurrent.TimeUnit.SECONDS),b.get(20,java.util.concurrent.TimeUnit.SECONDS));}
        finally{go.countDown();workers.shutdownNow();}
    }
    @Test public void concurrentChunksReloadTheManifestAfterWaitingForTheSessionLock()throws Exception{
        seed();as(student);Long practice=((Number)service.startPractice(request()).get("id")).longValue();RecordingRequest req=new RecordingRequest();req.uploadKey="concurrent_record_123";req.contentType="audio/webm";req.questionIndex=0;
        final Long recordingId=((Number)recordings.create(practice,req).get("id")).longValue(),studentId=student.getId();em.getTransaction().commit();
        final String storage=folder.getRoot().getAbsolutePath();java.util.concurrent.CountDownLatch ready=new java.util.concurrent.CountDownLatch(2),go=new java.util.concurrent.CountDownLatch(1);java.util.concurrent.ExecutorService workers=java.util.concurrent.Executors.newFixedThreadPool(2);
        List<java.util.concurrent.Future<?>> results=new ArrayList<java.util.concurrent.Future<?>>();
        try{
            for(int part=0;part<2;part++){final int index=part;results.add(workers.submit(()->{
                EntityManager local=factory.createEntityManager();try{local.getTransaction().begin();User actor=local.find(User.class,studentId);as(actor);
                    UserRepository users=mock(UserRepository.class);when(users.findByUsernameAndPerson(anyString())).thenReturn(actor);when(users.findOne(anyLong())).thenAnswer(call->local.find(User.class,call.getArguments()[0]));
                    SpeakingServiceImpl endpoint=new SpeakingServiceImpl();ReflectionTestUtils.setField(endpoint,"em",local);ReflectionTestUtils.setField(endpoint,"users",users);
                    SpeakingRecordingService upload=new SpeakingRecordingService();ReflectionTestUtils.setField(upload,"em",local);ReflectionTestUtils.setField(upload,"speaking",endpoint);ReflectionTestUtils.setField(upload,"storageDirectory",storage);
                    local.find(SpeakingRecording.class,recordingId);ready.countDown();assertTrue(go.await(10,java.util.concurrent.TimeUnit.SECONDS));upload.chunk(recordingId,index,new byte[]{1,2,3});local.getTransaction().commit();return null;
                }finally{if(local.getTransaction().isActive())local.getTransaction().rollback();local.close();SecurityContextHolder.clearContext();}
            }));}
            assertTrue(ready.await(10,java.util.concurrent.TimeUnit.SECONDS));go.countDown();for(java.util.concurrent.Future<?> result:results)result.get(20,java.util.concurrent.TimeUnit.SECONDS);
            em.clear();SpeakingRecording saved=em.find(SpeakingRecording.class,recordingId);assertEquals(Long.valueOf(6),saved.getByteCount());assertTrue(saved.getChunksJson().contains("\"0\""));assertTrue(saved.getChunksJson().contains("\"1\""));
        }finally{go.countDown();workers.shutdownNow();}
    }
    @Test public void migrationCreatesSixTablesWithTheDeployedColumns()throws Exception{
        String sql=new String(Files.readAllBytes(Paths.get("richy/database/speaking-studio.sql")),StandardCharsets.UTF_8);java.util.regex.Matcher matcher=java.util.regex.Pattern.compile("(?s)CREATE TABLE dbo\\.tbl_speaking_.*?\\n    \\);").matcher(sql);int count=0;
        try(java.sql.Connection c=java.sql.DriverManager.getConnection("jdbc:h2:mem:speaking_migration;MODE=MSSQLServer");java.sql.Statement s=c.createStatement()){
            s.execute("CREATE SCHEMA dbo");while(matcher.find()){s.execute(matcher.group());count++;}assertEquals(6,count);
            s.execute("insert into dbo.tbl_speaking_set(create_date,created_by,owner_id,season_year,set_number,name,revision) values(CURRENT_TIMESTAMP,'test',1,2026,1,N'Bộ 1',0)");
            try{s.execute("insert into dbo.tbl_speaking_set(create_date,created_by,owner_id,season_year,set_number,name) values(CURRENT_TIMESTAMP,'test',1,2026,1,'duplicate')");fail();}catch(java.sql.SQLException expected){assertEquals("23505",expected.getSQLState());}
        }
    }
}
