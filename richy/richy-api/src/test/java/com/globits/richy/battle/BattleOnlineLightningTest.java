package com.globits.richy.battle;
import java.util.Random;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;
import com.globits.richy.service.impl.BattleOnlineServiceImpl;
import com.globits.richy.dto.*;
import static org.junit.Assert.*;
public class BattleOnlineLightningTest extends BattleOnlineGiftDropTest {
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
