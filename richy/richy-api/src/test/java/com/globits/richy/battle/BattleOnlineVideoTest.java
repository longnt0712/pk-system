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

public class BattleOnlineVideoTest {
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
        Map<String,List<String>> values=new LinkedHashMap<String,List<String>>();
        values.put(q.getExercise().items.get(0).id,Collections.singletonList(q.getExercise().items.get(0).options.get(0).getKey()));
        d.setExerciseAnswers(values); return d;
    }
    private void rejected(Runnable action) { try { action.run(); fail("Must reject"); } catch(BattleOnlineException expected) {} }

    @Test public void allModesPreloadHideAndKeepAnswerWindowOpenWhileAStudentHasNotSubmitted() throws Exception {
        for (String mode : Arrays.asList("CLASSIC","GUESS_WORD","COUNTDOWN","MONEY_BEG","ESCAPE_DUMB_DEMON","DEMON_DEFENSE","LUM_NGAY")) {
            setup(mode);
            BattleOnlineRoomDto initial=service.getRoom("VIDEO1","alice");
            assertTrue(mode,initial.isVideoSynchronized()); assertEquals("WATCHING",initial.getVideoPhase());
            assertNotNull(initial.getCurrentQuestion()); assertEquals(0,initial.getQuestionEndsAt());
            assertEquals(Long.valueOf(200),initial.getCurrentQuestion().getId());
            rejected(() -> service.answer("VIDEO1","alice",answer()));
            rejected(() -> service.videoEvent("VIDEO1","alice",event("CUE",1,5)));
            rejected(() -> service.videoEvent("VIDEO1","host",event("CUE",1,1)));
            long now=System.currentTimeMillis(); BattleOnlineRoomDto opened=service.videoEvent("VIDEO1","host",event("CUE",1,5));
            assertEquals("ANSWERING",opened.getVideoPhase()); assertTrue(opened.getQuestionEndsAt()>=now+19000);
            assertTrue(opened.getQuestionEndsAt()<=System.currentTimeMillis()+20000);
            long deadline=opened.getQuestionEndsAt();
            assertEquals(deadline,service.videoEvent("VIDEO1","host",event("CUE",1,5)).getQuestionEndsAt());
            BattleOnlineAnswerDto request=answer(); assertTrue(mode,service.answer("VIDEO1","alice",request).isCorrect());
            rejected(() -> service.answer("VIDEO1","alice",request));
            ReflectionTestUtils.invokeMethod(service,"advanceClassicQuestion","VIDEO1",0);
            assertEquals(1,service.getRoom("VIDEO1","host").getCurrentQuestionIndex());
            set(room,"questionEndsAt",System.currentTimeMillis()-1);
            ReflectionTestUtils.invokeMethod(service,"advanceClassicQuestion","VIDEO1",0);
            BattleOnlineRoomDto next=service.getRoom("VIDEO1","alice");
            assertEquals("WATCHING",next.getVideoPhase()); assertEquals(2,next.getCurrentQuestionIndex());
            assertFalse(next.getPlayers().stream().filter(p->"alice".equals(p.getUsername())).findFirst().get().isAnsweredCurrentQuestion());
            rejected(() -> service.videoEvent("VIDEO1","host",event("CUE",1,10)));
            long before=System.currentTimeMillis(); BattleOnlineRoomDto second=service.videoEvent("VIDEO1","host",event("CUE",2,10));
            assertTrue(second.getQuestionEndsAt()>=before+34000);
            service.destroy(); service=null;
        }
    }

    @Test public void allModesResumeImmediatelyAfterAllAnswersAndWrongAnswersDoNotFreezeVideoPlayers() throws Exception {
        for (String mode : Arrays.asList("CLASSIC","GUESS_WORD","COUNTDOWN","MONEY_BEG","ESCAPE_DUMB_DEMON","DEMON_DEFENSE","LUM_NGAY")) {
            setup(mode);
            BattleOnlineRoomDto opened=service.videoEvent("VIDEO1","host",event("CUE",1,5));
            BattleOnlineAnswerDto correct=answer(), wrong=answer();
            wrong.getExerciseAnswers().replaceAll((key,value) -> Collections.singletonList("wrong"));
            BattleOnlineAnswerResultDto first=service.answer("VIDEO1","alice",wrong);
            assertFalse(mode,first.isCorrect()); assertEquals("SAI RỒI!",first.getMessage());
            assertEquals(mode,0L,first.getRoom().getWrongAnswerPenaltyUntil());
            assertEquals(mode,0L,(long)get(alice,"wrongAnswerPenaltyUntil"));
            assertEquals(mode,0L,(long)get(alice,"frozenUntil"));
            assertEquals(mode,"ANSWERING",first.getRoom().getVideoPhase());
            assertEquals(opened.getQuestionEndsAt(),first.getRoom().getQuestionEndsAt());
            assertTrue(first.getRoom().getPlayers().stream().filter(p->"alice".equals(p.getUsername())).findFirst().get().isAnsweredCurrentQuestion());
            rejected(() -> service.answer("VIDEO1","alice",wrong));
            assertTrue(System.currentTimeMillis()<opened.getQuestionEndsAt());
            BattleOnlineRoomDto resumed=service.answer("VIDEO1","bob",correct).getRoom();
            assertEquals(mode,"WATCHING",resumed.getVideoPhase());
            assertEquals(mode,2,resumed.getCurrentQuestionIndex()); assertEquals(0L,resumed.getQuestionEndsAt());
            assertEquals(1,(int)get(alice,"wrongCount"));
            // A timer from the completed answer window cannot skip the next cue.
            ReflectionTestUtils.invokeMethod(service,"advanceClassicQuestion","VIDEO1",0);
            assertEquals(2,service.getRoom("VIDEO1","host").getCurrentQuestionIndex());
            service.videoEvent("VIDEO1","host",event("CUE",2,10));
            BattleOnlineAnswerDto finalCorrect=answer(), finalWrong=answer();
            finalWrong.getExerciseAnswers().replaceAll((key,value) -> Collections.singletonList("wrong"));
            service.answer("VIDEO1","alice",finalCorrect);
            assertEquals(mode,"FINISHED",service.answer("VIDEO1","bob",finalWrong).getRoom().getStatus());
            service.destroy(); service=null;
        }
    }

    @Test public void spectatorsAndDisconnectedStudentsDoNotPreventEarlyResume() throws Exception {
        setup("COUNTDOWN");
        service.leaveRoom("VIDEO1","bob");
        service.videoEvent("VIDEO1","host",event("CUE",1,5));
        assertEquals("WATCHING",service.answer("VIDEO1","alice",answer()).getRoom().getVideoPhase());
        assertEquals(2,service.getRoom("VIDEO1","host").getCurrentQuestionIndex());
    }

    @Test public void leavingTheLastUnansweredStudentResumesVideoForTheRemainingClass() throws Exception {
        setup("COUNTDOWN");
        service.videoEvent("VIDEO1","host",event("CUE",1,5));
        service.answer("VIDEO1","alice",answer());
        assertEquals("WATCHING",service.leaveRoom("VIDEO1","bob").getVideoPhase());
        assertEquals(2,service.getRoom("VIDEO1","host").getCurrentQuestionIndex());
    }

    @Test public void finalQuestionEndsTheMatchWithoutWaitingForTheRemainingVideoOrAMatchTimer() throws Exception {
        setup("COUNTDOWN"); service.videoEvent("VIDEO1","host",event("CUE",1,5));
        set(room,"questionEndsAt",System.currentTimeMillis()-1); ReflectionTestUtils.invokeMethod(service,"advanceClassicQuestion","VIDEO1",0);
        service.videoEvent("VIDEO1","host",event("PROGRESS",2,8));
        assertEquals(8D,service.getRoom("VIDEO1","host").getVideoPositionSeconds(),0D);
        service.videoEvent("VIDEO1","host",event("CUE",2,10));
        BattleOnlineAnswerDto finalAnswer=answer();
        set(room,"questionEndsAt",System.currentTimeMillis()-1); ReflectionTestUtils.invokeMethod(service,"advanceClassicQuestion","VIDEO1",1);
        assertEquals("FINISHED",service.getRoom("VIDEO1","host").getStatus());
        assertEquals(0L,service.getRoom("VIDEO1","host").getMatchEndsAt());
        rejected(() -> service.answer("VIDEO1","alice",finalAnswer));
        rejected(() -> service.videoEvent("VIDEO1","host",event("ENDED",2,15)));
    }

    @Test public void videoOrderIsChronologicalEvenIfQuestionShuffleWasRequested() {
        QuestionDto test=test(); List<QuestionDto> qs=test.getSubQuestions().get(0).getSubQuestions().get(0).getSubQuestions();
        qs.get(0).setVideoTimeSeconds(40); qs.get(1).setVideoTimeSeconds(10);
        List<BattleExerciseQuestions.Turn> turns=BattleExerciseQuestions.fromTest(test);
        assertEquals(Long.valueOf(201),turns.get(0).id); assertEquals(35,turns.get(0).content.videoAnswerSeconds);
        assertEquals(20,turns.get(1).content.videoAnswerSeconds);
    }

    @Test public void demonClockPausesDuringFootageAndResumesOnlyDuringAnswerWindows() throws Exception {
        setup("DEMON_DEFENSE"); long now=System.currentTimeMillis();
        long frozen=ReflectionTestUtils.invokeMethod(service,"demonGameTime",room,now);
        assertEquals(frozen,(long)ReflectionTestUtils.invokeMethod(service,"demonGameTime",room,now+60000L));
        ReflectionTestUtils.invokeMethod(service,"advanceDemonDefenseLocked",room,now+60000L);
        assertEquals("PLAYING",service.getRoom("VIDEO1","host").getStatus());
        service.videoEvent("VIDEO1","host",event("CUE",1,5));
        long active=ReflectionTestUtils.invokeMethod(service,"demonGameTime",room,now);
        assertEquals(active+1000L,(long)ReflectionTestUtils.invokeMethod(service,"demonGameTime",room,now+1000L));
        set(room,"questionEndsAt",System.currentTimeMillis()-1);
        ReflectionTestUtils.invokeMethod(service,"advanceClassicQuestion","VIDEO1",0);
        long second=ReflectionTestUtils.invokeMethod(service,"demonGameTime",room,now);
        assertEquals(second,(long)ReflectionTestUtils.invokeMethod(service,"demonGameTime",room,now+60000L));
    }

    @Test public void groupedVideoQuestionsInheritTheirCueButCanOverrideTheAnswerDuration() {
        QuestionDto test=test(), group=test.getSubQuestions().get(0).getSubQuestions().get(0);
        group.setType(2); group.setVideoTimeSeconds(12); group.setVideoAnswerSeconds(25);
        List<BattleExerciseQuestions.Turn> turns=BattleExerciseQuestions.fromTest(test);
        assertEquals(Integer.valueOf(12),turns.get(0).content.videoTimeSeconds);
        assertEquals(25,turns.get(0).content.videoAnswerSeconds);
        assertEquals(35,turns.get(1).content.videoAnswerSeconds);
    }
}
