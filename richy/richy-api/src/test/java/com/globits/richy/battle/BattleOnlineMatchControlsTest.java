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

public class BattleOnlineMatchControlsTest {
    @Test @SuppressWarnings("unchecked") public void manualClassicPublishesEachChosenAnswerOnlyDuringReviewAndClearsItForTheNextQuestion() throws Exception {
        setup("CLASSIC",false);
        Object aOption=state("OptionState"),bOption=state("OptionState");
        set(aOption,"key","A");set(aOption,"text","hello");set(bOption,"key","B");set(bOption,"text","goodbye");
        ((List<Object>)get(question,"options")).addAll(Arrays.asList(aOption,bOption));
        Map<String,Object> players=(Map<String,Object>)get(room,"players");players.put("carol",player("carol",false,1));
        Object second=state("QuestionState");set(second,"id",8L);set(second,"question","second");set(second,"correctKey","A");set(second,"correctText","next");
        ((List<Object>)get(room,"classicQuestions")).add(second);
        BattleOnlineAnswerDto a=new BattleOnlineAnswerDto();a.setQuestionId(7L);a.setQuestionSequence(1L);a.setAnswerKey("A");
        service.answer("CONTROL1","alice",a);
        assertTrue(service.getRoom("CONTROL1","host").getClassicStudentAnswers().isEmpty());
        service.setClassicAutoAdvance("CONTROL1","host",false);
        BattleOnlineAnswerDto b=new BattleOnlineAnswerDto();b.setQuestionId(7L);b.setQuestionSequence(1L);b.setAnswerKey("B");
        service.answer("CONTROL1","bob",b);rejected(()->service.answer("CONTROL1","alice",b));
        BattleOnlineRoomDto publicBefore=ReflectionTestUtils.invokeMethod(service,"snapshotLocked",room,(String)null);
        assertTrue(publicBefore.getClassicStudentAnswers().isEmpty());
        long deadline=System.currentTimeMillis()-1L;set(room,"questionEndsAt",deadline);
        ReflectionTestUtils.invokeMethod(service,"advanceClassicQuestion","CONTROL1",0);
        BattleOnlineRoomDto review=service.getRoom("CONTROL1","alice");
        List<BattleOnlineClassicAnswerDto> rows=review.getClassicStudentAnswers();assertEquals(3,rows.size());
        BattleOnlineClassicAnswerDto aliceRow=rows.stream().filter(r->"alice".equals(r.getUsername())).findFirst().get();
        BattleOnlineClassicAnswerDto bobRow=rows.stream().filter(r->"bob".equals(r.getUsername())).findFirst().get();
        BattleOnlineClassicAnswerDto carolRow=rows.stream().filter(r->"carol".equals(r.getUsername())).findFirst().get();
        assertEquals("A. hello",aliceRow.getAnswer());assertTrue(aliceRow.isAnswered());assertTrue(aliceRow.isCorrect());
        assertEquals("B. goodbye",bobRow.getAnswer());assertTrue(bobRow.isAnswered());assertFalse(bobRow.isCorrect());
        assertFalse(carolRow.isAnswered());assertFalse(carolRow.isCorrect());assertEquals("",carolRow.getAnswer());
        assertFalse(rows.stream().anyMatch(r->"host".equals(r.getUsername())));
        assertEquals(review.getPlayers().stream().filter(p->!p.isSpectator()).map(BattleOnlinePlayerDto::getUsername).collect(java.util.stream.Collectors.toList()),
                rows.stream().map(BattleOnlineClassicAnswerDto::getUsername).collect(java.util.stream.Collectors.toList()));
        BattleOnlineRoomDto publicReview=ReflectionTestUtils.invokeMethod(service,"snapshotLocked",room,(String)null);
        assertEquals(3,publicReview.getClassicStudentAnswers().size());
        rejected(()->service.answer("CONTROL1","bob",a));
        assertTrue(service.nextClassicQuestion("CONTROL1","host",1L,deadline).getClassicStudentAnswers().isEmpty());
        assertTrue(((Map<?,?>)get(room,"currentClassicAnswers")).isEmpty());
        set(room,"questionEndsAt",System.currentTimeMillis()-1L);ReflectionTestUtils.invokeMethod(service,"advanceClassicQuestion","CONTROL1",1);
        assertTrue(service.getRoom("CONTROL1","host").getClassicStudentAnswers().stream().noneMatch(BattleOnlineClassicAnswerDto::isAnswered));
        set(room,"classicAutoAdvance",true);assertTrue(service.getRoom("CONTROL1","host").getClassicStudentAnswers().isEmpty());
    }
    @Test @SuppressWarnings("unchecked") public void manualClassicWaitsUntilTimeExpiresThenRevealsWithoutAdvancingUntilHostNext() throws Exception {
        setup("CLASSIC", false);
        Object second=state("QuestionState");set(second,"id",8L);set(second,"question","next");set(second,"correctKey","A");set(second,"correctText","next");
        ((List<Object>)get(room,"classicQuestions")).add(second);
        assertTrue(service.getRoom("CONTROL1","alice").isClassicAutoAdvance());
        rejected(()->service.setClassicAutoAdvance("CONTROL1","alice",false));
        BattleOnlineRoomDto manual=service.setClassicAutoAdvance("CONTROL1","host",false);
        assertFalse(manual.isClassicAutoAdvance());assertNull(manual.getClassicCorrectAnswer());
        BattleOnlineAnswerDto a=new BattleOnlineAnswerDto();a.setQuestionId(7L);a.setQuestionSequence(1L);a.setAnswerKey("A");
        service.answer("CONTROL1","alice",a);service.answer("CONTROL1","bob",a);
        ReflectionTestUtils.invokeMethod(service,"advanceClassicQuestion","CONTROL1",0);
        assertEquals(1,service.getRoom("CONTROL1","alice").getCurrentQuestionIndex());
        assertFalse(service.getRoom("CONTROL1","alice").isClassicAnswerRevealed());
        rejected(()->service.nextClassicQuestion("CONTROL1","host",1L,(Long)get(room,"questionEndsAt")));
        long expired=System.currentTimeMillis()-1L;set(room,"questionEndsAt",expired);
        ReflectionTestUtils.invokeMethod(service,"advanceClassicQuestion","CONTROL1",0);
        BattleOnlineRoomDto review=service.getRoom("CONTROL1","alice");
        assertTrue(review.isClassicAnswerRevealed());assertEquals("hello",review.getClassicCorrectAnswer());assertEquals("PLAYING",review.getStatus());
        ReflectionTestUtils.invokeMethod(service,"advanceClassicQuestion","CONTROL1",0);
        rejected(()->service.answer("CONTROL1","alice",a));
        rejected(()->service.nextClassicQuestion("CONTROL1","alice",1L,expired));
        rejected(()->service.nextClassicQuestion("CONTROL1","host",1L,expired-1));
        BattleOnlineRoomDto next=service.nextClassicQuestion("CONTROL1","host",1L,expired);
        assertEquals(2,next.getCurrentQuestionIndex());assertFalse(next.isClassicAnswerRevealed());assertNull(next.getClassicCorrectAnswer());
        rejected(()->service.nextClassicQuestion("CONTROL1","host",1L,expired));
        long lastExpired=System.currentTimeMillis()-1L;set(room,"questionEndsAt",lastExpired);
        ReflectionTestUtils.invokeMethod(service,"advanceClassicQuestion","CONTROL1",1);
        assertEquals("FINISHED",service.nextClassicQuestion("CONTROL1","host",2L,lastExpired).getStatus());
    }

