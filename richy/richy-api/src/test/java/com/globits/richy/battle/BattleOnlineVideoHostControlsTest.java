package com.globits.richy.battle;

import com.globits.richy.dto.*;
import com.globits.richy.service.BattleOnlineException;
import com.globits.richy.service.impl.BattleOnlineServiceImpl;
import java.lang.reflect.Constructor;
import java.util.*;
import org.junit.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class BattleOnlineVideoHostControlsTest {
    private BattleOnlineServiceImpl service;
    private Object room, alice;
    private Object state(String name) throws Exception {
        Constructor<?> c = Class.forName(BattleOnlineServiceImpl.class.getName() + "$" + name).getDeclaredConstructor();
        c.setAccessible(true); return c.newInstance();
    }
    private void set(Object o, String name, Object value) { ReflectionTestUtils.setField(o, name, value); }
    private Object get(Object o, String name) { return ReflectionTestUtils.getField(o, name); }
    private Object player(String name, boolean spectator, int team) throws Exception {
        Object p = state("PlayerState"); set(p,"username",name); set(p,"displayName",name);
        set(p,"connected",true); set(p,"ready",true); set(p,"spectator",spectator); set(p,"teamNumber",team); return p;
    }
    private QuestionDto test() {
        QuestionDto test = new QuestionDto(), part = new QuestionDto(), group = new QuestionDto();
        test.setSubQuestions(new ArrayList<QuestionDto>()); part.setSubQuestions(new ArrayList<QuestionDto>());
        group.setSubQuestions(new ArrayList<QuestionDto>());
        test.setId(100L); test.setTestFormat("COMPREHENSIVE");
        QuestionTypeDto type = new QuestionTypeDto(); type.setId(11L); test.setQuestionType(type);
        part.setId(101L); part.setVideoUrl("https://youtu.be/dQw4w9WgXcQ"); group.setType(1);
        for (int i=0; i<2; i++) {
            QuestionDto q = new QuestionDto(); q.setId(200L+i); q.setQuestion("Question " + i); q.setOrdinalNumber(i+1);
            q.setVideoTimeSeconds(5+i*5); if (i==1) { q.setVideoAnswerSeconds(35); }
            AnswerDto text = new AnswerDto(); text.setAnswer("yes");
            QuestionAnswerDto answer = new QuestionAnswerDto(); answer.setAnswer(text); answer.setCorrect(true);
            q.setQuestionAnswers(Collections.singletonList(answer));
            group.getSubQuestions().add(q);
        }
        part.getSubQuestions().add(group); test.getSubQuestions().add(part); return test;
    }
    @SuppressWarnings("unchecked") private void setup(String mode) throws Exception {
        service = new BattleOnlineServiceImpl(); set(service,"messagingTemplate",mock(SimpMessagingTemplate.class));
        room = state("RoomState"); set(room,"code","VIDEO1"); set(room,"status","LOBBY"); set(room,"hostUsername","host");
        Object settings = get(room,"settings"); set(settings,"mode",mode); set(settings,"skillsEnabled",false); set(settings,"questionCount",2);
        set(settings,"shuffleExerciseQuestions",true); set(settings,"teamCount",2);
        alice=player("alice",false,1); Object bob=player("bob",false,2), host=player("host",true,1); set(host,"host",true);
        Map<String,Object> players=(Map<String,Object>)get(room,"players"); players.put("host",host); players.put("alice",alice); players.put("bob",bob);
        ReflectionTestUtils.invokeMethod(service,"setExerciseSourceLocked",room,Collections.singletonList(100L),BattleExerciseQuestions.fromTest(test()));
        ((Map<String,Object>)get(service,"rooms")).put("VIDEO1",room);
        service.startMatch("VIDEO1","host");
        // Money mode still has its usual password setup; complete it before testing answer pacing.
        set(alice,"passwordSelectionRequired",false); set(bob,"passwordSelectionRequired",false);
    }
    @After public void cleanup() { if (service != null) { service.destroy(); } }
    private BattleOnlineVideoDto event(String kind, long sequence, double seconds) {
        BattleOnlineVideoDto d = new BattleOnlineVideoDto(); d.event=kind; d.questionSequence=sequence; d.seconds=seconds; return d;
    }
    private BattleOnlineAnswerDto answer() {
        BattleOnlineRoomDto snapshot=service.getRoom("VIDEO1","alice");
        BattleOnlineQuestionDto q=snapshot.getCurrentQuestion(); BattleOnlineAnswerDto d=new BattleOnlineAnswerDto();
        d.setQuestionId(q.getId()); d.setQuestionSequence(q.getSequence()); d.setAnswerKey("EXERCISE");
        d.setVideoQuestionRound(snapshot.getVideoQuestionRound());
        Map<String,List<String>> values=new LinkedHashMap<String,List<String>>();
        values.put(q.getExercise().items.get(0).id,Collections.singletonList(q.getExercise().items.get(0).options.get(0).getKey()));
        d.setExerciseAnswers(values); return d;
    }
    private void rejected(Runnable action) { try { action.run(); fail("Must reject"); } catch(BattleOnlineException expected) {} }


    private static final List<String> MODES = Arrays.asList("CLASSIC","GUESS_WORD","COUNTDOWN","MONEY_BEG","ESCAPE_DUMB_DEMON","DEMON_DEFENSE","LUM_NGAY");
    private BattleOnlineClassicControlDto control(boolean enabled, long sequence, long deadline, long round) {
        BattleOnlineClassicControlDto c = new BattleOnlineClassicControlDto();
        c.setAutoAdvance(enabled); c.setQuestionSequence(sequence); c.setQuestionEndsAt(deadline); c.setVideoQuestionRound(round); return c;
    }
    private long expire() {
        long deadline=System.currentTimeMillis()-1L;set(room,"questionEndsAt",deadline);
        ReflectionTestUtils.invokeMethod(service,"advanceClassicQuestion","VIDEO1",(Integer)get(room,"classicQuestionIndex"));return deadline;
    }
    private BattleOnlineClassicAnswerDto row(BattleOnlineVideoReviewDto review,String username) {
        return review.studentAnswers.stream().filter(r->username.equals(r.getUsername())).findFirst().get();
    }
    private void reset() { service.destroy();service=null; }

    @Test public void everyVideoModeCanHoldReviewAndHostNextWithoutRevealingBeforeExpiry() throws Exception {
        for(String mode:MODES) {
            setup(mode);rejected(()->service.setClassicAutoAdvance("VIDEO1","alice",control(false,1,0,0)));
            service.setClassicAutoAdvance("VIDEO1","host",control(false,1,0,0));
            BattleOnlineRoomDto opened=service.videoEvent("VIDEO1","host",event("CUE",1,5));
            BattleOnlineAnswerDto correct=answer(),wrong=answer();wrong.getExerciseAnswers().replaceAll((k,v)->Collections.singletonList("wrong"));
            service.answer("VIDEO1","alice",correct);service.answer("VIDEO1","bob",wrong);
            BattleOnlineRoomDto before=service.getRoom("VIDEO1","host");
            assertEquals(mode,"ANSWERING",before.getVideoPhase());assertEquals(mode,1,before.getCurrentQuestionIndex());
            assertFalse(mode,before.isClassicAnswerRevealed());assertNull(mode,before.getVideoReview());assertTrue(before.getClassicStudentAnswers().isEmpty());
            rejected(()->service.nextClassicQuestion("VIDEO1","host",control(false,1,opened.getQuestionEndsAt(),0)));
            long deadline=expire();BattleOnlineRoomDto held=service.getRoom("VIDEO1","host");
            assertTrue(mode,held.isClassicAnswerRevealed());assertEquals(mode,"ANSWERING",held.getVideoPhase());
            assertEquals(mode,1,held.getCurrentQuestionIndex());assertTrue(mode,held.getClassicCorrectAnswer().contains("yes"));
            BattleOnlineVideoReviewDto review=held.getVideoReview();assertNotNull(mode,review);assertEquals(1L,review.questionSequence);
            assertEquals(0L,review.videoQuestionRound);assertEquals("100:101",review.videoSourceId);assertEquals(2,review.studentAnswers.size());
            assertTrue(row(review,"alice").isCorrect());assertTrue(row(review,"alice").getAnswer().contains("yes"));
            assertTrue(row(review,"bob").isAnswered());assertFalse(row(review,"bob").isCorrect());assertTrue(row(review,"bob").getAnswer().contains("wrong"));
            assertFalse(review.studentAnswers.stream().anyMatch(r->"host".equals(r.getUsername())));
            assertNull(mode,service.getRoom("VIDEO1","alice").getVideoReview());
            BattleOnlineRoomDto broadcast=ReflectionTestUtils.invokeMethod(service,"snapshotLocked",room,(String)null);assertNull(mode,broadcast.getVideoReview());
            assertEquals(mode,2,held.getClassicStudentAnswers().size());
            assertTrue(mode,service.getRoom("VIDEO1","alice").getClassicStudentAnswers().isEmpty());
            assertTrue(mode,broadcast.getClassicStudentAnswers().isEmpty());
            rejected(()->service.answer("VIDEO1","alice",correct));
            rejected(()->service.nextClassicQuestion("VIDEO1","alice",control(false,1,deadline,0)));
            rejected(()->service.nextClassicQuestion("VIDEO1","host",control(false,1,deadline-1L,0)));
            BattleOnlineRoomDto next=service.nextClassicQuestion("VIDEO1","host",control(false,1,deadline,0));
            assertEquals(mode,"WATCHING",next.getVideoPhase());assertEquals(mode,2,next.getCurrentQuestionIndex());
            assertFalse(next.isClassicAnswerRevealed());assertTrue(next.getClassicStudentAnswers().isEmpty());assertEquals(1L,next.getVideoReview().questionSequence);
            rejected(()->service.nextClassicQuestion("VIDEO1","host",control(false,1,deadline,0)));
            service.videoEvent("VIDEO1","host",event("CUE",2,10));long last=expire();
            BattleOnlineVideoReviewDto unanswered=service.getRoom("VIDEO1","host").getVideoReview();
            assertEquals(2L,unanswered.questionSequence);assertTrue(unanswered.studentAnswers.stream().noneMatch(BattleOnlineClassicAnswerDto::isAnswered));
            BattleOnlineRoomDto done=service.nextClassicQuestion("VIDEO1","host",control(false,2,last,0));
            assertEquals(2L,done.getVideoReview().questionSequence);assertNull(service.getRoom("VIDEO1","bob").getVideoReview());
            reset();
        }
    }

    @Test public void autoRetainsPrivateAnswersAfterAdvancingAndAfterTheFinalVideoQuestion() throws Exception {
        for(String mode:MODES) {
            setup(mode);service.videoEvent("VIDEO1","host",event("CUE",1,5));
            BattleOnlineAnswerDto first=answer(),wrong=answer();wrong.getExerciseAnswers().replaceAll((k,v)->Collections.singletonList("wrong"));
            service.answer("VIDEO1","alice",first);service.answer("VIDEO1","bob",wrong);
            BattleOnlineRoomDto host=service.getRoom("VIDEO1","host");assertEquals(mode,2,host.getCurrentQuestionIndex());
            BattleOnlineVideoReviewDto review=host.getVideoReview();assertNotNull(mode,review);assertEquals(1L,review.questionSequence);
            assertTrue(row(review,"alice").isCorrect());assertFalse(row(review,"bob").isCorrect());
            assertNull(service.getRoom("VIDEO1","alice").getVideoReview());
            assertNull(((BattleOnlineRoomDto)ReflectionTestUtils.invokeMethod(service,"snapshotLocked",room,(String)null)).getVideoReview());
            review.correctAnswer="tampered";review.studentAnswers.clear();
            assertTrue(service.getRoom("VIDEO1","host").getVideoReview().correctAnswer.contains("yes"));
            assertEquals(2,service.getRoom("VIDEO1","host").getVideoReview().studentAnswers.size());
            service.videoEvent("VIDEO1","host",event("CUE",2,10));service.answer("VIDEO1","alice",answer());service.answer("VIDEO1","bob",answer());
            BattleOnlineRoomDto finalHost=service.getRoom("VIDEO1","host");
            assertEquals(mode,2L,finalHost.getVideoReview().questionSequence);
            assertTrue(finalHost.getVideoReview().studentAnswers.stream().allMatch(BattleOnlineClassicAnswerDto::isCorrect));
            if(!"LUM_NGAY".equals(mode)){assertEquals(mode,"FINISHED",finalHost.getStatus());}
            reset();
        }
    }

    @Test public void reopenClearsReviewAndRejectsDelayedAutoOrNextRequestsEvenForTheSameCue() throws Exception {
        for(String mode:MODES) {
            setup(mode);service.videoEvent("VIDEO1","host",event("CUE",1,5));service.answer("VIDEO1","alice",answer());service.answer("VIDEO1","bob",answer());
            BattleOnlineVideoDto reopen=event("REOPEN",2,5);reopen.targetQuestionSequence=1;reopen.videoSourceId="100:101";
            BattleOnlineRoomDto opened=service.videoEvent("VIDEO1","host",reopen);assertNull(opened.getVideoReview());assertEquals(1L,opened.getVideoQuestionRound());
            if("GUESS_WORD".equals(mode)) {
                BattleOnlineRoomDto student=service.getRoom("VIDEO1","alice");assertNull(student.getLastGuessWord());assertTrue(student.getLastGuessAnswers().isEmpty());
            }
            BattleOnlineClassicControlDto stale=control(false,1,opened.getQuestionEndsAt(),0);
            rejected(()->service.setClassicAutoAdvance("VIDEO1","host",stale));
            service.setClassicAutoAdvance("VIDEO1","host",control(false,1,0,1));long deadline=expire();
            rejected(()->service.nextClassicQuestion("VIDEO1","host",control(false,1,deadline,0)));
            assertEquals(1,service.getRoom("VIDEO1","host").getCurrentQuestionIndex());
            assertEquals(1L,service.getRoom("VIDEO1","host").getVideoReview().videoQuestionRound);
            service.nextClassicQuestion("VIDEO1","host",control(false,1,deadline,1));
            rejected(()->service.setClassicAutoAdvance("VIDEO1","host",control(true,1,0,1)));
            reset();
        }
    }

    @Test public void restoringAutoDuringReviewContinuesAllVideoModesWithoutDroppingTheirReview() throws Exception {
        for(String mode:MODES) {
            setup(mode);service.setClassicAutoAdvance("VIDEO1","host",control(false,1,0,0));
            service.videoEvent("VIDEO1","host",event("CUE",1,5));service.answer("VIDEO1","alice",answer());
            expire();BattleOnlineRoomDto resumed=service.setClassicAutoAdvance("VIDEO1","host",control(true,1,0,0));
            assertTrue(mode,resumed.isClassicAutoAdvance());assertEquals(mode,"WATCHING",resumed.getVideoPhase());assertEquals(mode,2,resumed.getCurrentQuestionIndex());
            assertNotNull(mode,resumed.getVideoReview());assertTrue(row(resumed.getVideoReview(),"alice").isAnswered());
            assertFalse(row(resumed.getVideoReview(),"bob").isAnswered());reset();
        }
    }

    @Test public void manualDemonReviewPausesTheGameClockUntilTheHostResumes() throws Exception {
        setup("DEMON_DEFENSE");service.setClassicAutoAdvance("VIDEO1","host",control(false,1,0,0));
        service.videoEvent("VIDEO1","host",event("CUE",1,5));expire();
        long now=System.currentTimeMillis();long frozen=ReflectionTestUtils.invokeMethod(service,"demonGameTime",room,now);
        assertEquals(frozen,(long)ReflectionTestUtils.invokeMethod(service,"demonGameTime",room,now+60000));
        assertTrue(service.getRoom("VIDEO1","host").isClassicAnswerRevealed());
        service.setClassicAutoAdvance("VIDEO1","host",control(true,1,0,0));
        assertEquals("WATCHING",service.getRoom("VIDEO1","host").getVideoPhase());
        service.videoEvent("VIDEO1","host",event("CUE",2,10));
        long active=ReflectionTestUtils.invokeMethod(service,"demonGameTime",room,now);
        assertEquals(active+1000,(long)ReflectionTestUtils.invokeMethod(service,"demonGameTime",room,now+1000));
    }
}
