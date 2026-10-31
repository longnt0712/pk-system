package com.globits.richy.schedule;

import com.globits.richy.domain.*;
import com.globits.richy.dto.*;
import com.globits.richy.repository.*;
import com.globits.richy.service.EnrolmentClassScheduleException;
import com.globits.richy.service.impl.*;
import com.globits.richy.question.ComprehensiveListeningScore;
import com.globits.security.domain.User;
import com.globits.security.dto.UserDto;
import com.globits.security.repository.UserRepository;
import java.nio.charset.StandardCharsets;
import java.util.*;
import javax.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.joda.time.LocalDateTime;
import org.junit.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

/** Real production result saves against isolated Hibernate/H2 mappings and section membership. */
public class ComprehensiveSectionSubmissionTest {
    private static SessionFactory factory;
    private EntityManager em;
    private TestResultServiceImpl saves;
    private EnrolmentClassServiceImpl schedules;
    private TestResultRepository results;
    private User student;
    private Question source;
    private EnrolmentClass clazz;
    private EnrolmentClassScheduleTask task;
    private List<ComprehensiveAssignmentSectionDto> sections;
    private final Map<Long,QuestionAnswer> right=new LinkedHashMap<Long,QuestionAnswer>(),wrong=new LinkedHashMap<Long,QuestionAnswer>();

