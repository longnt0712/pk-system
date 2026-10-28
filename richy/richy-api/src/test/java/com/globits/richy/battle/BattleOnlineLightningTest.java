package com.globits.richy.battle;
import java.util.Random;
import java.util.Map;
import java.util.List;
import java.lang.reflect.Constructor;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;
import com.globits.richy.service.impl.BattleOnlineServiceImpl;
import com.globits.richy.dto.*;
import com.globits.richy.service.BattleMusicConfigService;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
public class BattleOnlineLightningTest extends BattleOnlineGiftDropTest {
    @Test public void luckyAppearanceIsPinnedAtStartAndSurvivesReconnectAndFinalEggOpening() throws Exception {
        BattleOnlineServiceImpl service=(BattleOnlineServiceImpl)ReflectionTestUtils.getField(this,"service");
        Object room=ReflectionTestUtils.getField(this,"room");
        BattleMusicConfigService config=mock(BattleMusicConfigService.class);
        when(config.getLumLuckyAppearance()).thenReturn("LIGHTNING");
        ReflectionTestUtils.setField(service,"battleMusicConfigService",config);
        prepareStart(room);
        assertEquals("LIGHTNING",service.startMatch("GIFTS1","host").getLumLuckyAppearance());
        when(config.getLumLuckyAppearance()).thenReturn("PUMPKIN");
        assertEquals("LIGHTNING",service.getRoom("GIFTS1","alice").getLumLuckyAppearance());
        assertEquals("LIGHTNING",service.getRoom("GIFTS1","host").getLumLuckyAppearance());
        Object alice=ReflectionTestUtils.getField(this,"alice");ReflectionTestUtils.setField(alice,"giftCredits",2);
        ReflectionTestUtils.invokeMethod(service,"finishMatchLocked",room);
        assertTrue(service.getRoom("GIFTS1","alice").isGiftOpening());
        assertEquals("LIGHTNING",service.getRoom("GIFTS1","alice").getLumLuckyAppearance());
        verify(config,times(1)).getLumLuckyAppearance();
    }

    @SuppressWarnings("unchecked") private void prepareStart(Object room) throws Exception {
        ReflectionTestUtils.setField(room,"status","LOBBY");
        ReflectionTestUtils.setField(room,"giftDrop",null);
        BattleOnlineServiceImpl service=(BattleOnlineServiceImpl)ReflectionTestUtils.getField(this,"service");
        BattleOnlineRoomSettingsDto config=new BattleOnlineRoomSettingsDto();config.setMode("LUM_NGAY");config.setQuestionCount(4);config.setSkillsEnabled(false);
        service.updateSettings("GIFTS1","host",config);
        ReflectionTestUtils.setField(room,"allQuestionsLoaded",true);
        Object settings=ReflectionTestUtils.getField(room,"settings");ReflectionTestUtils.setField(settings,"questionCount",4);
        Map<Long,Object> prepared=(Map<Long,Object>)ReflectionTestUtils.getField(room,"preparedQuestions");
        for(long id=1;id<=4;id++){
            Constructor<?> constructor=Class.forName(BattleOnlineServiceImpl.class.getName()+"$QuestionState").getDeclaredConstructor();
            constructor.setAccessible(true);Object question=constructor.newInstance();
            ReflectionTestUtils.setField(question,"id",id);ReflectionTestUtils.setField(question,"question","word"+id);
            ReflectionTestUtils.setField(question,"correctKey","A");ReflectionTestUtils.setField(question,"correctText","answer"+id);
            List<Object> options=(List<Object>)ReflectionTestUtils.getField(question,"options");
            for(char key='A';key<='D';key++){
                Constructor<?> optionConstructor=Class.forName(BattleOnlineServiceImpl.class.getName()+"$OptionState").getDeclaredConstructor();
                optionConstructor.setAccessible(true);Object option=optionConstructor.newInstance();
                ReflectionTestUtils.setField(option,"key",String.valueOf(key));ReflectionTestUtils.setField(option,"text","answer"+key);options.add(option);
            }
            prepared.put(id,question);
        }
    }

