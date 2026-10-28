package com.globits.richy.battle;

import com.globits.richy.domain.TestResult;
import com.globits.richy.dto.BattleOnlineRoomDto;
import com.globits.richy.repository.TestResultRepository;
import com.globits.richy.service.impl.BattleOnlineServiceImpl;
import com.globits.security.domain.User;
import com.globits.security.repository.UserRepository;
import java.lang.reflect.Constructor;
import java.util.Map;
import java.util.UUID;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;
import static org.mockito.Matchers.*;
import static org.mockito.Mockito.*;

/** Real in-memory transactions verify that EXP and its result commit or roll back together. */
public class BattleOnlineExperienceTest {
    private BattleOnlineServiceImpl service;
    private JdbcTemplate jdbc;
    private Object room, alice, bob;
    private Long failedResultUserId;

    private Object state(String name) throws Exception {
        Constructor<?> constructor = Class.forName(BattleOnlineServiceImpl.class.getName() + "$" + name).getDeclaredConstructor();
        constructor.setAccessible(true);
        return constructor.newInstance();
    }
    private void set(Object target, String field, Object value) { ReflectionTestUtils.setField(target, field, value); }
    private Object get(Object target, String field) { return ReflectionTestUtils.getField(target, field); }

    @Before public void setup() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.h2.Driver");
        dataSource.setUrl("jdbc:h2:mem:battle_exp_" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1");
        dataSource.setUsername("sa"); dataSource.setPassword("");
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("create table battle_users (id bigint primary key, total bigint, level int, progress bigint)");
        jdbc.execute("create table battle_results (user_id bigint, attempt_key varchar(100), test_type int, words int, awarded int, status varchar(20), unique(user_id, attempt_key, test_type))");
        jdbc.update("insert into battle_users values (1,995,0,995),(2,200,0,200),(3,500,0,500)");

        UserRepository users = mock(UserRepository.class);
        when(users.findById(anyLong())).thenAnswer(call -> {
            Long id = (Long) call.getArguments()[0];
            User user = new User(); user.setId(id); user.setUsername("user" + id);
            user.setTotalVocabularyWordsLearned(jdbc.queryForObject("select total from battle_users where id=?", Long.class, id));
            return user;
        });
        when(users.save(any(User.class))).thenAnswer(call -> {
            User user = (User) call.getArguments()[0];
            jdbc.update("update battle_users set total=?,level=?,progress=? where id=?",
                    user.getTotalVocabularyWordsLearned(), user.getVocabularyExperienceLevel(), user.getVocabularyExperienceWords(), user.getId());
            return user;
        });
        TestResultRepository results = mock(TestResultRepository.class);
        when(results.findAttempt(anyLong(), anyString(), eq(5))).thenAnswer(call -> {
            Integer count = jdbc.queryForObject("select count(*) from battle_results where user_id=? and attempt_key=? and test_type=?",
                    Integer.class, call.getArguments()[0], call.getArguments()[1], call.getArguments()[2]);
            return count > 0 ? new TestResult() : null;
        });
        when(results.saveAndFlush(any(TestResult.class))).thenAnswer(call -> {
            TestResult result = (TestResult) call.getArguments()[0];
            if (result.getUser().getId().equals(failedResultUserId)) { throw new IllegalStateException("Simulated result write failure"); }
            jdbc.update("insert into battle_results values (?,?,?,?,?,?)", result.getUser().getId(), result.getClientAttemptKey(),
                    result.getTestType(), result.getNumberOfWords(), result.getVocabularyExperienceAwardedWords(), result.getResultStatus());
            return result;
        });
        service = new BattleOnlineServiceImpl();
        set(service, "userRepository", users); set(service, "testResultRepository", results);
        set(service, "transactionManager", new DataSourceTransactionManager(dataSource));
        set(service, "messagingTemplate", mock(SimpMessagingTemplate.class));
    }