    @Test public void classicAutoKeepsOldEarlyAdvanceAndCanBeRestoredWhileShowingTheAnswer() throws Exception {
        setup("CLASSIC",false);set(alice,"answeredClassicIndex",0);set(bob,"answeredClassicIndex",0);
        ReflectionTestUtils.invokeMethod(service,"advanceClassicQuestion","CONTROL1",0);
        assertEquals("FINISHED",get(room,"status"));
        setup("CLASSIC",false);service.setClassicAutoAdvance("CONTROL1","host",false);
        set(room,"questionEndsAt",System.currentTimeMillis()-1L);ReflectionTestUtils.invokeMethod(service,"advanceClassicQuestion","CONTROL1",0);
        int wrong=(Integer)get(alice,"wrongCount");ReflectionTestUtils.invokeMethod(service,"advanceClassicQuestion","CONTROL1",0);
        assertEquals(wrong,get(alice,"wrongCount"));
        assertEquals("FINISHED",service.setClassicAutoAdvance("CONTROL1","host",true).getStatus());
        setup("COUNTDOWN",false);rejected(()->service.setClassicAutoAdvance("CONTROL1","host",false));
    }
    @Test public void newPlayersJoinReadyInEveryModeAndCanStillChooseNotReady() throws Exception {
        for (String mode : MODES) {
            setup(mode, false); set(room, "status", "LOBBY");
            javax.persistence.EntityManager em = mock(javax.persistence.EntityManager.class);
            javax.persistence.Query identity = mock(javax.persistence.Query.class), roles = mock(javax.persistence.Query.class);
            when(em.createQuery(anyString())).thenAnswer(call -> ((String)call.getArguments()[0]).contains("join u.roles") ? roles : identity);
            when(identity.getResultList()).thenReturn(Collections.singletonList(new Object[]{4L,"New","Player","New Player",0L,"MAM_HOC"}));
            when(roles.getResultList()).thenReturn(Collections.emptyList()); set(service, "entityManager", em);
            BattleOnlineRoomDto joined = service.joinRoom("CONTROL1", "newbie");
            BattleOnlinePlayerDto player = joined.getPlayers().stream().filter(p -> "newbie".equals(p.getUsername())).findFirst().get();
            assertTrue(mode, player.isReady()); assertTrue(player.isConnected()); assertFalse(player.isSpectator());
            assertTrue(player.getTeamNumber() >= 1 && player.getTeamNumber() <= 2);
            service.setReady("CONTROL1", "newbie", false);
            BattleOnlineRoomDto rejoined = service.joinRoom("CONTROL1", "newbie");
            assertFalse(rejoined.getPlayers().stream().filter(p -> "newbie".equals(p.getUsername())).findFirst().get().isReady());
            assertTrue(service.setReady("CONTROL1", "newbie", true).getPlayers().stream().filter(p -> "newbie".equals(p.getUsername())).findFirst().get().isReady());
        }
    }
    private BattleOnlineServiceImpl service;
    private Object room, alice, bob, question;
    private static final String[] MODES = {"CLASSIC", "GUESS_WORD", "COUNTDOWN", "MONEY_BEG", "ESCAPE_DUMB_DEMON", "DEMON_DEFENSE", "LUM_NGAY"};
    private Object state(String name) throws Exception {
        Constructor<?> c = Class.forName(BattleOnlineServiceImpl.class.getName() + "$" + name).getDeclaredConstructor();
        c.setAccessible(true); return c.newInstance();
    }
    private void set(Object o, String name, Object value) { ReflectionTestUtils.setField(o, name, value); }
    private Object get(Object o, String name) { return ReflectionTestUtils.getField(o, name); }
    private Object player(String name, boolean spectator, int team) throws Exception {
        Object p = state("PlayerState"); set(p, "username", name); set(p, "displayName", name);
        set(p, "connected", true); set(p, "ready", true); set(p, "spectator", spectator); set(p, "teamNumber", team); return p;
    }
    @SuppressWarnings("unchecked") private void setup(String mode, boolean video) throws Exception {
        if (service != null) { service.destroy(); }
        service = new BattleOnlineServiceImpl(); set(service, "messagingTemplate", mock(SimpMessagingTemplate.class));
        room = state("RoomState"); set(room, "code", "CONTROL1"); set(room, "hostUsername", "host"); set(room, "status", "PLAYING");
        Object settings = get(room, "settings"); set(settings, "mode", mode); set(settings, "skillsEnabled", false);
        set(settings, "teamCount", 2); set(settings, "questionCount", 1);
        alice = player("alice", false, 1); bob = player("bob", false, 2);
        Object host = player("host", true, 0); set(host, "host", true);
        Map<String, Object> players = (Map<String, Object>) get(room, "players");
        players.put("host", host); players.put("alice", alice); players.put("bob", bob);
        question = state("QuestionState"); set(question, "id", 7L); set(question, "question", "xin chào");
        set(question, "correctText", "hello"); set(question, "correctKey", "A");
        ((List<Object>) get(room, "classicQuestions")).add(question);
        ((Map<Long, Object>) get(room, "preparedQuestions")).put(7L, question);
        ((List<Long>) get(room, "countdownQuestionIds")).add(7L);
        set(room, "classicQuestionIndex", 0); set(room, "allQuestionsLoaded", true); set(room, "guessPhase", "QUESTION");
        set(room, "questionEndsAt", System.currentTimeMillis() + 30000L);
        set(room, "matchEndsAt", video ? Long.MAX_VALUE : System.currentTimeMillis() + 120000L);
        set(room, "videoSynchronized", video); set(room, "videoPhase", video ? "ANSWERING" : null);
        set(alice, "currentQuestion", question); set(alice, "currentQuestionSequence", 1L); set(alice, "score", 10D);
        set(bob, "currentQuestion", question); set(bob, "currentQuestionSequence", 1L);
        if ("LUM_NGAY".equals(mode)) { set(room, "giftDrop", new GiftDropGame(10, new Random(1))); }
        if ("DEMON_DEFENSE".equals(mode)) {
            Map<Integer, Integer> teams = new LinkedHashMap<Integer, Integer>(); teams.put(1, 1); teams.put(2, 1);
            set(room, "demonDefense", new DemonDefenseGame(System.currentTimeMillis(), teams));
        }
        ((Map<String, Object>) get(service, "rooms")).put("CONTROL1", room);
    }
    @After public void cleanup() { if (service != null) { service.destroy(); } }
    private void rejected(Runnable action) { try { action.run(); fail("Must reject"); } catch (BattleOnlineException expected) {} }

