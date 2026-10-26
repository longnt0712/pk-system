package com.globits.richy.battle;

import com.globits.richy.dto.*;
import com.globits.richy.service.BattleOnlineException;
import com.globits.richy.service.impl.BattleOnlineServiceImpl;
import java.lang.reflect.Constructor;
import java.util.*;
import java.util.concurrent.*;
import javax.persistence.EntityManager;
import javax.persistence.Query;
import org.junit.*;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class BattleOnlineTeamManagementTest {
    private BattleOnlineServiceImpl service;
    private Object room, alice, bob, carol, settings;
    private static final String[] MODES = {"CLASSIC","COUNTDOWN","MONEY_BEG","ESCAPE_DUMB_DEMON","DEMON_DEFENSE","GUESS_WORD","LUM_NGAY"};
    private Object state(String name) throws Exception {
        Constructor<?> constructor = Class.forName(BattleOnlineServiceImpl.class.getName() + "$" + name).getDeclaredConstructor();
        constructor.setAccessible(true); return constructor.newInstance();
    }
    private Object get(Object value, String name) { return ReflectionTestUtils.getField(value,name); }
    private void set(Object value, String name, Object data) { ReflectionTestUtils.setField(value,name,data); }
    private Object player(String username,int team) throws Exception {
        Object value=state("PlayerState"); set(value,"username",username);set(value,"displayName",username);
        set(value,"connected",true);set(value,"ready",true);set(value,"teamNumber",team);return value;
    }
    @Before @SuppressWarnings("unchecked") public void setup() throws Exception {
        service=new BattleOnlineServiceImpl();set(service,"messagingTemplate",mock(SimpMessagingTemplate.class));
        ScheduledExecutorService scheduler=mock(ScheduledExecutorService.class);
        doReturn(mock(ScheduledFuture.class)).when(scheduler).schedule(any(Runnable.class),anyLong(),any(TimeUnit.class));
        set(service,"scheduler",scheduler);
        EntityManager em=mock(EntityManager.class);Query identity=mock(Query.class),roles=mock(Query.class);
        when(em.createQuery(anyString())).thenAnswer(call -> ((String)call.getArguments()[0]).contains("join u.roles")?roles:identity);
        when(identity.getResultList()).thenReturn(Collections.singletonList(new Object[]{4L,"New","Player","New Player",0L,"MAM_HOC"}));
        when(roles.getResultList()).thenReturn(Collections.emptyList());set(service,"entityManager",em);
        room=state("RoomState");set(room,"code","TEAMS1");set(room,"hostUsername","host");set(room,"status","LOBBY");
        set(room,"allQuestionsLoaded",true);set(room,"matchEndsAt",System.currentTimeMillis()+600000L);
        settings=get(room,"settings");set(settings,"teamCount",2);set(settings,"mode","CLASSIC");
        Object host=player("host",0);set(host,"host",true);set(host,"spectator",true);
        alice=player("alice",1);bob=player("bob",1);carol=player("carol",2);
        Map<String,Object> players=(Map<String,Object>)get(room,"players");
        players.put("host",host);players.put("alice",alice);players.put("bob",bob);players.put("carol",carol);
        ((Map<String,Object>)get(service,"rooms")).put("TEAMS1",room);
    }
    @After public void cleanup(){service.destroy();}
    private BattleOnlineTeamAssignmentDto assignment(String user,int team){BattleOnlineTeamAssignmentDto dto=new BattleOnlineTeamAssignmentDto();dto.setTargetUsername(user);dto.setTeamNumber(team);return dto;}
    private BattleOnlineCarryDto carry(boolean enabled){BattleOnlineCarryDto dto=new BattleOnlineCarryDto();dto.setEnabled(enabled);return dto;}
    private void rejected(Runnable operation,HttpStatus status){try{operation.run();fail("Expected rejection");}catch(BattleOnlineException expected){assertEquals(status,expected.getStatus());}}
    private BattleOnlinePlayerDto playerDto(BattleOnlineRoomDto dto,String user){return dto.getPlayers().stream().filter(p->user.equals(p.getUsername())).findFirst().get();}
    private DemonDefenseGame demonGame(long startedAt){
        Map<Integer,Integer> counts=new LinkedHashMap<Integer,Integer>();counts.put(1,2);counts.put(2,1);
        DemonDefenseGame game=new DemonDefenseGame(startedAt,counts);set(room,"demonDefense",game);return game;
    }
    @SuppressWarnings("unchecked") private Object seedDemon(DemonDefenseGame game,int team,int points,long now) throws Exception {
        Constructor<?> constructor=Class.forName(DemonDefenseGame.class.getName()+"$Enemy")
                .getDeclaredConstructor(long.class,long.class,long.class,boolean.class,int.class);
        constructor.setAccessible(true);Object state=((Map<?,?>)get(game,"teams")).get(team);
        ((List<Object>)get(state,"demons")).add(constructor.newInstance(1L,now-1000L,now+25000L,false,points));return state;
    }
    @Test public void studentsChooseTheirOwnTeamOnlyInLobbyWhileHostCanMoveDuringEveryTeamMode(){
        service.assignPlayerTeam("TEAMS1","alice",assignment("alice",2));assertEquals(2,get(alice,"teamNumber"));
        rejected(()->service.assignPlayerTeam("TEAMS1","alice",assignment("bob",2)),HttpStatus.FORBIDDEN);
        set(room,"status","PLAYING");
        rejected(()->service.assignPlayerTeam("TEAMS1","alice",assignment("alice",1)),HttpStatus.FORBIDDEN);
        for(String mode:MODES){
            set(settings,"mode",mode);set(alice,"score",37D);set(alice,"streak",25);long ends=(Long)get(room,"matchEndsAt");
            DemonDefenseGame game="DEMON_DEFENSE".equals(mode)?demonGame(System.currentTimeMillis()):null;
            BattleOnlineRoomDto moved=service.assignPlayerTeam("TEAMS1","host",assignment("alice",1));
            assertEquals(mode,1,playerDto(moved,"alice").getTeamNumber());assertEquals(37D,playerDto(moved,"alice").getScore(),0D);
            assertEquals(25,playerDto(moved,"alice").getStreak());assertEquals(ends,get(room,"matchEndsAt"));
            if(game!=null)assertSame(game,get(room,"demonDefense"));
        }
    }
    @Test public void hostChoosesMultipleCarryPlayersAndCanToggleEachWithoutAFullSettingsSave(){
        for(String status:Arrays.asList("LOBBY","PLAYING")){
            set(room,"status",status);
            for(String mode:MODES){
                set(settings,"mode",mode);
                service.setPlayerCarry("TEAMS1","host","alice",carry(true));
                service.setPlayerCarry("TEAMS1","host","bob",carry(true));
                BattleOnlineRoomDto dto=service.setPlayerCarry("TEAMS1","host","alice",carry(true));
                assertEquals(Arrays.asList("alice","bob"),dto.getSettings().getDoubleActionUsernames());
                dto=service.setPlayerCarry("TEAMS1","host","alice",carry(false));
                assertEquals(Collections.singletonList("bob"),dto.getSettings().getDoubleActionUsernames());
                assertEquals("bob",dto.getSettings().getDoubleActionUsername());
                dto=service.setPlayerCarry("TEAMS1","host","bob",carry(false));
                assertTrue(dto.getSettings().getDoubleActionUsernames().isEmpty());assertNull(dto.getSettings().getDoubleActionUsername());
            }
        }
    }
    @Test public void carryAuthorizationRejectsStudentsSpectatorsMissingFlagsAndFinishedMatches(){
        rejected(()->service.setPlayerCarry("TEAMS1","alice","alice",carry(true)),HttpStatus.FORBIDDEN);
        rejected(()->service.setPlayerCarry("TEAMS1","host","host",carry(true)),HttpStatus.CONFLICT);
        rejected(()->service.setPlayerCarry("TEAMS1","host","alice",new BattleOnlineCarryDto()),HttpStatus.BAD_REQUEST);
        set(settings,"teamCount",0);rejected(()->service.setPlayerCarry("TEAMS1","host","alice",carry(true)),HttpStatus.CONFLICT);
        set(settings,"teamCount",2);set(room,"status","FINISHED");
        rejected(()->service.setPlayerCarry("TEAMS1","host","alice",carry(true)),HttpStatus.CONFLICT);
        rejected(()->service.assignPlayerTeam("TEAMS1","host",assignment("alice",2)),HttpStatus.CONFLICT);
    }
    @Test public void multipleCarrySettingsDeduplicateValidateAndCopyWithoutAliasingWhileLegacyStillWorks(){
        BattleOnlineRoomSettingsDto dto=new BattleOnlineRoomSettingsDto();dto.setTeamCount(2);dto.setMode("CLASSIC");
        dto.setDoubleActionUsernames(Arrays.asList(" alice ","bob","alice","ghost","host",null));
        BattleOnlineRoomDto saved=service.updateSettings("TEAMS1","host",dto);
        assertEquals(Arrays.asList("alice","bob"),saved.getSettings().getDoubleActionUsernames());
        saved.getSettings().getDoubleActionUsernames().clear();
        assertEquals(2,service.getRoom("TEAMS1","host").getSettings().getDoubleActionUsernames().size());
        dto.setDoubleActionUsernames(null);dto.setDoubleActionUsername("carol");
        assertEquals(Collections.singletonList("carol"),service.updateSettings("TEAMS1","host",dto).getSettings().getDoubleActionUsernames());
        dto.setDoubleActionUsernames(Collections.<String>emptyList());
        assertTrue(service.updateSettings("TEAMS1","host",dto).getSettings().getDoubleActionUsernames().isEmpty());
    }
    @Test public void bothSelectedPlayersReceiveExactlyDoubleScoreIncludingPenalties(){
        service.setPlayerCarry("TEAMS1","host","alice",carry(true));service.setPlayerCarry("TEAMS1","host","bob",carry(true));
        set(alice,"score",5D);set(bob,"score",5D);set(carol,"score",5D);
        assertEquals(10D,(Double)ReflectionTestUtils.invokeMethod(service,"applyDoubleActionScoreLocked",room,alice,5D),0D);
        assertEquals(-4D,(Double)ReflectionTestUtils.invokeMethod(service,"applyDoubleActionScoreLocked",room,bob,-2D),0D);
        assertEquals(5D,(Double)ReflectionTestUtils.invokeMethod(service,"applyDoubleActionScoreLocked",room,carol,5D),0D);
        assertEquals(10D,get(alice,"score"));assertEquals(3D,get(bob,"score"));assertEquals(5D,get(carol,"score"));
    }
    @Test @SuppressWarnings("unchecked") public void demonLateJoinReceivesAQuestionInALivingBalancedTeamWithoutRestartingTheArena() throws Exception {
        set(room,"status","PLAYING");set(settings,"mode","DEMON_DEFENSE");DemonDefenseGame game=demonGame(System.currentTimeMillis());
        Object question=state("QuestionState");set(question,"id",7L);set(question,"question","hello");set(question,"correctKey","A");
        ((Map<Long,Object>)get(room,"preparedQuestions")).put(7L,question);
        ((List<Long>)get(room,"countdownQuestionIds")).add(7L);
        BattleOnlineRoomDto joined=service.joinRoom("TEAMS1","newbie");
        BattleOnlinePlayerDto newbie=playerDto(joined,"newbie");
        assertEquals(2,newbie.getTeamNumber());assertTrue(newbie.isReady());assertEquals(1,newbie.getDemonBullets());
        assertNotNull(joined.getCurrentQuestion());
        assertSame(game,get(room,"demonDefense"));assertEquals(2,joined.getDemonDefense().teams.stream().filter(t->t.number==2).findFirst().get().memberCount);
        service.assignPlayerTeam("TEAMS1","host",assignment("newbie",1));
        BattleOnlineRoomDto moved=service.getRoom("TEAMS1","host");
        assertEquals(3,moved.getDemonDefense().teams.stream().filter(t->t.number==1).findFirst().get().memberCount);
        assertSame(game,get(room,"demonDefense"));
    }
    @Test public void liveDemonMovesCannotEmptyTheSourceTeamButKickSettlesAnEmptyLane(){
        set(room,"status","PLAYING");set(settings,"mode","DEMON_DEFENSE");DemonDefenseGame game=demonGame(System.currentTimeMillis());
        rejected(()->service.assignPlayerTeam("TEAMS1","host",assignment("carol",1)),HttpStatus.CONFLICT);
        assertEquals(2,get(carol,"teamNumber"));assertFalse(game.isEliminated(2));
        BattleOnlineRoomDto ended=service.kickPlayer("TEAMS1","host","carol");
        assertTrue(game.isEliminated(2));assertTrue(game.isFinished());assertEquals("FINISHED",ended.getStatus());
    }
    @Test public void levelTransitionCheckpointsEveryPlayersCurrentGunAndWrongAnswerKeepsThatFloor() throws Exception {
        long now=System.currentTimeMillis();set(room,"status","PLAYING");set(settings,"mode","DEMON_DEFENSE");
        DemonDefenseGame game=demonGame(now);Object team=seedDemon(game,1,1,now);set(team,"levelPoints",19);
        set(alice,"streak",19);set(bob,"streak",30);
        Object question=state("QuestionState");set(question,"id",7L);set(question,"question","hello");set(question,"correctKey","A");
        set(alice,"currentQuestion",question);set(alice,"currentQuestionSequence",1L);
        BattleOnlineAnswerDto request=new BattleOnlineAnswerDto();request.setQuestionId(7L);request.setQuestionSequence(1L);request.setAnswerKey("A");
        BattleOnlineAnswerResultDto correct=service.answer("TEAMS1","alice",request);
        assertEquals(2,correct.getRoom().getDemonDefense().level);
        assertEquals(2,playerDto(correct.getRoom(),"alice").getDemonMinimumBullets());
        assertEquals(3,playerDto(correct.getRoom(),"bob").getDemonMinimumBullets());
        set(alice,"currentQuestion",question);set(alice,"currentQuestionSequence",2L);
        request.setQuestionSequence(2L);request.setAnswerKey("B");
        BattleOnlineAnswerResultDto wrong=service.answer("TEAMS1","alice",request);
        assertEquals(0,wrong.getStreak());assertEquals(2,playerDto(wrong.getRoom(),"alice").getDemonBullets());
        assertEquals(2,game.minimumBulletsForPlayer("alice"));
    }
    @Test public void kickingASelectedPlayerClearsOnlyTheirCarrySelection(){
        set(room,"status","PLAYING");
        service.setPlayerCarry("TEAMS1","host","alice",carry(true));service.setPlayerCarry("TEAMS1","host","bob",carry(true));
        BattleOnlineRoomDto kicked=service.kickPlayer("TEAMS1","host","alice");
        assertEquals(Collections.singletonList("bob"),kicked.getSettings().getDoubleActionUsernames());
        rejected(()->service.joinRoom("TEAMS1","alice"),HttpStatus.FORBIDDEN);
    }
    @Test public void demonCarryDoublesShotsWhileKillPointsAreScoredOnce() throws Exception {
        set(room,"status","PLAYING");set(settings,"mode","DEMON_DEFENSE");demonGame(System.currentTimeMillis()-10000L);
        service.setPlayerCarry("TEAMS1","host","alice",carry(true));
        BattleOnlineRoomDto before=service.getRoom("TEAMS1","alice");assertEquals(2,playerDto(before,"alice").getDemonBullets());
        Object question=state("QuestionState");set(question,"id",7L);set(question,"question","hello");set(question,"correctKey","A");set(question,"correctText","xin chào");
        set(alice,"currentQuestion",question);set(alice,"currentQuestionSequence",1L);
        BattleOnlineAnswerDto request=new BattleOnlineAnswerDto();request.setQuestionId(7L);request.setQuestionSequence(1L);request.setAnswerKey("A");
        BattleOnlineAnswerResultDto result=service.answer("TEAMS1","alice",request);
        assertTrue(result.getMessage().contains("Bắn 2 viên"));assertEquals(2D,result.getScore(),0D);
    }
}