    @Test public void bothLuckyAppearancesKeepTheSameRoomBonusAndClaimHistoryMetadata() {
        BattleOnlineServiceImpl service=(BattleOnlineServiceImpl)ReflectionTestUtils.getField(this,"service");
        Object room=ReflectionTestUtils.getField(this,"room"),alice=ReflectionTestUtils.getField(this,"alice");
        for(String appearance:new String[]{"PUMPKIN","LIGHTNING"}){
            long now=System.currentTimeMillis();
            ReflectionTestUtils.setField(room,"lumLuckyAppearance",appearance);
            ReflectionTestUtils.setField(room,"giftOpening",false);ReflectionTestUtils.setField(room,"matchEndsAt",now+300000L);
            ReflectionTestUtils.setField(alice,"giftCredits",2);
            ReflectionTestUtils.setField(room,"giftLightning",new GiftLightningGame(now,now+300000L,new Random(){@Override public int nextInt(int bound){return 0;}}));
            BattleOnlineGiftClaimDto claim=new BattleOnlineGiftClaimDto();claim.setGiftId(service.getRoom("GIFTS1","alice").getGiftDrop().gifts.get(0).id);
            BattleOnlineGiftClaimResultDto reward=service.claimGift("GIFTS1","alice",claim);
            assertEquals(GiftDropGame.LIGHTNING_LEVEL,reward.getRewardLevel());assertEquals(0D,reward.getPoints(),0D);
            String image="assets/images/battle-"+("PUMPKIN".equals(appearance)?"pumpkin":"lightning")+".svg";
            assertEquals(image,reward.getRewardImage());assertTrue(reward.getRewardLabel().startsWith("PUMPKIN".equals(appearance)?"Bí ngô":"Sét"));
            GiftLightningGame.Snapshot other=service.getRoom("GIFTS1","bob").getGiftLightning();
            assertTrue(other.active);assertEquals(GiftLightningGame.DURATION_MS,other.endsAt-other.startsAt);assertEquals(.10D,other.relativeBoost,0D);
            assertEquals(appearance,service.getRoom("GIFTS1","host").getLumLuckyAppearance());
            boolean matchingHistory=false;
            for(GiftDropGame.ClaimRecord record:reward.getRoom().getGiftDrop().claims){
                if(record.id.equals(claim.getGiftId())){matchingHistory=true;assertEquals(image,record.rewardImage);assertEquals(reward.getRewardLabel(),record.rewardLabel);}
            }
            assertTrue(matchingHistory);
        }
    }
    @Test public void lastFinalCreditReturnsANormalRewardInsteadOfAnUnusableLightning() {
        BattleOnlineServiceImpl service=(BattleOnlineServiceImpl)ReflectionTestUtils.getField(this,"service");
        Object room=ReflectionTestUtils.getField(this,"room"),alice=ReflectionTestUtils.getField(this,"alice");
        long now=System.currentTimeMillis();
        ReflectionTestUtils.setField(alice,"giftCredits",1);
        ReflectionTestUtils.setField(room,"giftLightning",new GiftLightningGame(now,now+180000L,new Random(){@Override public int nextInt(int bound){return 0;}}));
        BattleOnlineGiftClaimDto claim=new BattleOnlineGiftClaimDto();claim.setGiftId(service.getRoom("GIFTS1","alice").getGiftDrop().gifts.get(0).id);
        BattleOnlineGiftClaimResultDto reward=service.claimGift("GIFTS1","alice",claim);
        assertNotEquals(GiftDropGame.LIGHTNING_LEVEL,reward.getRewardLevel());
        assertEquals("FINISHED",reward.getRoom().getStatus());
    }
    @Test public void onePlayersLightningPickupIsVisibleToEveryPlayerAndCannotBeClaimedTwice() {
        BattleOnlineServiceImpl service=(BattleOnlineServiceImpl)ReflectionTestUtils.getField(this,"service");
        Object room=ReflectionTestUtils.getField(this,"room"),alice=ReflectionTestUtils.getField(this,"alice"),bob=ReflectionTestUtils.getField(this,"bob");
        long now=System.currentTimeMillis();
        ReflectionTestUtils.setField(room,"giftOpening",false);ReflectionTestUtils.setField(room,"matchEndsAt",now+300000L);
        ReflectionTestUtils.setField(alice,"giftCredits",2);ReflectionTestUtils.setField(bob,"giftCredits",2);
        ReflectionTestUtils.setField(room,"giftLightning",new GiftLightningGame(now,now+300000L,new Random(){@Override public int nextInt(int bound){return 0;}}));
        BattleOnlineGiftClaimDto claim=new BattleOnlineGiftClaimDto();claim.setGiftId(service.getRoom("GIFTS1","alice").getGiftDrop().gifts.get(0).id);
        BattleOnlineGiftClaimResultDto reward=service.claimGift("GIFTS1","alice",claim);
        assertEquals(GiftDropGame.LIGHTNING_LEVEL,reward.getRewardLevel());assertEquals(0D,reward.getPoints(),0D);
        GiftLightningGame.Snapshot other=service.getRoom("GIFTS1","bob").getGiftLightning();
        assertTrue(other.active);assertEquals("alice",other.username);assertEquals(reward.getRoom().getGiftLightning().endsAt,other.endsAt);
        try{service.claimGift("GIFTS1","alice",claim);fail("Duplicate claim must fail");}catch(com.globits.richy.service.BattleOnlineException expected){}
        assertEquals(1,service.getRoom("GIFTS1","bob").getGiftLightning().collectedCount);
    }
}
