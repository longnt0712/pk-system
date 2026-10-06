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
        set(get(room,"settings"),"mode","LUM_NGAY"); set(get(room,"settings"),"skillsEnabled",false);
        alice=player("alice"); bob=player("bob"); host=player("host"); set(host,"host",true); set(host,"spectator",true);
        Map<String,Object> players=(Map<String,Object>)get(room,"players"); players.put("alice",alice); players.put("bob",bob); players.put("host",host);
        pool=new GiftDropGame(System.currentTimeMillis()-3000,3000,10,new Random() { public int nextInt(int bound) { return bound == 3 ? 0 : 10000; } }); set(room,"giftDrop",pool);
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

    @Test public void eachCorrectAnswerEarnsOneCreditAndDuplicateOrWrongAnswersEarnNone() throws Exception {
        BattleOnlineAnswerDto request=answerRequest();
        BattleOnlineAnswerResultDto result=service.answer("GIFTS1","alice",request);
        assertTrue(result.isCorrect()); assertEquals(Integer.valueOf(1),result.getRoom().getGiftCredits()); assertEquals(Long.valueOf(1),result.getRoom().getGiftCreditVersion());
        try { service.answer("GIFTS1","alice",request); fail("Duplicate answer rejected"); } catch(BattleOnlineException expected) {}
        assertEquals(1,get(alice,"giftCredits"));
        request=answerRequest(); request.setAnswerKey("B"); assertFalse(service.answer("GIFTS1","alice",request).isCorrect());
        assertEquals(1,get(alice,"giftCredits"));
    }

    @Test public void aClaimConsumesOneCreditAndAddsOnlyServerSelectedPoints() {
        String id=pool.snapshot().gifts.get(0).id; set(alice,"giftCredits",2); set(alice,"score",5D);
        BattleOnlineGiftClaimResultDto result=service.claimGift("GIFTS1","alice",request(id));
        assertEquals(10D*(result.getRewardLevel()+1),result.getPoints(),0D);
        assertEquals(5D+result.getPoints(),(Double)get(alice,"score"),0D); assertEquals(Integer.valueOf(1),result.getRoom().getGiftCredits());
        rejected("alice",id); assertEquals(1,get(alice,"giftCredits"));
        assertEquals(5D+result.getPoints(),(Double)get(alice,"score"),0D);
        BattleOnlineRoomDto publicRoom=ReflectionTestUtils.invokeMethod(service,"snapshotLocked",room,(String)null);
        assertNull(publicRoom.getGiftCredits()); assertNull(publicRoom.getGiftCreditVersion()); assertEquals(7,publicRoom.getGiftDrop().capacity);
    }

    @Test public void noCreditSpectatorFreezeWrongPenaltyAndOtherModesCannotClaim() {
        String id=pool.snapshot().gifts.get(0).id;
        rejected("alice",id); set(host,"giftCredits",1); rejected("host",id); set(alice,"giftCredits",1);
        set(alice,"frozenUntil",System.currentTimeMillis()+5000); rejected("alice",id); set(alice,"frozenUntil",0L);
        set(alice,"wrongAnswerPenaltyUntil",System.currentTimeMillis()+5000); rejected("alice",id); set(alice,"wrongAnswerPenaltyUntil",0L);
        set(get(room,"settings"),"mode","COUNTDOWN"); rejected("alice",id); set(get(room,"settings"),"mode","LUM_NGAY");
        rejected("alice","invented"); assertEquals(1,get(alice,"giftCredits")); assertEquals(0D,(Double)get(alice,"score"),0D);
        assertNotNull(service.claimGift("GIFTS1","alice",request(id)));
    }

    @Test public void selectedTeamCarrierAlsoReceivesDoubleGiftPoints() {
        set(get(room,"settings"),"teamCount",2); set(get(room,"settings"),"doubleActionUsername","alice"); set(alice,"teamNumber",1); set(alice,"giftCredits",1);
        BattleOnlineGiftClaimResultDto result=service.claimGift("GIFTS1","alice",request(pool.snapshot().gifts.get(0).id));
        assertEquals(20D*(result.getRewardLevel()+1),result.getPoints(),0D); assertEquals(result.getPoints(),(Double)get(alice,"score"),0D);
    }

    @Test public void rottenEggScoresExactlyHalfAPointEvenForTheDoubleCarrierAndCannotBeReused() {
        pool=new GiftDropGame(System.currentTimeMillis()-3000,3000,10000,new Random() { public int nextInt(int bound) { return 0; } });
        set(room,"giftDrop",pool); service.getRoom("GIFTS1","alice");
        set(get(room,"settings"),"teamCount",2); set(get(room,"settings"),"doubleActionUsername","alice"); set(alice,"teamNumber",1);
        set(alice,"giftCredits",2); set(alice,"score",3.5D);
        String id=pool.snapshot().gifts.get(0).id;
        BattleOnlineGiftClaimResultDto result=service.claimGift("GIFTS1","alice",request(id));
        assertEquals(GiftDropGame.ROTTEN_EGG_LEVEL,result.getRewardLevel()); assertEquals(0.5D,result.getPoints(),0D); assertEquals(4D,(Double)get(alice,"score"),0D);
        String json;
        try { json=new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(result); } catch(Exception error) { throw new AssertionError(error); }
        assertTrue(json.contains("\"points\":0.5"));
        rejected("alice",id); assertEquals(4D,(Double)get(alice,"score"),0D); assertEquals(1,get(alice,"giftCredits"));
    }

    @Test public void twoSimultaneousClaimsOfTheSameGiftHaveExactlyOneWinner() throws Exception {
        final String id=pool.snapshot().gifts.get(0).id; set(alice,"giftCredits",1); set(bob,"giftCredits",1);
        final CountDownLatch go=new CountDownLatch(1); ExecutorService workers=Executors.newFixedThreadPool(2);
        List<Future<BattleOnlineGiftClaimResultDto>> results=new ArrayList<Future<BattleOnlineGiftClaimResultDto>>();
        try {
            for(final String name:Arrays.asList("alice","bob")) results.add(workers.submit(new Callable<BattleOnlineGiftClaimResultDto>() {
                public BattleOnlineGiftClaimResultDto call() throws Exception { go.await(); try { return service.claimGift("GIFTS1",name,request(id)); } catch(BattleOnlineException lost) { return null; } }
            }));
            go.countDown(); int winners=0; double points=0D;
            for(Future<BattleOnlineGiftClaimResultDto> result:results) { BattleOnlineGiftClaimResultDto reward=result.get(5,TimeUnit.SECONDS); if(reward!=null) { winners++; points=reward.getPoints(); } }
            assertEquals(1,winners); assertEquals(1,(Integer)get(alice,"giftCredits")+(Integer)get(bob,"giftCredits"));
            assertEquals(points,(Double)get(alice,"score")+(Double)get(bob,"score"),0D);
        } finally { workers.shutdownNow(); }
    }

    @Test @SuppressWarnings("unchecked") public void settingsStartFinishAndRestartResetPoolAndTimers() throws Exception {
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
        assertEquals(7,playing.getGiftDrop().capacity); assertTrue(((Map<?,?>)get(service,"giftTimers")).containsKey("GIFTS1"));
        ReflectionTestUtils.invokeMethod(service,"finishMatchLocked",room);
        assertTrue(((Map<?,?>)get(service,"giftTimers")).isEmpty());
        assertNull(service.restartMatch("GIFTS1","host").getGiftDrop()); assertEquals(0,get(alice,"giftCredits"));
    }
}