    @Test public void sharedQuestionsAddTenSecondsAndMatchClocksAddOneMinuteWithoutResettingProgress() throws Exception {
        for (String mode : MODES) {
            setup(mode, false);
            long questionEnd = (Long) get(room, "questionEndsAt"), matchEnd = (Long) get(room, "matchEndsAt");
            BattleOnlineRoomDto updated = service.extendMatchTime("CONTROL1", "host");
            boolean shared = "CLASSIC".equals(mode) || "GUESS_WORD".equals(mode);
            assertEquals(mode, questionEnd + (shared ? 10000L : 0L), updated.getQuestionEndsAt());
            assertEquals(mode, matchEnd + (shared ? 0L : 60000L), updated.getMatchEndsAt());
            assertEquals(10D, (Double) get(alice, "score"), 0D); assertEquals(1L, get(alice, "currentQuestionSequence"));
            if (shared) { ReflectionTestUtils.invokeMethod(service, "advanceClassicQuestion", "CONTROL1", 0); }
            else { ReflectionTestUtils.invokeMethod(service, "finishCountdownByTimer", "CONTROL1", matchEnd); }
            assertEquals("PLAYING", get(room, "status")); assertEquals(0, get(room, "classicQuestionIndex"));
        }
    }

    @Test public void videoExtensionsAndPausedAnswersWorkInEveryMode() throws Exception {
        for (String mode : MODES) {
            setup(mode, true);
            long first = (Long) get(room, "questionEndsAt");
            assertEquals(first + 10000L, service.extendMatchTime("CONTROL1", "host").getQuestionEndsAt());
            BattleOnlineTimerControlDto pause = new BattleOnlineTimerControlDto(); pause.setPaused(true);
            BattleOnlineRoomDto paused = service.controlQuestionTimer("CONTROL1", "host", pause);
            BattleOnlineRoomDto extended = service.extendMatchTime("CONTROL1", "host");
            assertTrue(extended.isQuestionTimerPaused()); assertEquals(0L, extended.getQuestionEndsAt());
            assertEquals(paused.getQuestionTimerRemainingMillis() + 10000L, extended.getQuestionTimerRemainingMillis());
            BattleOnlineAnswerDto answer = new BattleOnlineAnswerDto(); answer.setQuestionId(7L); answer.setQuestionSequence(1L);
            answer.setAnswerKey("A"); answer.setAnswerText("hello");
            assertTrue(mode, service.answer("CONTROL1", "alice", answer).isCorrect());
        }
    }

