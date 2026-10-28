package com.globits.richy.battle;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.globits.richy.dto.*;
import com.globits.richy.rest.RestBattleOnlineController;
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
import org.springframework.security.access.annotation.Secured;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class BattleOnlineAdminRoomsTest {
    private BattleOnlineServiceImpl service;
    private SimpMessagingTemplate messaging;
    private static final String[] MODES = {"CLASSIC","GUESS_WORD","COUNTDOWN","MONEY_BEG","ESCAPE_DUMB_DEMON","DEMON_DEFENSE","LUM_NGAY"};

    @Before public void setup() {
        SecurityContextHolder.clearContext();
        service = new BattleOnlineServiceImpl(); messaging = mock(SimpMessagingTemplate.class);
        set(service,"messagingTemplate",messaging); admin();
    }
    @After public void cleanup() { service.destroy(); SecurityContextHolder.clearContext(); }
    private void set(Object target,String field,Object value) { ReflectionTestUtils.setField(target,field,value); }
    private Object get(Object target,String field) { return ReflectionTestUtils.getField(target,field); }
    private Object state(String name) throws Exception {
        Constructor<?> constructor=Class.forName(BattleOnlineServiceImpl.class.getName()+"$"+name).getDeclaredConstructor();
        constructor.setAccessible(true);return constructor.newInstance();
    }
    private void admin() { authentication("observer", "ROLE_ADMIN"); }
    private void authentication(String username,String role) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(username,"ignored",
                role == null ? Collections.emptyList() : Collections.singletonList(new SimpleGrantedAuthority(role))));
    }
    @SuppressWarnings("unchecked") private Map<String,Object> rooms() { return (Map<String,Object>)get(service,"rooms"); }
    @SuppressWarnings("unchecked") private Map<String,Object> players(Object room) { return (Map<String,Object>)get(room,"players"); }
    private Object player(String username,boolean spectator,boolean connected) throws Exception {
        Object player=state("PlayerState");set(player,"username",username);set(player,"displayName",username+" display");
        set(player,"realName",username+" real");set(player,"spectator",spectator);set(player,"connected",connected);set(player,"ready",true);
        return player;
    }
    private Object room(String code,String status,String mode) throws Exception {
        Object room=state("RoomState");set(room,"code",code);set(room,"status",status);set(room,"hostUsername","teacher");
        set(room,"matchEndsAt",System.currentTimeMillis()+300000L);set(get(room,"settings"),"mode",mode);
        set(get(room,"settings"),"topicNames",Arrays.asList("Topic A","Topic B"));
        Object host=player("teacher",true,true);set(host,"host",true);players(room).put("teacher",host);
        players(room).put("alice",player("alice",false,true));players(room).put("bob",player("bob",false,false));
        rooms().put(code,room);return room;
    }
    private void forbidden(Runnable action) {
        try { action.run();fail("Only actual authenticated administrators may use this operation"); }
        catch(BattleOnlineException expected) { assertEquals(HttpStatus.FORBIDDEN,expected.getStatus()); }
    }
    private void conflict(Runnable action) {
        try { action.run();fail("A terminated room must not resume"); }
        catch(BattleOnlineException expected) { assertEquals(HttpStatus.CONFLICT,expected.getStatus()); }
    }

    @Test public void serviceAndControllerRejectUsersViewersMissingAuthAndForgedAdminNames() throws Exception {
        Object waiting=room("AUTH1","LOBBY","CLASSIC");
        RestBattleOnlineController controller=new RestBattleOnlineController();set(controller,"battleOnlineService",service);
        for(String role:new String[]{"ROLE_USER","ROLE_VIEWER",null}) {
            authentication("admin",role);
            forbidden(()->service.getAdminRooms());forbidden(()->service.terminateRoomAsAdmin("AUTH1"));
            forbidden(()->controller.getAdminRooms());forbidden(()->controller.terminateRoomAsAdmin("AUTH1"));
        }
        SecurityContextHolder.clearContext();forbidden(()->service.getAdminRooms());forbidden(()->service.terminateRoomAsAdmin("AUTH1"));
        Authentication unauthenticated=new UsernamePasswordAuthenticationToken("admin","password");
        SecurityContextHolder.getContext().setAuthentication(unauthenticated);forbidden(()->service.getAdminRooms());
        assertEquals("LOBBY",get(waiting,"status"));assertFalse((Boolean)get(waiting,"adminTerminated"));verifyZeroInteractions(messaging);
        for(java.lang.reflect.Method method:new java.lang.reflect.Method[]{
                RestBattleOnlineController.class.getMethod("getAdminRooms"),RestBattleOnlineController.class.getMethod("terminateRoomAsAdmin",String.class),
                BattleOnlineServiceImpl.class.getMethod("getAdminRooms"),BattleOnlineServiceImpl.class.getMethod("terminateRoomAsAdmin",String.class)}) {
            assertArrayEquals(new String[]{"ROLE_ADMIN"},method.getAnnotation(Secured.class).value());
        }
    }

    @Test public void adminListsOnlyLiveRoomMetadataWithoutJoiningOrExposingAnswersAndPasswords() throws Exception {
        Object waiting=room("WAIT1","LOBBY","CLASSIC"),playing=room("PLAY1","PLAYING","LUM_NGAY");
        set(waiting,"createdAt",1000L);set(waiting,"startedAt",0L);set(waiting,"updatedAt",2000L);
        set(playing,"createdAt",1500L);set(playing,"startedAt",2500L);set(playing,"updatedAt",3000L);set(playing,"giftOpening",true);
        set(players(playing).get("alice"),"currentPassword","secret123");players(playing).put("viewer",player("viewer",true,false));
        room("DONE1","FINISHED","COUNTDOWN");room("OLD1","EXPIRED","CLASSIC");
        List<BattleOnlineAdminRoomDto> list=service.getAdminRooms();
        assertEquals(2,list.size());assertEquals("PLAY1",list.get(0).getCode());assertEquals("WAIT1",list.get(1).getCode());
        BattleOnlineAdminRoomDto summary=list.get(0);assertEquals("teacher",summary.getHostUsername());assertEquals("teacher display",summary.getHostDisplayName());
        assertEquals("Topic A • Topic B",summary.getTopicName());assertEquals("LUM_NGAY",summary.getMode());
        assertEquals(2,summary.getPlayerCount());assertEquals(1,summary.getConnectedPlayerCount());assertEquals(2,summary.getSpectatorCount());
        assertEquals(1500L,summary.getCreatedAt());assertEquals(2500L,summary.getStartedAt());assertTrue(summary.isGiftOpening());
        JsonNode json=new ObjectMapper().valueToTree(summary);
        Set<String> fields=new HashSet<String>();json.fieldNames().forEachRemaining(fields::add);
        assertEquals(new HashSet<String>(Arrays.asList("code","status","mode","hostUsername","hostDisplayName","topicName","createdAt","startedAt","updatedAt","matchEndsAt","playerCount","connectedPlayerCount","spectatorCount","giftOpening","adminTerminated")),fields);
        assertFalse(json.toString().contains("secret123"));assertFalse(players(waiting).containsKey("observer"));assertFalse(players(playing).containsKey("observer"));
        assertEquals(3000L,get(playing,"updatedAt"));verifyZeroInteractions(messaging);
    }

    @Test public void nonMemberAdminImmediatelyEndsEveryModeIncludingVideoManualClassicAndFinalEggs() throws Exception {
        for(String mode:MODES)for(boolean video:new boolean[]{false,true}) {
            Object room=room("MODE1","PLAYING",mode);set(room,"startedAt",System.currentTimeMillis()-1000L);
            set(room,"videoSynchronized",video);set(room,"videoPhase",video?"ANSWERING":null);set(room,"classicAutoAdvance",false);set(room,"classicAnswerRevealed",true);
            set(room,"questionEndsAt",System.currentTimeMillis()+60000L);set(room,"questionTimerPaused",true);
            Object alice=players(room).get("alice");set(alice,"giftCredits",10);set(alice,"pendingSkillType","FREEZE");set(alice,"passwordGuessEndsAt",System.currentTimeMillis()+10000L);
            if("LUM_NGAY".equals(mode)) {
                set(room,"giftDrop",new GiftDropGame(10,new Random()));set(room,"giftOpening",true);set(room,"giftOpeningEndsAt",System.currentTimeMillis()+180000L);
                set(room,"giftLightning",new GiftLightningGame(System.currentTimeMillis(),System.currentTimeMillis()+180000L,new Random()));
            }
            if("DEMON_DEFENSE".equals(mode)) {
                Map<Integer,Integer> teams=new LinkedHashMap<Integer,Integer>();teams.put(1,1);teams.put(2,1);
                set(room,"demonDefense",new DemonDefenseGame(System.currentTimeMillis()-1000L,teams));
                set(alice,"teamNumber",1);set(players(room).get("bob"),"teamNumber",2);
            }
            BattleOnlineAdminRoomDto ended=service.terminateRoomAsAdmin("MODE1");
            assertEquals(mode,"FINISHED",ended.getStatus());assertTrue(ended.isAdminTerminated());assertFalse(ended.isGiftOpening());assertEquals(0L,ended.getMatchEndsAt());
            assertEquals(0L,get(room,"questionEndsAt"));assertFalse((Boolean)get(room,"questionTimerPaused"));assertNull(get(room,"videoPhase"));
            assertNull(get(alice,"pendingSkillType"));assertEquals(0L,get(alice,"passwordGuessEndsAt"));assertFalse(players(room).containsKey("observer"));
            BattleOnlineRoomDto reconnect=service.getRoom("MODE1","alice");assertEquals("FINISHED",reconnect.getStatus());assertTrue(reconnect.isAdminTerminated());
            if("DEMON_DEFENSE".equals(mode))assertTrue(reconnect.getDemonDefense().finished);
            conflict(()->service.startMatch("MODE1","teacher"));conflict(()->service.restartMatch("MODE1","teacher"));
            conflict(()->service.answer("MODE1","alice",new BattleOnlineAnswerDto()));
            assertTrue(service.getAdminRooms().isEmpty());
            verify(messaging,atLeastOnce()).convertAndSend(eq("/topic/battle-online/room/MODE1"),any(BattleOnlineRoomDto.class));
        }
    }

    @Test @SuppressWarnings("unchecked") public void terminationCancelsAllGameTimersAndRepeatDoesNotExtendFinishedExpiry() throws Exception {
        Object room=room("TIME1","PLAYING","MONEY_BEG");set(room,"startedAt",System.currentTimeMillis()-1000L);
        List<ScheduledFuture<?>> futures=new ArrayList<ScheduledFuture<?>>();
        for(String name:new String[]{"classicTimers","guessRevealTimers","matchTimers","demonTimers","preloadTimers","lobbyExpirationTimers"}) {
            ScheduledFuture<?> timer=mock(ScheduledFuture.class);futures.add(timer);((Map<String,ScheduledFuture<?>>)get(service,name)).put("TIME1",timer);
        }
        Object alice=players(room).get("alice");set(alice,"passwordGuessEndsAt",System.currentTimeMillis()+10000L);
        ReflectionTestUtils.invokeMethod(service,"schedulePasswordGuessTimeout",room,alice,get(alice,"passwordGuessEndsAt"));
        Map<String,ScheduledFuture<?>> passwordTimers=(Map<String,ScheduledFuture<?>>)get(room,"passwordGuessTimers");
        ScheduledFuture<?> passwordTimer=passwordTimers.get("alice");assertNotNull(passwordTimer);
        long generation=(Long)get(room,"preloadGeneration");service.terminateRoomAsAdmin("TIME1");
        for(ScheduledFuture<?> timer:futures)verify(timer).cancel(false);
        assertTrue(passwordTimer.isCancelled());assertTrue(passwordTimers.isEmpty());assertEquals(generation+1L,get(room,"preloadGeneration"));
        for(String name:new String[]{"classicTimers","guessRevealTimers","matchTimers","demonTimers","preloadTimers","lobbyExpirationTimers"})assertFalse(((Map<?,?>)get(service,name)).containsKey("TIME1"));
        long deadline=(Long)get(room,"finishedExpiresAt");Object cleanup=((Map<?,?>)get(service,"finishedExpirationTimers")).get("TIME1");
        assertNotNull(cleanup);service.terminateRoomAsAdmin("TIME1");assertEquals(deadline,get(room,"finishedExpiresAt"));assertSame(cleanup,((Map<?,?>)get(service,"finishedExpirationTimers")).get("TIME1"));
        ReflectionTestUtils.invokeMethod(service,"schedulePreload","TIME1",0L);assertFalse(((Map<?,?>)get(service,"preloadTimers")).containsKey("TIME1"));
    }

    @Test public void waitingRoomEndsWithoutAwardingOrCreatingAMatchAndCannotBeRestarted() throws Exception {
        Object room=room("LOBBY1","LOBBY","CLASSIC");
        BattleOnlineAdminRoomDto ended=service.terminateRoomAsAdmin("LOBBY1");
        assertEquals("FINISHED",ended.getStatus());assertEquals(0L,ended.getStartedAt());assertTrue((Boolean)get(room,"battleResultsSaved"));
        conflict(()->service.restartMatch("LOBBY1","teacher"));assertEquals("teacher",get(room,"hostUsername"));
    }

    @Test public void existingParticipantsMayReconnectToResultsButNewParticipantsCannotJoinAClosedRoom() throws Exception {
        Object room=room("JOIN1","PLAYING","COUNTDOWN");service.terminateRoomAsAdmin("JOIN1");
        EntityManager entityManager=mock(EntityManager.class);Query identity=mock(Query.class),roles=mock(Query.class);
        when(entityManager.createQuery(anyString())).thenAnswer(call->((String)call.getArguments()[0]).contains("join u.roles")?roles:identity);
        when(identity.getResultList()).thenReturn(Collections.singletonList(new Object[]{42L,"Name","Student","Student Name",0L,"MAM_HOC"}));
        when(roles.getResultList()).thenReturn(Collections.emptyList());set(service,"entityManager",entityManager);
        BattleOnlineRoomDto results=service.joinRoom("JOIN1","alice");assertTrue(results.isAdminTerminated());assertEquals("FINISHED",results.getStatus());
        conflict(()->service.joinRoom("JOIN1","newcomer"));assertEquals(3,players(room).size());assertFalse(players(room).containsKey("observer"));
    }

    @Test public void queuedHostStartAndRestartCannotUndoAdministratorTermination() throws Exception {
        Object room=room("RACE1","LOBBY","CLASSIC");
        CountDownLatch started=new CountDownLatch(2);java.util.concurrent.atomic.AtomicInteger rejected=new java.util.concurrent.atomic.AtomicInteger();
        Runnable start=()->{started.countDown();try{service.startMatch("RACE1","teacher");}catch(BattleOnlineException expected){if(expected.getStatus()==HttpStatus.CONFLICT)rejected.incrementAndGet();}};
        Runnable restart=()->{started.countDown();try{service.restartMatch("RACE1","teacher");}catch(BattleOnlineException expected){if(expected.getStatus()==HttpStatus.CONFLICT)rejected.incrementAndGet();}};
        Thread first=new Thread(start),second=new Thread(restart);
        synchronized(room){first.start();second.start();assertTrue(started.await(1,TimeUnit.SECONDS));service.terminateRoomAsAdmin("RACE1");}
        first.join(1000L);second.join(1000L);assertFalse(first.isAlive());assertFalse(second.isAlive());assertEquals(2,rejected.get());
        assertEquals("FINISHED",get(room,"status"));assertTrue((Boolean)get(room,"adminTerminated"));
    }

    @Test public void inFlightPreloadCannotRepopulateOrScheduleWorkAfterTermination() throws Exception {
        Object room=room("LOAD1","LOBBY","CLASSIC");
        CountDownLatch fetching=new CountDownLatch(1),release=new CountDownLatch(1);
        com.globits.richy.service.QuestionService questions=mock(com.globits.richy.service.QuestionService.class);
        when(questions.getPageObjectForGames(any(QuestionDto.class),anyInt(),anyInt())).thenAnswer(call->{
            fetching.countDown();assertTrue(release.await(2,TimeUnit.SECONDS));return new org.springframework.data.domain.PageImpl<QuestionForGamesDto>(Collections.emptyList());
        });set(service,"questionService",questions);
        Thread worker=new Thread(()->ReflectionTestUtils.invokeMethod(service,"loadNextPreloadBatch","LOAD1",0L));
        try {
            worker.start();assertTrue(fetching.await(1,TimeUnit.SECONDS));service.terminateRoomAsAdmin("LOAD1");
        }finally{release.countDown();worker.join(2000L);}
        assertFalse(worker.isAlive());assertEquals("FINISHED",get(room,"status"));assertFalse((Boolean)get(room,"loadingQuestions"));
        assertTrue(((Map<?,?>)get(room,"preparedQuestions")).isEmpty());assertTrue(((Map<?,?>)get(room,"rawQuestions")).isEmpty());
        assertFalse(((Map<?,?>)get(service,"preloadTimers")).containsKey("LOAD1"));
        verify(messaging,times(1)).convertAndSend(eq("/topic/battle-online/room/LOAD1"),any(BattleOnlineRoomDto.class));
    }

    @Test public void restRoutesRequireAdministratorAndReturnOnlyRoomSummaries() throws Exception {
        room("REST1","LOBBY","CLASSIC");
        RestBattleOnlineController controller=new RestBattleOnlineController();set(controller,"battleOnlineService",service);
        org.springframework.test.web.servlet.MockMvc mvc=org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(controller).build();
        org.springframework.test.web.servlet.MvcResult listed=mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/battle-online/admin/rooms"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
                .andReturn();
        assertEquals("REST1",new ObjectMapper().readTree(listed.getResponse().getContentAsString()).get(0).get("code").asText());
        authentication("admin","ROLE_VIEWER");
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/battle-online/admin/rooms/REST1/terminate").param("username","admin"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isForbidden());
        admin();
        org.springframework.test.web.servlet.MvcResult terminated=mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/battle-online/admin/rooms/REST1/terminate"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
                .andReturn();
        JsonNode ended=new ObjectMapper().readTree(terminated.getResponse().getContentAsString());
        assertEquals("FINISHED",ended.get("status").asText());assertTrue(ended.get("adminTerminated").asBoolean());
    }
}
