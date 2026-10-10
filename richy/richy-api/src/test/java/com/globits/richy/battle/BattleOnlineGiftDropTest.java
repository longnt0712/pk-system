package com.globits.richy.battle;

import com.globits.richy.dto.*;
import com.globits.richy.service.BattleOnlineException;
import com.globits.richy.service.impl.BattleOnlineServiceImpl;
import java.lang.reflect.Constructor;
import java.util.*;
import java.util.concurrent.*;
import org.junit.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class BattleOnlineGiftDropTest {
    private BattleOnlineServiceImpl service;
    private Object room, alice, bob, host;
    private GiftDropGame pool;
    private Object state(String name) throws Exception {
        Constructor<?> c = Class.forName(BattleOnlineServiceImpl.class.getName() + "$" + name).getDeclaredConstructor();
        c.setAccessible(true); return c.newInstance();
    }
    private void set(Object o, String name, Object v) { ReflectionTestUtils.setField(o, name, v); }
    private Object get(Object o, String name) { return ReflectionTestUtils.getField(o, name); }
    private Object player(String name) throws Exception {
        Object p = state("PlayerState"); set(p,"username",name); set(p,"displayName",name); set(p,"connected",true); set(p,"ready",true); return p;
    }
    @Before @SuppressWarnings("unchecked") public void setup() throws Exception {
        service = new BattleOnlineServiceImpl(); set(service,"messagingTemplate",mock(SimpMessagingTemplate.class));
        room = state("RoomState"); set(room,"code","GIFTS1"); set(room,"hostUsername","host"); set(room,"status","PLAYING");
        set(room,"matchEndsAt",System.currentTimeMillis()+60000);
        set(room,"giftOpening",true); set(room,"giftOpeningEndsAt",System.currentTimeMillis()+60000);
        set(get(room,"settings"),"mode","LUM_NGAY"); set(get(room,"settings"),"skillsEnabled",false);
        alice=player("alice"); bob=player("bob"); host=player("host"); set(host,"host",true); set(host,"spectator",true);
        Map<String,Object> players=(Map<String,Object>)get(room,"players"); players.put("alice",alice); players.put("bob",bob); players.put("host",host);
        pool=new GiftDropGame(10,new Random() { public int nextInt(int bound) { return bound == 3 ? 0 : 10000; } }); set(room,"giftDrop",pool);
        ((Map<String,Object>)get(service,"rooms")).put("GIFTS1",room);
        service.getRoom("GIFTS1","alice");
    }
    @After public void cleanup() { service.destroy(); }
    private BattleOnlineGiftClaimDto request(String id) { BattleOnlineGiftClaimDto d=new BattleOnlineGiftClaimDto(); d.setGiftId(id); return d; }
    private void rejected(String username, String id) {
        try { service.claimGift("GIFTS1",username,request(id)); fail("Claim must be rejected"); } catch(BattleOnlineException expected) {}
    }
    private BattleOnlineAnswerDto answerRequest() throws Exception {
        Object q=state("QuestionState"); set(q,"id",7L); set(q,"question","hello"); set(q,"correctKey","A"); set(q,"correctText","xin chào");
        set(alice,"currentQuestion",q); set(alice,"currentQuestionSequence",1L);
        BattleOnlineAnswerDto d=new BattleOnlineAnswerDto(); d.setQuestionId(7L); d.setQuestionSequence(1L); d.setAnswerKey("A"); return d;
    }

    @Test public void answersEarnCreditsAndUpdateStreakButNeverChangeScoreOrGrantQuestionSkills() throws Exception {
        set(room,"giftOpening",false);
        set(get(room,"settings"),"skillsEnabled",true); set(get(room,"settings"),"teamCount",2);
        set(get(room,"settings"),"doubleActionUsername","alice"); set(alice,"teamNumber",1);
        set(alice,"score",7.5D); set(alice,"streak",9); set(alice,"currentSkillType","FREEZE");
        BattleOnlineAnswerResultDto right = service.answer("GIFTS1","alice",answerRequest());
        assertTrue(right.isCorrect()); assertEquals(7.5D,(Double)get(alice,"score"),0D); assertEquals(10,get(alice,"streak"));
        assertEquals(1,get(alice,"giftCredits")); assertNull(get(alice,"pendingSkillType"));
        assertTrue(right.getMessage().contains("lượt bóc trứng"));
        BattleOnlineAnswerDto wrong=answerRequest(); wrong.setAnswerKey("B");
        service.answer("GIFTS1","alice",wrong);
        assertEquals(7.5D,(Double)get(alice,"score"),0D); assertEquals(0,get(alice,"streak")); assertEquals(1,get(alice,"giftCredits"));
    }

    @Test public void eachSkillEggGrantsItsSkillAndUsingItPreservesTheUnansweredQuestion() throws Exception {
        set(get(room,"settings"),"skillsEnabled",true);
        for (final String type : GiftDropGame.SKILL_TYPES) {
            set(room,"giftOpening",true);
            pool=new GiftDropGame(10,new Random() { public int nextInt(int bound) { return 0; } },Collections.singletonList(type));
            set(room,"giftDrop",pool); service.getRoom("GIFTS1","alice"); answerRequest();
            Object question=get(alice,"currentQuestion"); set(alice,"giftCredits",2); set(alice,"score",0D); set(bob,"score",100D);
            String id=pool.snapshot("alice").gifts.get(0).id;
            BattleOnlineGiftClaimResultDto result=service.claimGift("GIFTS1","alice",request(id));
            assertEquals(type,result.getSkillType()); assertEquals(type,result.getRoom().getPendingSkillType());
            assertEquals(0D,result.getPoints(),0D); assertEquals(0D,(Double)get(alice,"score"),0D);
            assertTrue(result.getRoom().getPendingSkillTargetUsernames().contains("bob"));
            assertEquals(type,result.getRoom().getGiftDrop().claims.get(0).skillType);
            assertEquals("alice",result.getRoom().getGiftDrop().claims.get(0).username);
            rejected("alice",id); assertEquals(1,get(alice,"giftCredits"));
            set(room,"giftOpening",false);
            BattleOnlineUseSkillDto skill=new BattleOnlineUseSkillDto(); skill.setTargetUsername("bob");
            BattleOnlineRoomDto used=service.useSkill("GIFTS1","alice",skill);
            assertNull(used.getPendingSkillType()); assertSame(question,get(alice,"currentQuestion")); assertEquals(1L,get(alice,"currentQuestionSequence"));
            assertEquals(type,used.getRecentEvents().get(0).getType());
            if ("FREEZE".equals(type)) { assertTrue((Long)get(bob,"frozenUntil")>System.currentTimeMillis()); }
            if ("INVERT".equals(type)) { assertTrue((Long)get(bob,"invertedUntil")>System.currentTimeMillis()); }
            if ("STEAL_SCORE".equals(type)) { assertEquals(5D,(Double)get(alice,"score"),0D); assertEquals(95D,(Double)get(bob,"score"),0D); }
        }
    }

    @Test public void eachCorrectAnswerEarnsOneCreditAndDuplicateOrWrongAnswersEarnNone() throws Exception {
        set(room,"giftOpening",false);
        BattleOnlineAnswerDto request=answerRequest();
        BattleOnlineAnswerResultDto result=service.answer("GIFTS1","alice",request);
        assertTrue(result.isCorrect()); assertEquals(Integer.valueOf(1),result.getRoom().getGiftCredits()); assertEquals(Long.valueOf(1),result.getRoom().getGiftCreditVersion());
        try { service.answer("GIFTS1","alice",request); fail("Duplicate answer rejected"); } catch(BattleOnlineException expected) {}
        assertEquals(1,get(alice,"giftCredits"));
        request=answerRequest(); request.setAnswerKey("B"); assertFalse(service.answer("GIFTS1","alice",request).isCorrect());
        assertEquals(1,get(alice,"giftCredits"));
    }

    @Test public void aClaimConsumesOneCreditAndAddsOnlyServerSelectedPoints() {
        String id=pool.snapshot("alice").gifts.get(0).id; set(alice,"giftCredits",2); set(alice,"score",5D);
        BattleOnlineGiftClaimResultDto result=service.claimGift("GIFTS1","alice",request(id));
        assertEquals(10D*(result.getRewardLevel()+1),result.getPoints(),0D);
        assertEquals(5D+result.getPoints(),(Double)get(alice,"score"),0D); assertEquals(Integer.valueOf(1),result.getRoom().getGiftCredits());
        assertEquals(1,result.getRoom().getGiftDrop().claims.size());
        assertEquals(result.getPoints(),result.getRoom().getGiftDrop().claims.get(0).points,0D);
        rejected("alice",id); assertEquals(1,get(alice,"giftCredits"));
        assertEquals(5D+result.getPoints(),(Double)get(alice,"score"),0D);
        BattleOnlineRoomDto publicRoom=ReflectionTestUtils.invokeMethod(service,"snapshotLocked",room,(String)null);
        assertNull(publicRoom.getGiftCredits()); assertNull(publicRoom.getGiftCreditVersion()); assertEquals(3,publicRoom.getGiftDrop().capacity); assertNull(publicRoom.getGiftDrop().gifts);
    }

    @Test public void noCreditSpectatorFreezeWrongPenaltyAndOtherModesCannotClaim() {
        String id=pool.snapshot("alice").gifts.get(0).id;
        rejected("alice",id); set(host,"giftCredits",1); rejected("host",id); set(alice,"giftCredits",1);
        set(alice,"frozenUntil",System.currentTimeMillis()+5000); rejected("alice",id); set(alice,"frozenUntil",0L);
        set(alice,"wrongAnswerPenaltyUntil",System.currentTimeMillis()+5000); rejected("alice",id); set(alice,"wrongAnswerPenaltyUntil",0L);
        set(get(room,"settings"),"mode","COUNTDOWN"); rejected("alice",id); set(get(room,"settings"),"mode","LUM_NGAY");
        rejected("alice","invented"); assertEquals(1,get(alice,"giftCredits")); assertEquals(0D,(Double)get(alice,"score"),0D);
        assertNotNull(service.claimGift("GIFTS1","alice",request(id)));
    }

    @Test public void eachAccountOwnsThreeEggsAndCannotClaimFromAnotherPlayersPool() {
        BattleOnlineRoomDto a=service.getRoom("GIFTS1","alice"), b=service.getRoom("GIFTS1","bob");
        assertEquals(3,a.getGiftDrop().gifts.size()); assertEquals(3,b.getGiftDrop().gifts.size());
        String aliceEgg=a.getGiftDrop().gifts.get(0).id, bobEgg=b.getGiftDrop().gifts.get(0).id;
        set(alice,"giftCredits",1); set(bob,"giftCredits",1);
        rejected("bob",aliceEgg); assertEquals(1,get(bob,"giftCredits"));
        service.claimGift("GIFTS1","alice",request(aliceEgg));
        assertEquals(bobEgg,service.getRoom("GIFTS1","bob").getGiftDrop().gifts.get(0).id);
        assertEquals(3,service.getRoom("GIFTS1","alice").getGiftDrop().gifts.size());
        service.claimGift("GIFTS1","bob",request(bobEgg));
        assertEquals(2,pool.snapshot().claims.size());
    }

    @Test public void nonVideoAnswersCanOpenOneOfThreeEggsImmediatelyAndFinishWithoutAFinalEggPhase() {
        set(room,"videoSynchronized",false); set(room,"giftOpening",false); set(room,"giftOpeningEndsAt",0L);
        set(alice,"giftCredits",1); String id=pool.snapshot("alice").gifts.get(0).id;
        BattleOnlineGiftClaimResultDto claimed=service.claimGift("GIFTS1","alice",request(id));
        assertEquals("PLAYING",claimed.getRoom().getStatus()); assertFalse(claimed.getRoom().isGiftOpening());
        assertEquals(Integer.valueOf(0),claimed.getRoom().getGiftCredits()); assertEquals(3,claimed.getRoom().getGiftDrop().capacity);
        assertEquals(3,claimed.getRoom().getGiftDrop().gifts.size());
        set(alice,"giftCredits",1); ReflectionTestUtils.invokeMethod(service,"finishMatchLocked",room);
        BattleOnlineRoomDto finished=service.getRoom("GIFTS1","alice");
        assertEquals("FINISHED",finished.getStatus()); assertFalse(finished.isGiftOpening());
    }

    @Test public void selectedTeamCarrierAlsoReceivesDoubleGiftPoints() {
        set(get(room,"settings"),"teamCount",2); set(get(room,"settings"),"doubleActionUsername","alice"); set(alice,"teamNumber",1); set(alice,"giftCredits",1);
        BattleOnlineGiftClaimResultDto result=service.claimGift("GIFTS1","alice",request(pool.snapshot("alice").gifts.get(0).id));
        assertEquals(20D*(result.getRewardLevel()+1),result.getPoints(),0D); assertEquals(result.getPoints(),(Double)get(alice,"score"),0D);
    }

    @Test public void rottenEggScoresExactlyHalfAPointEvenForTheDoubleCarrierAndCannotBeReused() {
        pool=new GiftDropGame(10000,new Random() { public int nextInt(int bound) { return 0; } });
        set(room,"giftDrop",pool); service.getRoom("GIFTS1","alice");
        set(get(room,"settings"),"teamCount",2); set(get(room,"settings"),"doubleActionUsername","alice"); set(alice,"teamNumber",1);
        set(alice,"giftCredits",2); set(alice,"score",3.5D);
        String id=pool.snapshot("alice").gifts.get(0).id;
        BattleOnlineGiftClaimResultDto result=service.claimGift("GIFTS1","alice",request(id));
        assertEquals(GiftDropGame.ROTTEN_EGG_LEVEL,result.getRewardLevel()); assertEquals(0.5D,result.getPoints(),0D); assertEquals(4D,(Double)get(alice,"score"),0D);
        String json;
        try { json=new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(result); } catch(Exception error) { throw new AssertionError(error); }
        assertTrue(json.contains("\"points\":0.5"));
        rejected("alice",id); assertEquals(4D,(Double)get(alice,"score"),0D); assertEquals(1,get(alice,"giftCredits"));
    }

    @Test public void twoSimultaneousClaimsOfTheSameGiftHaveExactlyOneWinner() throws Exception {
        final String id=pool.snapshot("alice").gifts.get(0).id; set(alice,"giftCredits",1); set(bob,"giftCredits",1);
        final CountDownLatch go=new CountDownLatch(1); ExecutorService workers=Executors.newFixedThreadPool(2);
        List<Future<BattleOnlineGiftClaimResultDto>> results=new ArrayList<Future<BattleOnlineGiftClaimResultDto>>();
        try {
            for(final String name:Arrays.asList("alice","alice")) results.add(workers.submit(new Callable<BattleOnlineGiftClaimResultDto>() {
                public BattleOnlineGiftClaimResultDto call() throws Exception { go.await(); try { return service.claimGift("GIFTS1",name,request(id)); } catch(BattleOnlineException lost) { return null; } }
            }));
            go.countDown(); int winners=0; double points=0D;
            for(Future<BattleOnlineGiftClaimResultDto> result:results) { BattleOnlineGiftClaimResultDto reward=result.get(5,TimeUnit.SECONDS); if(reward!=null) { winners++; points=reward.getPoints(); } }
            assertEquals(1,winners); assertEquals(1,(Integer)get(alice,"giftCredits")+(Integer)get(bob,"giftCredits"));
            assertEquals(points,(Double)get(alice,"score")+(Double)get(bob,"score"),0D);
            assertEquals(1,pool.snapshot().claims.size());
        } finally { workers.shutdownNow(); }
    }

    @Test @SuppressWarnings("unchecked") public void settingsStartFinishAndRestartResetPoolAndApplySkillChoices() throws Exception {
        set(room,"status","LOBBY"); set(room,"giftDrop",null);
        BattleOnlineRoomSettingsDto config=new BattleOnlineRoomSettingsDto(); config.setMode("LUM_NGAY"); config.setGiftSpawnSeconds(0); config.setGiftBasePoints(20000); config.setSkillsEnabled(false);
        BattleOnlineRoomDto saved=service.updateSettings("GIFTS1","host",config);
        assertEquals("LUM_NGAY",saved.getSettings().getMode()); assertEquals(1,saved.getSettings().getGiftSpawnSeconds()); assertEquals(10000,saved.getSettings().getGiftBasePoints());
        Map<Long,Object> prepared=(Map<Long,Object>)get(room,"preparedQuestions");
        for(long id=1;id<=4;id++) {
            Object q=state("QuestionState"); set(q,"id",id); set(q,"question","q"+id); set(q,"correctKey","A"); set(q,"correctText","a"+id);
            List<Object> options=(List<Object>)get(q,"options");
            for(char key='A';key<='D';key++) { Object opt=state("OptionState"); set(opt,"key",String.valueOf(key)); set(opt,"text","answer"+key); options.add(opt); }
            prepared.put(id,q);
        }
        set(room,"allQuestionsLoaded",true); set(alice,"giftCredits",5);
        service.startMatch("GIFTS1","host"); BattleOnlineRoomDto playing=service.getRoom("GIFTS1","alice");
        assertNotNull(playing.getGiftDrop()); assertNotNull(playing.getCurrentQuestion()); assertEquals(Integer.valueOf(0),playing.getGiftCredits());
        assertEquals(3,playing.getGiftDrop().capacity); assertEquals(3,playing.getGiftDrop().gifts.size()); assertTrue(playing.getGiftDrop().claims.isEmpty());
        assertTrue(((List<?>)get(get(room,"giftDrop"),"skillTypes")).isEmpty());
        ReflectionTestUtils.invokeMethod(service,"finishMatchLocked",room);
        assertNull(service.restartMatch("GIFTS1","host").getGiftDrop()); assertEquals(0,get(alice,"giftCredits"));
        config.setSkillsEnabled(true); config.setDisabledSkillTypes(Arrays.asList("FREEZE","STEAL_SCORE"));
        service.updateSettings("GIFTS1","host",config); set(alice,"ready",true); set(bob,"ready",true); service.startMatch("GIFTS1","host");
        assertEquals(Collections.singletonList("INVERT"),get(get(room,"giftDrop"),"skillTypes"));
        assertTrue(((Map<?,?>)get(room,"countdownSkillPlan")).isEmpty());
    }

    @Test public void finishingQuestionsStartsAThreeMinuteFinalPoolAndLastClaimEndsEarly() {
        set(room,"videoSynchronized",true); set(alice,"giftCredits",2); set(bob,"giftCredits",1); set(room,"giftOpening",false);
        long before=System.currentTimeMillis(); ReflectionTestUtils.invokeMethod(service,"finishMatchLocked",room);
        BattleOnlineRoomDto aliceRoom=service.getRoom("GIFTS1","alice"), bobRoom=service.getRoom("GIFTS1","bob");
        assertEquals("PLAYING",aliceRoom.getStatus()); assertTrue(aliceRoom.isGiftOpening());
        assertTrue(aliceRoom.getGiftOpeningEndsAt()>=before+179000L); assertTrue(aliceRoom.getGiftOpeningEndsAt()<=before+181000L);
        assertEquals(5,aliceRoom.getGiftDrop().capacity); assertEquals(5,aliceRoom.getGiftDrop().gifts.size());
        assertEquals(4,bobRoom.getGiftDrop().capacity); assertEquals(4,bobRoom.getGiftDrop().gifts.size());

        service.claimGift("GIFTS1","alice",request(aliceRoom.getGiftDrop().gifts.get(0).id));
        aliceRoom=service.getRoom("GIFTS1","alice");
        service.claimGift("GIFTS1","alice",request(aliceRoom.getGiftDrop().gifts.get(0).id));
        assertEquals("PLAYING",service.getRoom("GIFTS1","bob").getStatus());
        bobRoom=service.getRoom("GIFTS1","bob");
        BattleOnlineGiftClaimResultDto last=service.claimGift("GIFTS1","bob",request(bobRoom.getGiftDrop().gifts.get(0).id));
        assertEquals("FINISHED",last.getRoom().getStatus()); assertFalse(last.getRoom().isGiftOpening());
    }

    @Test public void hostCanExtendOrFinishTheEggRound() {
        set(room,"videoSynchronized",true); set(alice,"giftCredits",1); set(room,"giftOpening",false);
        ReflectionTestUtils.invokeMethod(service,"finishMatchLocked",room);
        long first=service.getRoom("GIFTS1","host").getGiftOpeningEndsAt();
        BattleOnlineRoomDto extended=service.extendGiftOpening("GIFTS1","host");
        assertEquals(first+60000L,extended.getGiftOpeningEndsAt());
        ReflectionTestUtils.invokeMethod(service,"finishCountdownByTimer","GIFTS1",first);
        assertEquals("PLAYING",service.getRoom("GIFTS1","host").getStatus());
        try { service.extendGiftOpening("GIFTS1","alice"); fail("Only host may extend"); } catch(BattleOnlineException expected) {}
        assertEquals("FINISHED",service.finishGiftOpening("GIFTS1","host").getStatus());
    }
}