    @After public void cleanup() throws java.sql.SQLException {
        service.destroy();
        try (java.sql.Connection connection = jdbc.getDataSource().getConnection();
                java.sql.Statement statement = connection.createStatement()) { statement.execute("SHUTDOWN"); }
    }

    private Object player(Long id, String username, int correct, boolean spectator) throws Exception {
        Object player = state("PlayerState");
        set(player, "userId", id); set(player, "username", username); set(player, "displayName", username);
        set(player, "correctCount", correct); set(player, "wrongCount", 4); set(player, "score", 9999D);
        set(player, "spectator", spectator); set(player, "connected", true);
        return player;
    }

    @SuppressWarnings("unchecked") private void match(String mode) throws Exception {
        room = state("RoomState"); set(room, "code", "EXP1"); set(room, "status", "PLAYING"); set(room, "hostUsername", "host");
        set(room, "battleAttemptId", UUID.randomUUID().toString()); set(get(room, "settings"), "mode", mode);
        alice = player(1L, "alice", 8, false); bob = player(2L, "bob", 3, false);
        Object host = player(3L, "host", 99, true); set(host, "host", true);
        Map<String, Object> players = (Map<String, Object>) get(room, "players");
        players.put("alice", alice); players.put("bob", bob); players.put("host", host);
        ((Map<String, Object>) get(service, "rooms")).put("EXP1", room);
    }
    private long total(long id) { return jdbc.queryForObject("select total from battle_users where id=?", Long.class, id); }
    private int resultCount() { return jdbc.queryForObject("select count(*) from battle_results", Integer.class); }
    private void persist() { ReflectionTestUtils.invokeMethod(service, "saveBattleResultsLocked", room); }

    @Test public void everyModeAwardsCorrectAnswersToEachUserAndUpdatesTheLevelAfterCommit() throws Exception {
        for (String mode : new String[]{"CLASSIC", "GUESS_WORD", "COUNTDOWN", "MONEY_BEG", "ESCAPE_DUMB_DEMON", "DEMON_DEFENSE", "LUM_NGAY"}) {
            jdbc.update("delete from battle_results"); jdbc.update("update battle_users set total=995,level=0,progress=995 where id=1");
            jdbc.update("update battle_users set total=200,level=0,progress=200 where id=2");
            match(mode);
            BattleOnlineRoomDto finished = service.finishMatch("EXP1", "host");
            assertEquals(mode, "FINISHED", finished.getStatus());
            assertEquals(mode, 1003L, total(1)); assertEquals(203L, total(2)); assertEquals(500L, total(3));
            assertEquals(2, resultCount());
            assertEquals(Integer.valueOf(8), jdbc.queryForObject("select awarded from battle_results where user_id=1", Integer.class));
            assertEquals(Integer.valueOf(3), jdbc.queryForObject("select words from battle_results where user_id=2", Integer.class));
            assertEquals(Integer.valueOf(1), jdbc.queryForObject("select level from battle_users where id=1", Integer.class));
            assertEquals(Long.valueOf(3), jdbc.queryForObject("select progress from battle_users where id=1", Long.class));
            assertEquals(1, get(alice, "vocabularyExperienceLevel"));
            assertEquals("BATTLE", jdbc.queryForObject("select status from battle_results where user_id=1", String.class));
        }
    }

    @Test public void zeroCorrectAnswersAndSpectatorsDoNotEarnExperience() throws Exception {
        match("COUNTDOWN"); set(alice, "correctCount", 0); set(bob, "correctCount", 0);
        service.finishMatch("EXP1", "host");
        assertEquals(995L, total(1)); assertEquals(200L, total(2)); assertEquals(500L, total(3));
        assertEquals(Integer.valueOf(0), jdbc.queryForObject("select sum(awarded) from battle_results", Integer.class));
    }

