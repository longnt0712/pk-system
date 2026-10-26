package com.globits.richy.battle;

import com.globits.richy.dto.BattleOnlineCarryDto;
import com.globits.richy.dto.BattleOnlinePlayerDto;
import com.globits.richy.dto.BattleOnlineRoomDto;
import com.globits.richy.service.BattleOnlineException;
import com.globits.richy.service.impl.BattleOnlineServiceImpl;
import java.lang.reflect.Constructor;
import java.util.*;
import java.util.concurrent.*;
import org.junit.*;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class BattleOnlineTeamRandomizationTest {
    private BattleOnlineServiceImpl service;
    private Object room, settings;
    private Map<String,Object> players;
    private static final String[] MODES={"CLASSIC","COUNTDOWN","MONEY_BEG","ESCAPE_DUMB_DEMON","DEMON_DEFENSE","GUESS_WORD","LUM_NGAY"};
    private Object get(Object value,String name){return ReflectionTestUtils.getField(value,name);}
    private void set(Object value,String name,Object data){ReflectionTestUtils.setField(value,name,data);}
    private Object state(String name) throws Exception {
        Constructor<?> constructor=Class.forName(BattleOnlineServiceImpl.class.getName()+"$"+name).getDeclaredConstructor();
        constructor.setAccessible(true);return constructor.newInstance();
    }
    private Object addPlayer(String name,int team,boolean spectator,boolean connected) throws Exception {
        Object player=state("PlayerState");set(player,"username",name);set(player,"displayName",name);
        set(player,"teamNumber",team);set(player,"spectator",spectator);set(player,"connected",connected);set(player,"ready",true);
        players.put(name,player);return player;
    }
    @Before @SuppressWarnings("unchecked") public void setup() throws Exception {
        service=new BattleOnlineServiceImpl();set(service,"messagingTemplate",mock(SimpMessagingTemplate.class));
        ScheduledExecutorService scheduler=mock(ScheduledExecutorService.class);
        doReturn(mock(ScheduledFuture.class)).when(scheduler).schedule(any(Runnable.class),anyLong(),any(TimeUnit.class));set(service,"scheduler",scheduler);
        room=state("RoomState");set(room,"code","RANDOM1");set(room,"hostUsername","host");set(room,"status","LOBBY");
        set(room,"allQuestionsLoaded",true);set(room,"matchEndsAt",System.currentTimeMillis()+600000L);set(room,"questionEndsAt",System.currentTimeMillis()+60000L);
        settings=get(room,"settings");set(settings,"teamCount",2);set(settings,"mode","CLASSIC");
        players=(Map<String,Object>)get(room,"players");set(addPlayer("host",0,true,true),"host",true);
        addPlayer("alice",1,false,true);addPlayer("bob",1,false,true);addPlayer("carol",2,false,true);addPlayer("dave",2,false,false);
        ((Map<String,Object>)get(service,"rooms")).put("RANDOM1",room);
    }
    @After public void cleanup(){service.destroy();}
    private Map<String,Integer> assignments(){
        Map<String,Integer> result=new LinkedHashMap<String,Integer>();
        for(Map.Entry<String,Object> entry:players.entrySet())result.put(entry.getKey(),(Integer)get(entry.getValue(),"teamNumber"));
        return result;
    }
    private void assertBalanced(BattleOnlineRoomDto dto,int teamCount){
        int[] counts=new int[teamCount];
        for(BattleOnlinePlayerDto player:dto.getPlayers())if(!player.isSpectator()){
            assertTrue(player.getTeamNumber()>=1&&player.getTeamNumber()<=teamCount);counts[player.getTeamNumber()-1]++;
        }
        int minimum=Integer.MAX_VALUE,maximum=0;for(int count:counts){minimum=Math.min(minimum,count);maximum=Math.max(maximum,count);}
        assertTrue("Team sizes differ by more than one",maximum-minimum<=1);
    }
    private void rejected(String requester,HttpStatus expected){
        Map<String,Integer> before=assignments();
        try{service.randomizeTeams("RANDOM1",requester);fail("Request should be rejected");}
        catch(BattleOnlineException exception){assertEquals(expected,exception.getStatus());}
        assertEquals(before,assignments());
    }
    private DemonDefenseGame demonGame(Map<Integer,Integer> members,long now){
        DemonDefenseGame game=new DemonDefenseGame(now,members);set(room,"demonDefense",game);return game;
    }
    @Test public void randomizeWorksRepeatedlyBeforeAndDuringEveryModeWithoutChangingScoresOrClocks(){
        for(String status:Arrays.asList("LOBBY","PLAYING"))for(String mode:MODES){
            set(room,"status",status);set(settings,"mode",mode);
            if("PLAYING".equals(status)&&"DEMON_DEFENSE".equals(mode)){
                Map<Integer,Integer> members=new LinkedHashMap<Integer,Integer>();members.put(1,2);members.put(2,2);demonGame(members,System.currentTimeMillis());
            }else set(room,"demonDefense",null);
            set(players.get("alice"),"score",17D);set(players.get("alice"),"streak",25);
            long matchEnd=(Long)get(room,"matchEndsAt"),questionEnd=(Long)get(room,"questionEndsAt");
            for(int click=0;click<8;click++){
                Map<String,Integer> previous=assignments();
                BattleOnlineRoomDto result=service.randomizeTeams("RANDOM1","host");
                assertFalse(mode+" click "+click+" must change the arrangement",previous.equals(assignments()));assertBalanced(result,2);
                assertEquals(0,get(players.get("host"),"teamNumber"));assertEquals(17D,get(players.get("alice"),"score"));
                assertEquals(25,get(players.get("alice"),"streak"));assertEquals(matchEnd,get(room,"matchEndsAt"));assertEquals(questionEnd,get(room,"questionEndsAt"));
            }
        }
    }
    @Test public void anIdenticalRandomDrawStillChangesTeamsAndTwoPlayersCanSwapAtomically() throws Exception {
        set(service,"random",new Random(){@Override public int nextInt(int bound){return bound-1;}});
        players.remove("carol");players.remove("dave");set(players.get("bob"),"teamNumber",2);
        set(room,"status","PLAYING");set(settings,"mode","DEMON_DEFENSE");
        Map<Integer,Integer> members=new LinkedHashMap<Integer,Integer>();members.put(1,1);members.put(2,1);
        DemonDefenseGame game=demonGame(members,System.currentTimeMillis());
        Map<String,Integer> original=assignments();
        for(int click=0;click<5;click++){
            Map<String,Integer> previous=assignments();assertBalanced(service.randomizeTeams("RANDOM1","host"),2);
            assertFalse(previous.equals(assignments()));assertFalse(game.isFinished());
            assertFalse(game.isEliminated(1));assertFalse(game.isEliminated(2));
        }
        assertFalse(original.equals(assignments()));
    }
    @Test public void balancingIncludesOfflineAndUnassignedPlayersAndLeavesSpectatorsAlone() throws Exception {
        set(settings,"teamCount",3);set(players.get("alice"),"teamNumber",0);set(players.get("bob"),"teamNumber",0);
        addPlayer("erin",1,false,true);addPlayer("frank",1,false,true);addPlayer("grace",1,false,true);addPlayer("henry",1,false,true);
        addPlayer("observer",0,true,true);
        BattleOnlineRoomDto result=service.randomizeTeams("RANDOM1","host");assertBalanced(result,3);
        assertEquals(0,get(players.get("observer"),"teamNumber"));assertFalse((Boolean)get(players.get("dave"),"connected"));
        assertTrue((Integer)get(players.get("dave"),"teamNumber")>=1);
    }
    @Test public void randomizationRequiresTheHostTeamModeAndAnActiveRoomState(){
        rejected("alice",HttpStatus.FORBIDDEN);rejected("intruder",HttpStatus.FORBIDDEN);
        set(settings,"teamCount",0);rejected("host",HttpStatus.CONFLICT);set(settings,"teamCount",2);
        for(String status:Arrays.asList("FINISHED","EXPIRED")){set(room,"status",status);rejected("host",HttpStatus.CONFLICT);}
        set(room,"status","LOBBY");players.keySet().retainAll(Collections.singleton("host"));rejected("host",HttpStatus.CONFLICT);
    }
    @Test @SuppressWarnings("unchecked") public void liveDemonRandomizationPreservesEliminatedTeamsArenaProgressAndGunCheckpoints() throws Exception {
        set(room,"status","PLAYING");set(settings,"mode","DEMON_DEFENSE");set(settings,"teamCount",3);
        addPlayer("eliminated",3,false,true);
        long now=System.currentTimeMillis();Map<Integer,Integer> members=new LinkedHashMap<Integer,Integer>();members.put(1,2);members.put(2,2);members.put(3,1);
        DemonDefenseGame game=demonGame(members,now);Map<Integer,Object> lanes=(Map<Integer,Object>)get(game,"teams");
        set(lanes.get(3),"eliminatedAt",now);set(game,"level",3);set(lanes.get(1),"points",45);set(lanes.get(1),"levelPoints",5);
        Map<String,Integer> roster=new LinkedHashMap<String,Integer>(),streaks=new LinkedHashMap<String,Integer>();
        for(Map.Entry<String,Object> entry:players.entrySet())if(!(Boolean)get(entry.getValue(),"spectator")){
            roster.put(entry.getKey(),(Integer)get(entry.getValue(),"teamNumber"));streaks.put(entry.getKey(),0);
        }
        game.syncPlayers(roster,streaks,now);
        Object progress=((Map<String,Object>)get(game,"players")).get("alice");set(progress,"bulletFloor",2);
        Constructor<?> enemy=Class.forName(DemonDefenseGame.class.getName()+"$Enemy").getDeclaredConstructor(long.class,long.class,long.class,boolean.class,int.class);
        enemy.setAccessible(true);Object seeded=enemy.newInstance(1L,now-1000L,now+25000L,false,3);
        ((List<Object>)get(lanes.get(1),"demons")).add(seeded);
        BattleOnlineCarryDto carry=new BattleOnlineCarryDto();carry.setEnabled(true);service.setPlayerCarry("RANDOM1","host","alice",carry);
        for(int click=0;click<8;click++){
            Map<String,Integer> previous=assignments();BattleOnlineRoomDto result=service.randomizeTeams("RANDOM1","host");
            assertFalse(previous.equals(assignments()));assertSame(game,get(room,"demonDefense"));assertEquals("PLAYING",result.getStatus());
            assertEquals(3,get(players.get("eliminated"),"teamNumber"));assertTrue(game.isEliminated(3));
            assertEquals(3,result.getDemonDefense().level);assertEquals(45,get(lanes.get(1),"points"));assertEquals(5,get(lanes.get(1),"levelPoints"));
            assertSame(seeded,((List<?>)get(lanes.get(1),"demons")).get(0));assertEquals(2,game.minimumBulletsForPlayer("alice"));
            assertEquals(Collections.singletonList("alice"),result.getSettings().getDoubleActionUsernames());
            assertEquals(2,get(lanes.get(1),"memberCount"));assertEquals(2,get(lanes.get(2),"memberCount"));assertFalse(game.isFinished());
        }
    }
}