    @Test public void onlyHostCanControlAnActiveMatchAndVideoNeedsAnOpenQuestionForExtraTime() throws Exception {
        setup("COUNTDOWN", false);
        rejected(() -> service.extendMatchTime("CONTROL1", "alice")); rejected(() -> service.finishMatch("CONTROL1", "alice"));
        set(room, "status", "LOBBY"); rejected(() -> service.finishMatch("CONTROL1", "host"));
        set(room, "status", "FINISHED"); rejected(() -> service.extendMatchTime("CONTROL1", "host"));
        setup("GUESS_WORD", false); set(room, "guessPhase", "WAITING_HOST"); rejected(() -> service.extendMatchTime("CONTROL1", "host"));
        setup("COUNTDOWN", true); set(room, "videoPhase", "WATCHING"); rejected(() -> service.extendMatchTime("CONTROL1", "host"));
        assertEquals("FINISHED", service.finishMatch("CONTROL1", "host").getStatus());
    }

    @Test public void hostCanFinishEveryModeAndEggsKeepTheirFinalStageWithOrWithoutVideo() throws Exception {
        for (boolean video : new boolean[]{false, true}) {
            for (String mode : MODES) {
                setup(mode, video); set(alice, "giftCredits", 2);
                long before = System.currentTimeMillis();
                BattleOnlineRoomDto result = service.finishMatch("CONTROL1", "host");
                if ("LUM_NGAY".equals(mode)) {
                    assertEquals("PLAYING", result.getStatus()); assertTrue(result.isGiftOpening());
                    assertTrue(result.getGiftOpeningEndsAt() >= before + 180000L);
                    assertTrue(result.getGiftOpeningEndsAt() <= System.currentTimeMillis() + 180000L);
                    BattleOnlineRoomDto own = service.getRoom("CONTROL1", "alice");
                    assertNull(own.getCurrentQuestion()); assertEquals(Integer.valueOf(2), own.getGiftCredits());
                    assertEquals(5, own.getGiftDrop().gifts.size()); assertFalse((Boolean) get(room, "battleResultsSaved"));
                    long first = own.getGiftOpeningEndsAt();
                    assertEquals(first + 60000L, service.extendMatchTime("CONTROL1", "host").getGiftOpeningEndsAt());
                    ReflectionTestUtils.invokeMethod(service, "finishCountdownByTimer", "CONTROL1", first);
                    assertEquals("PLAYING", get(room, "status"));
                    assertEquals("FINISHED", service.finishMatch("CONTROL1", "host").getStatus());
                } else { assertEquals(mode, "FINISHED", result.getStatus()); }
            }
        }
    }

    @Test public void nonVideoTimerAlsoStartsFinalEggsAndLastClaimFinishesWithTheAwardedScore() throws Exception {
        setup("LUM_NGAY", false); set(alice, "giftCredits", 1);
        ReflectionTestUtils.invokeMethod(service, "finishCountdownByTimer", "CONTROL1", get(room, "matchEndsAt"));
        BattleOnlineRoomDto own = service.getRoom("CONTROL1", "alice");
        assertTrue(own.isGiftOpening()); assertNull(own.getCurrentQuestion());
        BattleOnlineGiftClaimDto claim = new BattleOnlineGiftClaimDto(); claim.setGiftId(own.getGiftDrop().gifts.get(0).id);
        BattleOnlineGiftClaimResultDto reward = service.claimGift("CONTROL1", "alice", claim);
        assertTrue(reward.getPoints() > 0D); assertEquals(10D + reward.getPoints(), (Double) get(alice, "score"), 0D);
        assertEquals("FINISHED", reward.getRoom().getStatus()); assertTrue((Boolean) get(room, "battleResultsSaved"));
        rejected(() -> service.answer("CONTROL1", "alice", new BattleOnlineAnswerDto()));
    }
}