    @Test public void savingAgainSkipsTheExistingAttemptAndANewMatchCanEarnMoreExperience() throws Exception {
        match("CLASSIC"); persist();
        set(room, "battleResultsSaved", false); persist();
        assertEquals(1003L, total(1)); assertEquals(203L, total(2)); assertEquals(2, resultCount());
        set(room, "battleAttemptId", UUID.randomUUID().toString()); set(room, "battleResultsSaved", false); persist();
        assertEquals(1011L, total(1)); assertEquals(206L, total(2)); assertEquals(4, resultCount());
    }

    @Test public void resultFailureRollsBackItsExperienceAndRetryNeverAwardsSuccessfulUsersTwice() throws Exception {
        match("GUESS_WORD"); failedResultUserId = 2L; persist();
        assertEquals(1003L, total(1)); assertEquals(200L, total(2)); assertEquals(1, resultCount());
        assertEquals(false, get(room, "battleResultsSaved"));
        failedResultUserId = null; persist();
        assertEquals(1003L, total(1)); assertEquals(203L, total(2)); assertEquals(2, resultCount());
        assertEquals(true, get(room, "battleResultsSaved"));
    }

    @Test public void eggGameAwardsExperienceAfterItsFinalRoundForBothVideoAndRegularMatches() throws Exception {
        for (boolean video : new boolean[]{false, true}) {
            jdbc.update("delete from battle_results"); jdbc.update("update battle_users set total=995 where id=1");
            jdbc.update("update battle_users set total=200 where id=2");
            match("LUM_NGAY"); set(room, "videoSynchronized", video); set(alice, "giftCredits", 1);
            BattleOnlineRoomDto opening = service.finishMatch("EXP1", "host");
            assertTrue(opening.isGiftOpening()); assertEquals("PLAYING", opening.getStatus());
            assertEquals(0, resultCount()); assertEquals(995L, total(1));
            assertEquals("FINISHED", service.finishMatch("EXP1", "host").getStatus());
            assertEquals(1003L, total(1)); assertEquals(203L, total(2)); assertEquals(2, resultCount());
        }
    }

    @Test public void administratorClosureAwardsEarnedExperienceOnceAndSkipsRemainingEggCredits() throws Exception {
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken("outside-admin","ignored",
                        java.util.Collections.singletonList(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_ADMIN"))));
        try {
            match("LUM_NGAY");set(room,"startedAt",System.currentTimeMillis()-1000L);set(room,"videoSynchronized",true);
            set(alice,"giftCredits",99);set(room,"giftOpening",true);set(room,"giftOpeningEndsAt",System.currentTimeMillis()+180000L);
            assertEquals("FINISHED",service.terminateRoomAsAdmin("EXP1").getStatus());
            assertEquals(1003L,total(1));assertEquals(203L,total(2));assertEquals(2,resultCount());
            assertEquals(false,get(room,"giftOpening"));assertEquals(true,get(room,"adminTerminated"));
            service.terminateRoomAsAdmin("EXP1");set(room,"battleResultsSaved",false);service.terminateRoomAsAdmin("EXP1");
            assertEquals(1003L,total(1));assertEquals(203L,total(2));assertEquals(2,resultCount());
        } finally { org.springframework.security.core.context.SecurityContextHolder.clearContext(); }
    }

    @Test public void administratorClosureRetriesAFailedExperienceTransactionWithoutDuplicatingSuccessfulUsers() throws Exception {
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken("outside-admin","ignored",
                        java.util.Collections.singletonList(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_ADMIN"))));
        try {
            match("COUNTDOWN");set(room,"startedAt",System.currentTimeMillis()-1000L);failedResultUserId=2L;
            service.terminateRoomAsAdmin("EXP1");assertEquals(1003L,total(1));assertEquals(200L,total(2));assertEquals(1,resultCount());
            failedResultUserId=null;service.terminateRoomAsAdmin("EXP1");
            assertEquals(1003L,total(1));assertEquals(203L,total(2));assertEquals(2,resultCount());assertEquals(true,get(room,"battleResultsSaved"));
        } finally { org.springframework.security.core.context.SecurityContextHolder.clearContext(); }
    }
}
