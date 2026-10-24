package com.globits.richy.battle;

import com.globits.richy.dto.*;
import com.globits.richy.service.BattleOnlineException;
import com.globits.richy.service.impl.BattleOnlineServiceImpl;
import java.lang.reflect.Constructor;
import java.util.*;
import java.util.concurrent.*;
import org.junit.*;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class BattleOnlineHackTimeoutTest {
    private BattleOnlineServiceImpl service;
    private Object room, actor, target;
    private ScheduledExecutorService scheduler;
    private Object state(String type) throws Exception {
        Constructor<?> c = Class.forName(BattleOnlineServiceImpl.class.getName() + "$" + type).getDeclaredConstructor();
        c.setAccessible(true);return c.newInstance();
    }
    private void set(Object o,String field,Object value) { ReflectionTestUtils.setField(o,field,value); }
    private Object get(Object o,String field) { return ReflectionTestUtils.getField(o,field); }
    private Object player(String username) throws Exception {
        Object player = state("PlayerState"); set(player,"username",username);set(player,"displayName",username);
        set(player,"connected",true);set(player,"ready",true);set(player,"currentPassword","secret-" + username);
        return player;
    }
    @Before @SuppressWarnings("unchecked") public void setup() throws Exception {
        service = new BattleOnlineServiceImpl(); scheduler = mock(ScheduledExecutorService.class);
        when(scheduler.schedule(any(Runnable.class),anyLong(),eq(TimeUnit.MILLISECONDS))).thenReturn(mock(ScheduledFuture.class));
        set(service,"scheduler",scheduler);set(service,"messagingTemplate",mock(SimpMessagingTemplate.class));
        room = state("RoomState");set(room,"code","HACK01");set(room,"status","PLAYING");set(room,"hostUsername","host");
        set(room,"allQuestionsLoaded",true);set(room,"matchEndsAt",System.currentTimeMillis() + 60000L);
        set(get(room,"settings"),"mode","MONEY_BEG");
        actor = player("alice"); target = player("bob");set(actor,"score",20D);set(target,"score",100D);
        set(actor,"pendingSkillType","MONEY_BEG");
        ((List<String>)get(actor,"pendingSkillTargetUsernames")).add("bob");
        Map<String,Object> players = (Map<String,Object>)get(room,"players");players.put("alice",actor);players.put("bob",target);
        Object question = state("QuestionState");set(question,"id",7L);set(question,"question","Next question");
        set(question,"correctKey","A");set(question,"correctText","Next answer");
        ((Map<Long,Object>)get(room,"preparedQuestions")).put(7L,question);
        ((List<Long>)get(room,"countdownQuestionIds")).add(7L);
        ((Map<String,Object>)get(service,"rooms")).put("HACK01",room);
    }
    @After public void cleanup() { service.destroy(); }
    private BattleOnlineRoomDto openGuess() {
        BattleOnlineUseSkillDto request = new BattleOnlineUseSkillDto();request.setTargetUsername("bob");
        return service.useSkill("HACK01","alice",request);
    }
    private BattleOnlinePasswordGuessDto correctChoice(long endsAt) {
        BattleOnlinePasswordGuessDto request = new BattleOnlinePasswordGuessDto();
        request.setOptionKey((String)get(actor,"pendingPasswordGuessCorrectKey"));request.setPasswordGuessEndsAt(endsAt);
        return request;
    }
    @Test public void targetSelectionHasNoDeadlineAndPasswordChoiceStartsOnePrivateTenSecondWindow() {
        BattleOnlineRoomDto choosingTarget = service.getRoom("HACK01","alice");
        assertEquals("MONEY_BEG",choosingTarget.getPendingSkillType());assertEquals(0L,choosingTarget.getPasswordGuessEndsAt());
        BattleOnlineRoomDto guess = openGuess();
        long duration = guess.getPasswordGuessEndsAt() - guess.getServerTime();
        assertTrue(duration >= 9000L && duration <= 10000L);assertEquals(3,guess.getPasswordGuessOptions().size());
        assertEquals(guess.getPasswordGuessEndsAt(),service.getRoom("HACK01","alice").getPasswordGuessEndsAt());
        assertEquals(0L,service.getRoom("HACK01","bob").getPasswordGuessEndsAt());
        BattleOnlineRoomDto publicRoom = ReflectionTestUtils.invokeMethod(service,"snapshotLocked",room,(String)null);
        assertEquals(0L,publicRoom.getPasswordGuessEndsAt());assertTrue(publicRoom.getPasswordGuessOptions().isEmpty());
        ArgumentCaptor<Long> delay = ArgumentCaptor.forClass(Long.class);
        verify(scheduler).schedule(any(Runnable.class),delay.capture(),eq(TimeUnit.MILLISECONDS));
        assertTrue(delay.getValue() > 0L && delay.getValue() <= 10000L);
    }
    @Test public void reachingTheDeadlineConsumesHackWithoutMovingPointsAndAssignsTheNextQuestion() {
        long deadline = openGuess().getPasswordGuessEndsAt();
        assertFalse((Boolean)ReflectionTestUtils.invokeMethod(service,"expirePasswordGuessLocked",room,actor,deadline - 1));
        assertTrue((Boolean)ReflectionTestUtils.invokeMethod(service,"expirePasswordGuessLocked",room,actor,deadline));
        assertNull(get(actor,"pendingSkillType"));assertNull(get(actor,"pendingPasswordGuessTargetUsername"));
        assertTrue(((Map<?,?>)get(actor,"passwordGuessOptions")).isEmpty());assertEquals(0L,get(actor,"passwordGuessEndsAt"));
        assertEquals(20D,(Double)get(actor,"score"),0D);assertEquals(100D,(Double)get(target,"score"),0D);
        assertNotNull(get(actor,"currentQuestion"));
        Object sequence = get(actor,"currentQuestionSequence");
        assertFalse((Boolean)ReflectionTestUtils.invokeMethod(service,"expirePasswordGuessLocked",room,actor,deadline + 1));
        assertEquals(sequence,get(actor,"currentQuestionSequence"));
    }
    @Test public void aValidChoiceStillStealsFortyPercentAndTheOldTimerCannotConsumeTheNextQuestion() {
        long deadline = openGuess().getPasswordGuessEndsAt();
        ArgumentCaptor<Runnable> timer = ArgumentCaptor.forClass(Runnable.class);
        verify(scheduler).schedule(timer.capture(),anyLong(),eq(TimeUnit.MILLISECONDS));
        BattleOnlinePasswordGuessResultDto result = service.guessPassword("HACK01","alice",correctChoice(deadline));
        assertTrue(result.isCorrect());assertEquals(40D,result.getAmount(),0D);
        assertEquals(60D,(Double)get(actor,"score"),0D);assertEquals(60D,(Double)get(target,"score"),0D);
        assertEquals(0L,result.getRoom().getPasswordGuessEndsAt());assertNotNull(result.getRoom().getCurrentQuestion());
        Object sequence = get(actor,"currentQuestionSequence");timer.getValue().run();
        assertEquals(sequence,get(actor,"currentQuestionSequence"));
    }
    @Test public void lateRequestsAreRejectedAndReloadExpiresTheAttemptEvenBeforeItsScheduledTaskRuns() {
        openGuess();set(actor,"passwordGuessEndsAt",System.currentTimeMillis() - 1L);
        BattleOnlinePasswordGuessDto request = correctChoice((Long)get(actor,"passwordGuessEndsAt"));
        try { service.guessPassword("HACK01","alice",request);fail("Expired hack accepted"); }
        catch(BattleOnlineException error) { assertEquals(HttpStatus.CONFLICT,error.getStatus()); }
        assertEquals(20D,(Double)get(actor,"score"),0D);assertEquals(100D,(Double)get(target,"score"),0D);
        assertNotNull(service.getRoom("HACK01","alice").getCurrentQuestion());
        set(actor,"pendingSkillType","MONEY_BEG");openGuess();set(actor,"passwordGuessEndsAt",System.currentTimeMillis() - 1L);
        BattleOnlineRoomDto restored = service.getRoom("HACK01","alice");
        assertNull(restored.getPendingPasswordGuessTargetUsername());assertNull(restored.getPendingSkillType());
        assertEquals(0L,restored.getPasswordGuessEndsAt());assertNotNull(restored.getCurrentQuestion());
    }
    @Test public void anOldRequestOrTimerCannotUseOrClearANewerAttempt() {
        long firstDeadline = openGuess().getPasswordGuessEndsAt();
        ArgumentCaptor<Runnable> timer = ArgumentCaptor.forClass(Runnable.class);
        verify(scheduler).schedule(timer.capture(),anyLong(),eq(TimeUnit.MILLISECONDS));
        set(actor,"passwordGuessEndsAt",firstDeadline + 1000L);
        timer.getValue().run();assertEquals("MONEY_BEG",get(actor,"pendingSkillType"));
        try { service.guessPassword("HACK01","alice",correctChoice(firstDeadline));fail("Old attempt accepted"); }
        catch(BattleOnlineException error) { assertEquals(HttpStatus.CONFLICT,error.getStatus()); }
        assertEquals("MONEY_BEG",get(actor,"pendingSkillType"));assertEquals(firstDeadline + 1000L,get(actor,"passwordGuessEndsAt"));
        assertEquals(100D,(Double)get(target,"score"),0D);
    }
    @Test public void theScheduledExpiryRunsWithoutAClientAndResetInvalidatesItsDeadline() {
        openGuess();long expired = System.currentTimeMillis() - 1L;set(actor,"passwordGuessEndsAt",expired);
        ReflectionTestUtils.invokeMethod(service,"expirePasswordGuess",room,actor,expired);
        assertNull(get(actor,"pendingSkillType"));assertNotNull(get(actor,"currentQuestion"));
        set(actor,"pendingSkillType","MONEY_BEG");openGuess();
        ReflectionTestUtils.invokeMethod(service,"resetPlayerMatchState",actor);
        assertEquals(0L,get(actor,"passwordGuessEndsAt"));
    }
}
