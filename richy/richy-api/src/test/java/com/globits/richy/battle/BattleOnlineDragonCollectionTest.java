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

public class BattleOnlineDragonCollectionTest {
    private BattleOnlineServiceImpl service;
    private Object room, alice, bob, carol;
    private GiftDropGame game;
    private Object state(String type) throws Exception {
        Constructor<?> c=Class.forName(BattleOnlineServiceImpl.class.getName()+"$"+type).getDeclaredConstructor();
        c.setAccessible(true);return c.newInstance();
    }
    private Object get(Object o,String name){return ReflectionTestUtils.getField(o,name);}
    private void set(Object o,String name,Object value){ReflectionTestUtils.setField(o,name,value);}
    private Object player(String name) throws Exception {
        Object p=state("PlayerState");set(p,"username",name);set(p,"displayName",name);set(p,"connected",true);set(p,"ready",true);return p;
    }
    @Before @SuppressWarnings("unchecked") public void setup() throws Exception {
        service=new BattleOnlineServiceImpl();set(service,"messagingTemplate",mock(SimpMessagingTemplate.class));
        ScheduledExecutorService scheduler=mock(ScheduledExecutorService.class);
        when(scheduler.schedule(any(Runnable.class),anyLong(),eq(TimeUnit.MILLISECONDS))).thenReturn(mock(ScheduledFuture.class));
        set(service,"scheduler",scheduler);
        room=state("RoomState");set(room,"code","DRAGON");set(room,"hostUsername","host");set(room,"status","PLAYING");
        set(room,"allQuestionsLoaded",true);set(room,"matchEndsAt",System.currentTimeMillis()+600000L);
        set(room,"giftOpening",true);set(room,"giftOpeningEndsAt",System.currentTimeMillis()+600000L);
        set(get(room,"settings"),"mode","LUM_NGAY");set(get(room,"settings"),"skillsEnabled",true);
        alice=player("alice");bob=player("bob");carol=player("carol");Object host=player("host");set(host,"host",true);set(host,"spectator",true);
        set(alice,"score",100D);set(alice,"giftCredits",30);set(bob,"giftCredits",1);
        Map<String,Object> players=(Map<String,Object>)get(room,"players");
        players.put("alice",alice);players.put("bob",bob);players.put("carol",carol);players.put("host",host);
        game=new GiftDropGame(10,new Random(1),GiftDropGame.SKILL_TYPES);set(room,"giftDrop",game);
        ((Map<String,Object>)get(service,"rooms")).put("DRAGON",room);
    }
    @After public void cleanup(){service.destroy();}
    @SuppressWarnings("unchecked") private BattleOnlineGiftClaimResultDto pick(int stars) {
        String id=game.snapshot("alice").gifts.get(0).id;
        Object privatePool=((Map<String,Object>)get(game,"playerPools")).get("alice");
        ((Map<String,GiftDropGame.Gift>)get(privatePool,"gifts")).put(id,new GiftDropGame.Gift(id,1000+stars,10D*stars,null,
                "assets/images/learning-pets/dragon-ball-"+stars+"/pet.png","Ngọc rồng "+stars+" sao"));
        BattleOnlineGiftClaimDto request=new BattleOnlineGiftClaimDto();request.setGiftId(id);
        return service.claimGift("DRAGON","alice",request);
    }
    @Test public void sevenDistinctBallsTripleTheCurrentTotalOnceIncludingTheLastBallAndClearActiveInversion() {
        for(int stars=1;stars<=6;stars++)pick(stars);
        assertEquals(310D,(Double)get(alice,"score"),0D);assertFalse(game.hasCompletedDragonBallCollection("alice"));
        pick(1);assertEquals(320D,(Double)get(alice,"score"),0D);assertEquals(6,game.snapshot("alice").collectedDragonBalls.size());
        set(alice,"invertedUntil",System.currentTimeMillis()+60000L);
        BattleOnlineGiftClaimResultDto completion=pick(7);
        assertEquals(1170D,(Double)get(alice,"score"),0D);assertEquals(70D,completion.getPoints(),0D);
        GiftDropGame.Snapshot snapshot=completion.getRoom().getGiftDrop();
        assertEquals(Arrays.asList(1,2,3,4,5,6,7),snapshot.collectedDragonBalls);
        assertEquals(390D,snapshot.dragonBallScoreBefore,0D);assertEquals(1170D,snapshot.dragonBallScoreAfter,0D);
        assertEquals(180000L,snapshot.dragonBallImmunityEndsAt-snapshot.dragonBallCollectionCompletedAt);
        assertEquals(5000L,snapshot.dragonBallCelebrationEndsAt-snapshot.dragonBallCollectionCompletedAt);
        assertEquals(0L,get(alice,"invertedUntil"));
        pick(7);assertEquals(1240D,(Double)get(alice,"score"),0D);
        assertEquals(snapshot.dragonBallImmunityEndsAt,game.snapshot("alice").dragonBallImmunityEndsAt);
        assertEquals(snapshot.dragonBallCelebrationEndsAt,game.snapshot("alice").dragonBallCelebrationEndsAt);
    }
    @Test public void reconnectAndPublicUpdatesKeepTheCollectionPrivateWhilePublishingTheShieldDeadline() {
        for(int stars=1;stars<=7;stars++)pick(stars);
        GiftDropGame.Snapshot first=game.snapshot("alice");
        BattleOnlineRoomDto reload=service.getRoom("DRAGON","alice");
        assertEquals(first.collectedDragonBalls,reload.getGiftDrop().collectedDragonBalls);
        assertEquals(first.dragonBallCollectionCompletedAt,reload.getGiftDrop().dragonBallCollectionCompletedAt);
        assertEquals(first.dragonBallCelebrationEndsAt,reload.getGiftDrop().dragonBallCelebrationEndsAt);
        assertTrue(service.getRoom("DRAGON","bob").getGiftDrop().collectedDragonBalls.isEmpty());
        BattleOnlineRoomDto publicRoom=ReflectionTestUtils.invokeMethod(service,"snapshotLocked",room,(String)null);
        assertNull(publicRoom.getGiftDrop().collectedDragonBalls);assertEquals(0L,publicRoom.getGiftDrop().dragonBallCollectionCompletedAt);
        for(BattleOnlinePlayerDto player:publicRoom.getPlayers()) {
            assertEquals("alice".equals(player.getUsername())?7:0,player.getCollectedDragonBallCount());
            assertEquals("alice".equals(player.getUsername())?first.dragonBallImmunityEndsAt:0L,player.getSkillImmunityEndsAt());
        }
    }
    @Test @SuppressWarnings("unchecked") public void everySkillRejectsAnImmuneTargetAndNormalAttacksResumeAfterExpiry() {
        for(int stars=1;stars<=7;stars++)pick(stars);
        set(room,"giftOpening",false);
        for(String skill:Arrays.asList("FREEZE","INVERT","STEAL_SCORE","BREAK_STREAK","MONEY_BEG","FIRE_UP","RESET_PASSWORD","UNFREEZE")) {
            assertFalse((Boolean)ReflectionTestUtils.invokeMethod(service,"isSkillTargetEligibleLocked",room,bob,alice,skill));
        }
        for(String skill:GiftDropGame.SKILL_TYPES) {
            set(bob,"pendingSkillType",skill);
            List<String> targets=(List<String>)get(bob,"pendingSkillTargetUsernames");targets.clear();targets.add("alice");targets.add("carol");
            BattleOnlineUseSkillDto request=new BattleOnlineUseSkillDto();request.setTargetUsername("alice");
            try{service.useSkill("DRAGON","bob",request);fail("Protected target accepted "+skill);}catch(BattleOnlineException expected){}
            assertEquals(1140D,(Double)get(alice,"score"),0D);assertEquals(0L,get(alice,"frozenUntil"));assertEquals(0L,get(alice,"invertedUntil"));
        }
        Object collection=((Map<String,Object>)get(game,"dragonBallCollections")).get("alice");
        set(collection,"immunityEndsAt",System.currentTimeMillis()-1L);
        assertTrue((Boolean)ReflectionTestUtils.invokeMethod(service,"isSkillTargetEligibleLocked",room,bob,alice,"FREEZE"));
        set(bob,"pendingSkillType","FREEZE");((List<String>)get(bob,"pendingSkillTargetUsernames")).clear();
        ((List<String>)get(bob,"pendingSkillTargetUsernames")).add("alice");
        BattleOnlineUseSkillDto request=new BattleOnlineUseSkillDto();request.setTargetUsername("alice");service.useSkill("DRAGON","bob",request);
        assertTrue((Long)get(alice,"frozenUntil")>System.currentTimeMillis());
    }
    @Test public void theFinalEggPhaseKeepsTheCollectionAndRewardButUsesItsExistingSkillFreeDraws() {
        for(int stars=1;stars<=7;stars++)pick(stars);
        GiftDropGame.Snapshot before=game.snapshot("alice");set(room,"giftOpening",false);
        ReflectionTestUtils.invokeMethod(service,"startGiftOpeningLocked",room);
        game=(GiftDropGame)get(room,"giftDrop");GiftDropGame.Snapshot after=game.snapshot("alice");
        assertNotEquals(before.gameId,after.gameId);assertEquals(before.collectedDragonBalls,after.collectedDragonBalls);
        assertEquals(before.dragonBallImmunityEndsAt,after.dragonBallImmunityEndsAt);
        assertEquals(before.dragonBallCelebrationEndsAt,after.dragonBallCelebrationEndsAt);
        assertTrue(((List<?>)get(game,"skillTypes")).isEmpty());
        set(room,"giftLightning",null);
        pick(1);assertEquals(1150D,(Double)get(alice,"score"),0D);
    }
    @Test public void completingOnTheLastCreditKeepsTheFiveSecondCelebrationInTheFinishedSnapshot() {
        for(int stars=1;stars<=6;stars++)pick(stars);
        set(alice,"giftCredits",1);set(bob,"giftCredits",0);
        BattleOnlineGiftClaimResultDto last=pick(7);
        assertEquals("FINISHED",last.getRoom().getStatus());assertEquals(1140D,(Double)get(alice,"score"),0D);
        assertEquals(7,last.getRoom().getGiftDrop().collectedDragonBalls.size());
        assertTrue(last.getRoom().getGiftDrop().dragonBallCelebrationEndsAt>last.getRoom().getServerTime());
        assertEquals(0L,new GiftDropGame(10,new Random(1)).snapshot("alice").dragonBallCollectionCompletedAt);
    }
    @Test public void truncatedClaimHistoryAndRepeatedBallsCannotEraseOrRewardTheCollectionAgain() {
        for(int stars=1;stars<=7;stars++)pick(stars);
        GiftDropGame.Snapshot before=game.snapshot("alice");
        for(int i=0;i<250;i++)game.recordClaim(new GiftDropGame.Gift("later-"+i,1001,10D),"alice","Alice",10D,System.currentTimeMillis());
        assertEquals(200,game.snapshot().claims.size());assertEquals(before.collectedDragonBalls,game.snapshot("alice").collectedDragonBalls);
        assertEquals(before.dragonBallCollectionCompletedAt,game.snapshot("alice").dragonBallCollectionCompletedAt);
        assertEquals(before.dragonBallScoreAfter,game.snapshot("alice").dragonBallScoreAfter,0D);
    }
    @Test public void publicRankingCountsOnlyDistinctCollectedBallsForEachPlayerAndDoesNotCreatePools() {
        int poolsBefore=((Map<?,?>)get(game,"playerPools")).size();
        assertEquals(0,game.collectedDragonBallCount("unseen"));
        assertEquals(poolsBefore,((Map<?,?>)get(game,"playerPools")).size());
        pick(1);pick(1);pick(5);
        BattleOnlineRoomDto live=ReflectionTestUtils.invokeMethod(service,"snapshotLocked",room,(String)null);
        for(BattleOnlinePlayerDto player:live.getPlayers()) {
            assertEquals("alice".equals(player.getUsername())?2:0,player.getCollectedDragonBallCount());
        }
        assertNull(live.getGiftDrop().collectedDragonBalls);
        assertEquals(2,game.snapshot("alice").collectedDragonBalls.size());
        assertEquals(2,game.collectedDragonBallCount("alice"));assertEquals(0,game.collectedDragonBallCount("bob"));
    }

}