    @BeforeClass public static void database()throws Exception {
        org.h2.jdbcx.JdbcDataSource ds=new org.h2.jdbcx.JdbcDataSource();ds.setURL("jdbc:h2:mem:comprehensive_sections_submit;MODE=MSSQLServer;DB_CLOSE_DELAY=-1");
        try(java.sql.Connection c=ds.getConnection();java.sql.Statement sql=c.createStatement()){sql.execute("CREATE SCHEMA dbo");}
        Configuration cfg=new Configuration().setProperty("hibernate.default_schema","dbo").setProperty("hibernate.dialect","org.hibernate.dialect.H2Dialect")
            .setProperty("hibernate.hbm2ddl.auto","create-drop").setProperty("hibernate.show_sql","false").setProperty("hibernate.temp.use_jdbc_metadata_defaults","false").setProperty("hibernate.hbm2ddl.halt_on_error","true");
        cfg.getProperties().put("hibernate.connection.datasource",ds);
        MultiTopicVocabularyPersistenceTest.register(cfg,Topic.class,"com.globits.richy.domain");
        MultiTopicVocabularyPersistenceTest.register(cfg,com.globits.core.domain.Organization.class,"com.globits.core.domain");
        MultiTopicVocabularyPersistenceTest.register(cfg,User.class,"com.globits.security.domain");factory=cfg.buildSessionFactory();
    }
    @AfterClass public static void closeDatabase(){if(factory!=null)factory.close();}
    private Question question(Question parent,int type,int ordinal) {
        Question value=new Question();value.setParent(parent);value.setType(type);value.setOrdinalNumber(ordinal);value.setTitle("Section test");value.setQuestion("Question "+ordinal);value.setStatus(7);em.persist(value);
        if(parent!=null){if(parent.getSubQuestions()==null)parent.setSubQuestions(new LinkedHashSet<Question>());parent.getSubQuestions().add(value);}return value;
    }
    private QuestionAnswer choice(Question question,boolean correct,String text,int order) {
        Answer value=new Answer();value.setAnswer(text);em.persist(value);QuestionAnswer option=new QuestionAnswer();option.setQuestion(question);option.setAnswer(value);option.setCorrect(correct);option.setOrdinalNumber(order);em.persist(option);
        if(question.getQuestionAnswers()==null)question.setQuestionAnswers(new LinkedHashSet<QuestionAnswer>());question.getQuestionAnswers().add(option);return option;
    }
    private Question objectiveSource(int count) {
        Question test=question(null,0,1);test.setTestFormat("COMPREHENSIVE");Question part=question(test,0,1),pack=question(part,1,1);
        for(int i=1;i<=count;i++){Question child=question(pack,0,i);right.put(child.getId(),choice(child,true,"Right",1));wrong.put(child.getId(),choice(child,false,"Wrong",2));}return test;
    }
    private EnrolmentClassScheduleTask assignment(Question test,int limit) {
        List<EnrolmentClassScheduleDay> existing=em.createQuery("select d from EnrolmentClassScheduleDay d where d.enrolmentClass.id=:class and d.scheduleDate=:date",EnrolmentClassScheduleDay.class).setParameter("class",clazz.getId()).setParameter("date","2026-10-20").getResultList();
        EnrolmentClassScheduleDay day;if(existing.isEmpty()){day=new EnrolmentClassScheduleDay();day.setEnrolmentClass(clazz);day.setScheduleDate("2026-10-20");em.persist(day);}else day=existing.get(0);
        EnrolmentClassScheduleTask value=new EnrolmentClassScheduleTask();value.setScheduleDay(day);value.setSection("HOMEWORK");value.setTitle("Split assignment");value.setStatus("TODO");value.setActivityType("COMPREHENSIVE");value.setIeltsTest(test);value.setIeltsParts(Collections.singletonList(1));value.setRequiredAttempts(1);
        value.setComprehensiveQuestionLimit(limit);value.setComprehensiveTimeLimitMinutes(0);ComprehensiveAssignmentSections.write(value,ComprehensiveAssignmentSections.plan(test,limit,0));em.persist(value);em.flush();return value;
    }
    @Before public void fixture() {
        em=factory.createEntityManager();em.getTransaction().begin();student=new User();student.setUsername("section-student-"+UUID.randomUUID());student.setEmail(student.getUsername()+"@example.invalid");student.setPassword("unused");em.persist(student);
        clazz=new EnrolmentClass();clazz.setName("Section class");clazz.setSchoolId(2);em.persist(clazz);student.setEnrollmentClassIds(Collections.singleton(clazz.getId()));source=objectiveSource(100);task=assignment(source,50);sections=ComprehensiveAssignmentSections.read(task);
        saves=new TestResultServiceImpl();ReflectionTestUtils.setField(saves,"manager",em);results=mock(TestResultRepository.class);ReflectionTestUtils.setField(saves,"testResultRepository",results);
        when(results.findAttemptsForRetry(anyLong(),anyString(),anyInt())).thenAnswer(call->em.createQuery("select r from TestResult r where r.user.id=:student and r.clientAttemptKey=:key and r.testType=:type order by r.id",TestResult.class).setParameter("student",call.getArguments()[0]).setParameter("key",call.getArguments()[1]).setParameter("type",call.getArguments()[2]).getResultList());
        when(results.save(any(TestResult.class))).thenAnswer(call->{TestResult r=(TestResult)call.getArguments()[0];if(r.getId()==null)em.persist(r);em.flush();return r;});
        UserRepository users=mock(UserRepository.class);when(users.findById(anyLong())).thenAnswer(call->em.find(User.class,call.getArguments()[0]));when(users.findByUsername(anyString())).thenReturn(student);ReflectionTestUtils.setField(saves,"userRepository",users);
        QuestionRepository questions=mock(QuestionRepository.class);when(questions.findOne(anyLong())).thenAnswer(call->em.find(Question.class,call.getArguments()[0]));ReflectionTestUtils.setField(saves,"questionRepository",questions);
        QuestionAnswerRepository choices=mock(QuestionAnswerRepository.class);when(choices.findOne(anyLong())).thenAnswer(call->em.find(QuestionAnswer.class,call.getArguments()[0]));when(choices.getOne(anyLong())).thenAnswer(call->em.find(QuestionAnswer.class,call.getArguments()[0]));ReflectionTestUtils.setField(saves,"questionAnswerRepository",choices);
        EnrolmentClassScheduleTaskRepository tasks=mock(EnrolmentClassScheduleTaskRepository.class);when(tasks.findOne(anyLong())).thenAnswer(call->em.find(EnrolmentClassScheduleTask.class,call.getArguments()[0]));ReflectionTestUtils.setField(saves,"scheduleTaskRepository",tasks);
        EnrolmentClassRepository classes=mock(EnrolmentClassRepository.class);when(classes.findOne(anyLong())).thenAnswer(call->em.find(EnrolmentClass.class,call.getArguments()[0]));ReflectionTestUtils.setField(saves,"enrolmentClassRepository",classes);
        schedules=new EnrolmentClassServiceImpl();ReflectionTestUtils.setField(schedules,"testResultRepository",results);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(student,"",Collections.emptyList()));
    }
    @After public void cleanup(){SecurityContextHolder.clearContext();if(em!=null){if(em.getTransaction().isActive())em.getTransaction().rollback();em.close();}}
    private String key(String text){return UUID.nameUUIDFromBytes(text.getBytes(StandardCharsets.UTF_8)).toString().replace("-","");}
    private QuestionAnswerTestResultDto row(QuestionAnswer option,String text) {
        QuestionAnswerDto selected=new QuestionAnswerDto();selected.setId(option.getId());QuestionAnswerTestResultDto result=new QuestionAnswerTestResultDto();result.setQuestionAnswer(selected);result.setClientAnswer(text);result.setOrdinalNumber(option.getQuestion().getOrdinalNumber());return result;
    }
    private TestResultDto submission(int section,int correct,int supplied,String label) {
        TestResultDto dto=new TestResultDto();dto.setTestType(6);dto.setClientAttemptKey(key(label));dto.setUser(new UserDto(student,false));dto.setTestName("Split test · Part "+(section+1));dto.setSourceQuestionId(source.getId());dto.setAssignmentTaskId(task.getId());dto.setAssignmentSectionKey(sections.get(section).getKey());dto.setCompletedParts(Collections.singletonList(1));dto.setIeltsSessionMode("SERIOUS");dto.setActiveDurationSeconds(90);
        List<QuestionAnswerTestResultDto> answers=new ArrayList<QuestionAnswerTestResultDto>();List<Long> ids=sections.get(section).getQuestionIds();for(int i=0;i<Math.min(supplied,ids.size());i++)answers.add(row(i<correct?right.get(ids.get(i)):wrong.get(ids.get(i)),i<correct?"Right":"Wrong"));dto.setQuestionAnswerTestResult(answers);return dto;
    }
    private TestResultDto save(TestResultDto dto){return saves.saveObject(dto);}
    private void rejected(TestResultDto dto) {try{save(dto);fail("Expected section validation failure");}catch(IllegalArgumentException|AccessDeniedException expected){}}
    private long resultCount(){return em.createQuery("select count(r) from TestResult r where r.user.id=:student",Long.class).setParameter("student",student.getId()).getSingleResult();}

    @Test public void fortyTwoOfFiftyFailsAndFortyThreePassesWithIndependentHistories() {
        TestResultDto failed=save(submission(0,42,50,"42/50")),passed=save(submission(0,43,50,"43/50"));assertEquals("FAILED",failed.getResultStatus());assertEquals("SUCCESS",passed.getResultStatus());assertNotEquals(failed.getId(),passed.getId());assertEquals(sections.get(0).getKey(),passed.getAssignmentSectionKey());assertEquals(task.getId(),passed.getAssignmentTaskId());assertEquals(2,resultCount());
    }
    @Test public void savedResultReceiptsReconcileCloudDraftsUsingTheRealMetadataQuery() throws Exception {
        TestResultDto result=save(submission(0,50,50,"draft-receipt"));
        Map<String,Object> payload=new LinkedHashMap<String,Object>();payload.put("userId",student.getId());payload.put("testId",source.getId());payload.put("testMode","COMPREHENSIVE");
        payload.put("sessionMode","SERIOUS");payload.put("assignmentTaskId",task.getId());payload.put("assignmentParts",Arrays.asList(1));payload.put("assignmentSectionKey",sections.get(0).getKey());payload.put("clientAttemptKey",result.getClientAttemptKey());
        LearningDraft draft=new LearningDraft();draft.setUser(student);draft.setDraftType("IELTS");draft.setDraftKey("ieltsReadingInProgress:"+student.getId()+":comprehensive:test:"+source.getId()+":serious:task:"+task.getId()+":parts:1:section:"+sections.get(0).getKey());
        draft.setPayload(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(payload));
        LearningDraftRepository repository=mock(LearningDraftRepository.class);when(repository.findByUser_IdOrderBySavedAtDesc(student.getId())).thenReturn(Arrays.asList(draft));ReflectionTestUtils.setField(saves,"learningDraftRepository",repository);
        List<LearningDraftDto> drafts=saves.getLearningDrafts();assertEquals(1,drafts.size());assertEquals(result.getId(),drafts.get(0).getSavedResult().get("id"));assertEquals(draft.getPayload(),drafts.get(0).getPayload());assertEquals(1,resultCount());
    }
    @Test public void unansweredQuestionsStayInTheFiftyQuestionDenominator() {
        assertEquals("FAILED",save(submission(0,42,42,"only42rows")).getResultStatus());assertEquals("SUCCESS",save(submission(0,43,43,"only43rows")).getResultStatus());assertEquals("FAILED",save(submission(0,0,0,"blanksection")).getResultStatus());
    }
    @Test public void missingUnknownForeignSectionAndSourceCannotCreateAssignmentEvidence() {
        TestResultDto dto=submission(0,50,50,"missingkey");dto.setAssignmentSectionKey(null);rejected(dto);dto=submission(0,50,50,"unknownkey");dto.setAssignmentSectionKey(UUID.randomUUID().toString());rejected(dto);
        EnrolmentClassScheduleTask other=assignment(source,50);dto=submission(0,50,50,"wrongtaskkey");dto.setAssignmentSectionKey(ComprehensiveAssignmentSections.read(other).get(0).getKey());rejected(dto);
        Question foreign=objectiveSource(1);dto=submission(0,50,50,"wrongsource");dto.setSourceQuestionId(foreign.getId());rejected(dto);assertEquals(0,resultCount());
    }
    @Test public void anotherSectionAnswerAndDuplicateQuestionAnswersAreRejected() {
        TestResultDto dto=submission(0,50,50,"othersectionanswer");dto.getQuestionAnswerTestResult().set(49,row(right.get(sections.get(1).getQuestionIds().get(0)),"Right"));rejected(dto);
        dto=submission(0,50,50,"duplicatequestion");Long first=sections.get(0).getQuestionIds().get(0);dto.getQuestionAnswerTestResult().add(row(wrong.get(first),"Wrong"));rejected(dto);assertEquals(0,resultCount());
    }
    @Test public void foreignClassStudentCannotSubmitAnOtherwiseValidSection() {
        EnrolmentClass other=new EnrolmentClass();other.setName("Other class");other.setSchoolId(2);em.persist(other);student.setEnrollmentClassIds(Collections.singleton(other.getId()));em.flush();TestResultDto dto=submission(0,50,50,"foreignclass");rejected(dto);assertEquals(0,resultCount());
    }
    @Test public void retryAcknowledgesSameSectionButCannotReuseItsReceiptForAnotherSection() {
        TestResultDto dto=submission(0,43,50,"retrysection"),first=save(dto),retry=save(dto);assertEquals(first.getId(),retry.getId());TestResultDto other=submission(1,50,50,"retrysection");rejected(other);assertEquals(1,resultCount());
        other.setClientAttemptKey(key("newsecondsection"));assertEquals("SUCCESS",save(other).getResultStatus());assertEquals(2,resultCount());
    }
    private long sectionCount(String section,LocalDateTime from,LocalDateTime to)throws Exception {
        String jpql=TestResultRepository.class.getMethod("countComprehensiveSectionAssignmentAttempts",Long.class,Long.class,Long.class,String.class,LocalDateTime.class,LocalDateTime.class).getAnnotation(org.springframework.data.jpa.repository.Query.class).value();
        return em.createQuery(jpql,Long.class).setParameter("studentId",student.getId()).setParameter("taskId",task.getId()).setParameter("testId",source.getId()).setParameter("sectionKey",section).setParameter("fromDate",from).setParameter("toDate",to).getSingleResult();
    }
    private TestResult evidence(Long assignedTask,Long test,String section,String status,LocalDateTime time) {
        TestResult r=new TestResult();r.setUser(student);r.setAssignmentTaskId(assignedTask);r.setSourceQuestionId(test);r.setAssignmentSectionKey(section);r.setCompletedParts(Collections.singletonList(1));r.setTestType(6);r.setResultStatus(status);em.persist(r);em.flush();r.setCreateDate(time);em.flush();return r;
    }
    @Test public void productionCompletionQueryKeepsSectionsLegacyWholeTestsAndFailedAttemptsSeparate()throws Exception {
        LocalDateTime from=LocalDateTime.now().minusDays(1),to=from.plusDays(2);String first=sections.get(0).getKey(),second=sections.get(1).getKey();
        save(submission(0,43,50,"querypart1"));save(submission(1,42,50,"querypart2failed"));save(submission(1,43,50,"querypart2passed"));
        evidence(task.getId(),source.getId(),null,"SUCCESS",from.plusHours(1));evidence(task.getId()+1,source.getId(),first,"SUCCESS",from.plusHours(1));evidence(task.getId(),source.getId()+1,first,"SUCCESS",from.plusHours(1));evidence(task.getId(),source.getId(),first,"SUCCESS",from.minusSeconds(1));evidence(task.getId(),source.getId(),first,"SUCCESS",to);
        assertEquals(1,sectionCount(first,from,to));assertEquals(1,sectionCount(second,from,to));
        String jpql=TestResultRepository.class.getMethod("countIeltsPartAssignmentAttempts",Long.class,Long.class,Long.class,Integer.class,String.class,Integer.class,LocalDateTime.class,LocalDateTime.class).getAnnotation(org.springframework.data.jpa.repository.Query.class).value();
        long legacy=em.createQuery(jpql,Long.class).setParameter("studentId",student.getId()).setParameter("taskId",task.getId()).setParameter("testId",source.getId()).setParameter("part",1).setParameter("partToken","%,1,%").setParameter("testType",6).setParameter("fromDate",from).setParameter("toDate",to).getSingleResult();assertEquals(1,legacy);
    }
    @Test public void unrelatedWritingAndListeningBlocksDoNotFailTheSelectedObjectiveSection() {
        Question mixed=question(null,0,1);mixed.setTestFormat("COMPREHENSIVE");Question part=question(mixed,0,1),first=question(part,1,1);for(int i=1;i<=50;i++){Question q=question(first,0,i);right.put(q.getId(),choice(q,true,"Right",1));wrong.put(q.getId(),choice(q,false,"Wrong",2));}
        Question writing=question(part,16,2),essay=question(writing,0,51);choice(essay,true,"Writing",1);
        Question listening=question(part,18,3);listening.setMotherTongue("one two three four five six seven eight nine ten");Question response=question(listening,0,52);choice(response,true,ComprehensiveListeningScore.RESPONSE,1);
        Question last=question(part,1,4);for(int i=53;i<=102;i++){Question q=question(last,0,i);right.put(q.getId(),choice(q,true,"Right",1));wrong.put(q.getId(),choice(q,false,"Wrong",2));}
        source=mixed;task=assignment(source,50);sections=ComprehensiveAssignmentSections.read(task);assertEquals(50,sections.get(0).getQuestionCount());assertEquals("SUCCESS",save(submission(0,43,50,"selectedobjectiveonly")).getResultStatus());
    }
    @Test public void sharedMultipleAnswerBankAcceptsDifferentCorrectOptionsAtTheirCanonicalOrdinals() {
        Question multiple=question(null,0,1);multiple.setTestFormat("COMPREHENSIVE");Question part=question(multiple,0,1),pack=question(part,5,1),first=question(pack,0,1),second=question(pack,0,2);
        QuestionAnswer a=choice(first,true,"A",1),c=choice(first,true,"C",3);choice(first,false,"B",2);choice(second,true,"A",1);choice(second,false,"B",2);choice(second,true,"C",3);
        source=multiple;task=assignment(source,2);sections=ComprehensiveAssignmentSections.read(task);TestResultDto dto=submission(0,2,0,"sharedcorrectoptions");QuestionAnswerTestResultDto firstRow=row(a,"A"),secondRow=row(c,"C");secondRow.setOrdinalNumber(2);dto.setQuestionAnswerTestResult(new ArrayList<QuestionAnswerTestResultDto>(Arrays.asList(firstRow,secondRow)));
        TestResultDto saved=save(dto);assertEquals("SUCCESS",saved.getResultStatus());assertEquals(sections.get(0).getKey(),saved.getAssignmentSectionKey());assertEquals(2,em.find(TestResult.class,saved.getId()).getQuestionAnswerTestResult().size());
    }
    @Test public void sharedMatchingBankIsGradedAgainstEachTargetQuestionRatherThanTheBanksFirstQuestion() {
        Question matching=question(null,0,1);matching.setTestFormat("COMPREHENSIVE");Question part=question(matching,0,1),pack=question(part,10,1),first=question(pack,0,1),second=question(pack,0,2);
        QuestionAnswer firstA=choice(first,true,"A",1),firstB=choice(first,false,"B",2);choice(second,false,"A",1);choice(second,true,"B",2);
        source=matching;task=assignment(source,2);sections=ComprehensiveAssignmentSections.read(task);TestResultDto dto=submission(0,2,0,"matchingbanktargetcorrectness");QuestionAnswerTestResultDto firstRow=row(firstA,"A"),secondRow=row(firstA,"A");secondRow.setOrdinalNumber(2);dto.setQuestionAnswerTestResult(new ArrayList<QuestionAnswerTestResultDto>(Arrays.asList(firstRow,secondRow)));
        assertEquals("FAILED",save(dto).getResultStatus());
        dto=submission(0,2,0,"matchingbankrightfortarget");firstRow=row(firstA,"A");secondRow=row(firstB,"B");secondRow.setOrdinalNumber(2);dto.setQuestionAnswerTestResult(new ArrayList<QuestionAnswerTestResultDto>(Arrays.asList(firstRow,secondRow)));assertEquals("SUCCESS",save(dto).getResultStatus());
    }
    private EnrolmentClassScheduleTask configure(EnrolmentClassScheduleTask old,EnrolmentClassScheduleTaskDto input,Question selectedSource) {
        EnrolmentClassScheduleTask value=new EnrolmentClassScheduleTask();ReflectionTestUtils.invokeMethod(schedules,"prepareComprehensiveConfiguration",value,old,input,selectedSource);return value;
    }
    @Test public void legacyClientsKeepSavedSectionsAndExplicitTimeChangesKeepTheirKeys() {
        EnrolmentClassScheduleTask untouched=configure(task,new EnrolmentClassScheduleTaskDto(),source);assertEquals(task.getComprehensiveSectionsJson(),untouched.getComprehensiveSectionsJson());assertEquals(Integer.valueOf(0),untouched.getComprehensiveTimeLimitMinutes());
        EnrolmentClassScheduleTaskDto input=new EnrolmentClassScheduleTaskDto();input.setComprehensiveQuestionLimit(50);input.setComprehensiveTimeLimitMinutes(30);input.setComprehensiveSections(ComprehensiveAssignmentSections.read(task));input.getComprehensiveSections().get(0).setDurationMinutes(10);input.getComprehensiveSections().get(1).setDurationMinutes(0);
        List<ComprehensiveAssignmentSectionDto> changed=ComprehensiveAssignmentSections.read(configure(task,input,source));assertEquals(sections.get(0).getKey(),changed.get(0).getKey());assertEquals(Integer.valueOf(10),changed.get(0).getDurationMinutes());assertEquals(Integer.valueOf(0),changed.get(1).getDurationMinutes());
    }
    @Test public void clientQuestionIdsAreOnlyComparedToTheAuthoritativePlanAndCannotReplaceIt() {
        EnrolmentClassScheduleTaskDto input=new EnrolmentClassScheduleTaskDto();input.setComprehensiveQuestionLimit(50);input.setComprehensiveTimeLimitMinutes(20);List<ComprehensiveAssignmentSectionDto> choices=ComprehensiveAssignmentSections.plan(source,50,20);String clientKey=choices.get(0).getKey();input.setComprehensiveSections(choices);
        EnrolmentClassScheduleTask saved=configure(null,input,source);assertNotEquals(clientKey,ComprehensiveAssignmentSections.read(saved).get(0).getKey());assertEquals(sections.get(0).getQuestionIds(),ComprehensiveAssignmentSections.read(saved).get(0).getQuestionIds());
        choices.get(0).getQuestionIds().set(0,Long.MAX_VALUE);try{configure(null,input,source);fail("Expected stale/forged preview rejection");}catch(EnrolmentClassScheduleException expected){}
    }
    @Test public void existingResultsPreventRepartitionButStillAllowUntimedSettingsOnUnsplitAssignments() {
        when(results.countByAssignmentTaskId(task.getId())).thenReturn(1L);EnrolmentClassScheduleTaskDto input=new EnrolmentClassScheduleTaskDto();input.setComprehensiveQuestionLimit(25);input.setComprehensiveTimeLimitMinutes(0);try{configure(task,input,source);fail("Expected history-preserving layout rejection");}catch(EnrolmentClassScheduleException expected){}
        EnrolmentClassScheduleTask legacy=new EnrolmentClassScheduleTask();legacy.setActivityType("COMPREHENSIVE");legacy.setIeltsTest(source);input=new EnrolmentClassScheduleTaskDto();input.setComprehensiveQuestionLimit(null);input.setComprehensiveTimeLimitMinutes(0);EnrolmentClassScheduleTask untimed=configure(legacy,input,source);assertEquals(Integer.valueOf(0),untimed.getComprehensiveTimeLimitMinutes());assertNull(untimed.getComprehensiveQuestionLimit());assertTrue(ComprehensiveAssignmentSections.read(untimed).isEmpty());
    }
}
