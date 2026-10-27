package com.globits.richy.fair;

import java.util.*;
import java.util.concurrent.*;
import java.util.function.Function;
import javax.persistence.*;
import org.hibernate.SessionFactory;
import org.junit.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import com.globits.core.domain.Person;
import com.globits.security.domain.*;
import com.globits.security.repository.UserRepository;
import com.globits.richy.domain.*;
import com.globits.richy.dto.FairDto;
import com.globits.richy.service.impl.FairService;

/** Real, isolated H2 transactions, including concurrent writes; no application datasource. */
public class FairServiceTest {
    private SessionFactory factory;
    private UserRepository users;
    private Long event;
    @Before public void setup() {
        Properties properties = new Properties();
        properties.setProperty("hibernate.connection.driver_class", "org.h2.Driver");
        properties.setProperty("hibernate.connection.url", "jdbc:h2:mem:fair" + UUID.randomUUID() + ";MODE=MSSQLServer;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000");
        properties.setProperty("hibernate.connection.username", "sa"); properties.setProperty("hibernate.connection.password", "");
        properties.setProperty("hibernate.dialect", "org.hibernate.dialect.H2Dialect");
        properties.setProperty("hibernate.hbm2ddl.auto", "create-drop");
        org.springframework.jdbc.datasource.DriverManagerDataSource datasource = new org.springframework.jdbc.datasource.DriverManagerDataSource();
        datasource.setDriverClassName("org.h2.Driver"); datasource.setUrl(properties.getProperty("hibernate.connection.url")); datasource.setUsername("sa"); datasource.setPassword("");
        properties.put("hibernate.connection.datasource", datasource);
        factory = new org.hibernate.cfg.Configuration().setProperties(properties).addAnnotatedClass(FairEvent.class)
            .addAnnotatedClass(FairWallet.class).addAnnotatedClass(FairTransaction.class).addAnnotatedClass(FairStation.class).buildSessionFactory();
        users = mock(UserRepository.class);
        User student = user("HS001", "ROLE_STUDENT"); student.setId(1L);
        Person person = new Person(); person.setFirstName("An"); person.setLastName("Nguyễn Văn"); student.setPerson(person);
        when(users.findByUsernameAndPerson("HS001")).thenReturn(student);
        when(users.findByUsername("play")).thenReturn(user("play", "ROLE_PLAY"));
        when(users.findByUsername("gift")).thenReturn(user("gift", "ROLE_GIFT"));
        event = run("admin", "ROLE_ADMIN", service -> { FairDto.EventRequest request = new FairDto.EventRequest(); request.name = "Hội chợ thử"; return service.saveEvent(null, request).id; });
        station("play", "PLAY", "CHOOSE"); station("gift", "GIFT", "CHOOSE");
    }
    @After public void cleanup() { SecurityContextHolder.clearContext(); if (factory != null) { factory.close(); } }
    private User user(String name, String roleName) {
        User user = new User(); user.setUsername(name); user.setActive(true); Role role = new Role(); role.setName(roleName); user.getRoles().add(role); return user;
    }
    private <T> T run(String actor, String role, Function<FairService,T> action) {
        if (role == null) { SecurityContextHolder.clearContext(); }
        else { SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(actor, "", Collections.singletonList(new SimpleGrantedAuthority(role)))); }
        EntityManager em = factory.createEntityManager(); em.getTransaction().begin();
        FairService service = new FairService(); ReflectionTestUtils.setField(service, "em", em); ReflectionTestUtils.setField(service, "users", users);
        try { T result = action.apply(service); em.getTransaction().commit(); return result; }
        catch (RuntimeException error) { if (em.getTransaction().isActive()) { em.getTransaction().rollback(); } throw error; }
        finally { em.close(); SecurityContextHolder.clearContext(); }
    }
    private FairDto.TransactionRequest request(String operation, String tier, int amount) {
        FairDto.TransactionRequest request = new FairDto.TransactionRequest(); request.cardCode = "HS001";
        request.operation = operation; request.tier = tier; request.amount = amount; request.requestKey = UUID.randomUUID().toString(); return request;
    }
    private void station(String operator, String operation, String tier) {
        run("admin", "ROLE_ADMIN", service -> { FairDto.StationRequest request = new FairDto.StationRequest(); request.operatorName = operator; request.name = "Gian " + operator; request.operation = operation; request.tier = tier; return service.saveStation(event, request); });
    }
    private void legacyStation(String operator, String operation, String tier) {
        // Persist the old assignment shape directly: current saveStation deliberately normalizes it.
        EntityManager em = factory.createEntityManager(); em.getTransaction().begin();
        try {
            FairStation value = em.createQuery("from FairStation where eventId=:event and operatorName=:operator", FairStation.class)
                .setParameter("event", event).setParameter("operator", operator).getSingleResult();
            value.operation = operation; value.tier = tier; em.getTransaction().commit();
        } finally { if (em.getTransaction().isActive()) { em.getTransaction().rollback(); } em.close(); }
    }
    private FairDto.Receipt post(String actor, String role, FairDto.TransactionRequest request) { return run(actor, role, service -> service.transact(event, request)); }
    private FairDto.UndoRequest undoRequest() { FairDto.UndoRequest request = new FairDto.UndoRequest(); request.requestKey = UUID.randomUUID().toString(); return request; }
    private FairDto.Receipt undo(String actor, String role, Long transactionId, FairDto.UndoRequest request) { return run(actor, role, service -> service.undo(event, transactionId, request)); }
    private int balance(String code) { return run(null, null, service -> service.balance(event, code).balance); }
    private void invalid(Runnable action) { try { action.run(); fail("Expected rejected transaction"); } catch (FairService.Invalid expected) {} }
    private void forbidden(Runnable action) { try { action.run(); fail("Expected permission check"); } catch (AccessDeniedException expected) {} }
    private void rejectedUndo(Runnable action) { try { action.run(); fail("Expected rejected undo"); } catch (FairService.Invalid expected) {} catch (AccessDeniedException expected) {} }

    @Test public void publicLookupStartsAtZeroAndDoesNotCreateWalletOrExposeUserDetails() {
        assertEquals(0, balance("HS001"));
        EntityManager em = factory.createEntityManager(); assertEquals(Long.valueOf(0), em.createQuery("select count(w) from FairWallet w", Long.class).getSingleResult()); em.close();
        FairDto.Balance dto = run(null, null, service -> service.balance(event, "HS001"));
        assertEquals("Nguyễn Văn An", dto.displayName); assertEquals("HS001", dto.cardCode); assertFalse(dto.guest);
        String json;
        try { json = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(dto); } catch (Exception e) { throw new RuntimeException(e); }
        assertFalse(json.contains("password")); assertFalse(json.contains("email")); assertFalse(json.contains("studentId"));
    }
    @Test public void publicHttpLookupIsReadOnlyAndExplicitlyDisablesCaching() {
        run(null, null, service -> {
            com.globits.richy.rest.RestFairController controller = new com.globits.richy.rest.RestFairController();
            ReflectionTestUtils.setField(controller, "service", service);
            org.springframework.test.web.servlet.MockMvc mvc = org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(controller).build();
            try {
                org.springframework.test.web.servlet.MvcResult response = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                    .get("/public/fairs/" + event + "/balance").param("cardCode", "HS001")).andReturn();
                assertEquals(200, response.getResponse().getStatus()); assertEquals("no-store, max-age=0", response.getResponse().getHeader("Cache-Control"));
                com.fasterxml.jackson.databind.JsonNode json = new com.fasterxml.jackson.databind.ObjectMapper().readTree(response.getResponse().getContentAsString());
                assertEquals(0, json.path("balance").asInt()); assertEquals(5, json.size());
                assertEquals(405, mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/public/fairs/" + event + "/balance")).andReturn().getResponse().getStatus());
                return null;
            } catch (Exception error) { throw new RuntimeException(error); }
        });
    }
    @Test public void invalidConfigurationAndNonStudentCardsAreRejected() {
        invalid(() -> run("admin", "ROLE_ADMIN", service -> { FairDto.EventRequest request = new FairDto.EventRequest(); request.name = "Hội chợ"; request.easyAmount = 0; return service.saveEvent(event, request); }));
        assertEquals(8, run(null, null, service -> service.event(event).easyAmount).intValue());
        User staff = user("staff", "ROLE_STAFF"); staff.setPerson(new Person()); when(users.findByUsernameAndPerson("staff")).thenReturn(staff);
        try { balance("staff"); fail(); } catch (FairService.Missing expected) {}
    }
    @Test public void rolesCanReadButOnlyPerformTheirOwnOperation() {
        post("play", "ROLE_PLAY", request("PLAY", "HARD", 20));
        assertEquals(20, run("gift", "ROLE_GIFT", service -> service.balance(event, "HS001").balance).intValue());
        assertEquals(20, run("play", "ROLE_PLAY", service -> service.balance(event, "HS001").balance).intValue());
        forbidden(() -> post("play", "ROLE_PLAY", request("GIFT", "EASY", 8)));
        forbidden(() -> post("gift", "ROLE_GIFT", request("PLAY", "EASY", 8)));
        forbidden(() -> post(null, null, request("PLAY", "EASY", 8)));
        forbidden(() -> run("play", "ROLE_PLAY", service -> service.history(event, "", 0)));
        assertEquals(12, post("gift", "ROLE_GIFT", request("GIFT", "EASY", 8)).participant.balance);
        invalid(() -> post("gift", "ROLE_GIFT", request("GIFT", "HARD", 20))); assertEquals(12, balance("HS001"));
    }
    @Test public void operatorRolesCanAwardAndRedeemWithoutAssignedStations() {
        EntityManager em = factory.createEntityManager(); em.getTransaction().begin();
        try { em.createQuery("delete from FairStation where eventId=:event").setParameter("event", event).executeUpdate(); em.getTransaction().commit(); }
        finally { if (em.getTransaction().isActive()) { em.getTransaction().rollback(); } em.close(); }
        FairDto.Operator play = run("play", "ROLE_PLAY", service -> service.operator(event));
        FairDto.Operator gift = run("gift", "ROLE_GIFT", service -> service.operator(event));
        assertNull(play.station); assertTrue(play.canPlay); assertFalse(play.canGift);
        assertNull(gift.station); assertFalse(gift.canPlay); assertTrue(gift.canGift);
        assertEquals(20, post("play", "ROLE_PLAY", request("PLAY", "HARD", 20)).participant.balance);
        assertEquals(8, post("gift", "ROLE_GIFT", request("GIFT", "MEDIUM", 12)).participant.balance);
        forbidden(() -> post("play", "ROLE_PLAY", request("GIFT", "EASY", 8)));
        forbidden(() -> post("gift", "ROLE_GIFT", request("PLAY", "EASY", 8)));
    }
    @Test public void legacyFixedStationAcceptsAllConfiguredTiersOnSuccessiveTurns() {
        legacyStation("play", "PLAY", "HARD");
        assertEquals(8, post("play", "ROLE_PLAY", request("PLAY", "EASY", 8)).participant.balance);
        assertEquals(28, post("play", "ROLE_PLAY", request("PLAY", "HARD", 20)).participant.balance);
        assertEquals(40, post("play", "ROLE_PLAY", request("PLAY", "MEDIUM", 12)).participant.balance);
    }
    @Test public void stationSetupNormalizesLegacyFixedTierInputsToPerTurnChoice() {
        station("play", "PLAY", "HARD");
        assertEquals("CHOOSE", run("play", "ROLE_PLAY", service -> service.operator(event)).station.tier);
        station("gift", "GIFT", null);
        assertEquals("CHOOSE", run("gift", "ROLE_GIFT", service -> service.operator(event)).station.tier);
    }
    @Test public void staleStationOperationsCannotGrantPermissionsOrMislabelTransactions() {
        legacyStation("play", "GIFT", "HARD"); legacyStation("gift", "PLAY", "HARD");
        FairDto.Receipt award = post("play", "ROLE_PLAY", request("PLAY", "HARD", 20));
        FairDto.Receipt redemption = post("gift", "ROLE_GIFT", request("GIFT", "EASY", 8));
        assertEquals(12, redemption.participant.balance);
        assertNotEquals("Gian play", award.transaction.stationName);
        assertNotEquals("Gian gift", redemption.transaction.stationName);
        assertNotNull(award.transaction.stationName); assertFalse(award.transaction.stationName.trim().isEmpty());
        assertNotNull(redemption.transaction.stationName); assertFalse(redemption.transaction.stationName.trim().isEmpty());
        forbidden(() -> post("play", "ROLE_PLAY", request("GIFT", "EASY", 8)));
        forbidden(() -> post("gift", "ROLE_GIFT", request("PLAY", "EASY", 8)));
    }
    @Test public void ownerCanUndoLatestPlayAwardUsingOriginalAmountAndKeepingAuditTrail() {
        FairDto.Receipt award = post("play", "ROLE_PLAY", request("PLAY", "EASY", 8));
        run("admin", "ROLE_ADMIN", service -> { FairDto.EventRequest request = new FairDto.EventRequest(); request.name = "Hội chợ thử"; request.easyAmount = 5; return service.saveEvent(event, request); });
        FairDto.Receipt undone = undo("play", "ROLE_PLAY", award.transaction.id, undoRequest());
        assertEquals(0, undone.participant.balance); assertEquals(-8, undone.transaction.delta); assertEquals(0, undone.transaction.amount);
        assertEquals(award.transaction.id, undone.transaction.correctionOf); assertEquals("Hoàn tác cộng phiếu", undone.transaction.reason);
        List<FairTransaction> history = run("admin", "ROLE_ADMIN", service -> service.history(event, "", 0));
        assertEquals(2, history.size()); assertEquals(undone.transaction.id, history.get(0).id); assertTrue(history.get(1).corrected);
        assertEquals(8, history.get(1).amount);
    }
    @Test public void undoRetryRemainsIdempotentAfterNewAwardsAndCannotTargetAnotherOriginal() {
        FairDto.Receipt firstAward = post("play", "ROLE_PLAY", request("PLAY", "EASY", 8));
        FairDto.UndoRequest request = undoRequest();
        FairDto.Receipt firstUndo = undo("play", "ROLE_PLAY", firstAward.transaction.id, request);
        FairDto.Receipt secondAward = post("play", "ROLE_PLAY", request("PLAY", "HARD", 20));
        FairDto.Receipt replay = undo("play", "ROLE_PLAY", firstAward.transaction.id, request);
        assertTrue(replay.replayed); assertEquals(firstUndo.transaction.id, replay.transaction.id); assertEquals(20, replay.participant.balance);
        invalid(() -> undo("play", "ROLE_PLAY", secondAward.transaction.id, request)); assertEquals(20, balance("HS001"));
        assertEquals(3, run("admin", "ROLE_ADMIN", service -> service.history(event, "", 0)).size());
    }
    @Test public void undoRequiresPlayOrAdminRoleAndOwnershipOfTheOriginalAward() {
        FairDto.Receipt playAward = post("play", "ROLE_PLAY", request("PLAY", "EASY", 8));
        forbidden(() -> undo("gift", "ROLE_GIFT", playAward.transaction.id, undoRequest()));
        forbidden(() -> undo(null, null, playAward.transaction.id, undoRequest()));
        rejectedUndo(() -> undo("other-play", "ROLE_PLAY", playAward.transaction.id, undoRequest()));
        rejectedUndo(() -> undo("admin", "ROLE_ADMIN", playAward.transaction.id, undoRequest()));
        FairDto.Receipt adminAward = post("admin", "ROLE_ADMIN", request("PLAY", "HARD", 20));
        rejectedUndo(() -> undo("play", "ROLE_PLAY", adminAward.transaction.id, undoRequest()));
        assertEquals(28, balance("HS001"));
        assertEquals(8, undo("admin", "ROLE_ADMIN", adminAward.transaction.id, undoRequest()).participant.balance);
    }
    @Test public void anOlderAwardCannotBeUndoneAfterTheActorHasCompletedAnotherAward() {
        FairDto.Receipt first = post("play", "ROLE_PLAY", request("PLAY", "EASY", 8));
        FairDto.Receipt second = post("play", "ROLE_PLAY", request("PLAY", "HARD", 20));
        invalid(() -> undo("play", "ROLE_PLAY", first.transaction.id, undoRequest())); assertEquals(28, balance("HS001"));
        assertEquals(8, undo("play", "ROLE_PLAY", second.transaction.id, undoRequest()).participant.balance);
        invalid(() -> undo("play", "ROLE_PLAY", first.transaction.id, undoRequest())); assertEquals(8, balance("HS001"));
    }
    @Test public void anotherOperatorsActivityDoesNotReplaceTheOwnersLatestAward() {
        FairDto.Receipt award = post("play", "ROLE_PLAY", request("PLAY", "EASY", 8));
        post("admin", "ROLE_ADMIN", request("PLAY", "HARD", 20));
        assertEquals(20, undo("play", "ROLE_PLAY", award.transaction.id, undoRequest()).participant.balance);
    }
    @Test public void undoCannotMakeTheWalletNegativeAfterItsAwardHasBeenSpent() {
        FairDto.Receipt award = post("play", "ROLE_PLAY", request("PLAY", "HARD", 20));
        post("gift", "ROLE_GIFT", request("GIFT", "HARD", 20));
        invalid(() -> undo("play", "ROLE_PLAY", award.transaction.id, undoRequest())); assertEquals(0, balance("HS001"));
        List<FairTransaction> history = run("admin", "ROLE_ADMIN", service -> service.history(event, "", 0));
        assertEquals(2, history.size()); assertFalse(history.get(1).corrected);
    }
    @Test public void correctedAwardsCorrectionEntriesAndGiftTransactionsCannotBeUndone() {
        FairDto.Receipt award = post("play", "ROLE_PLAY", request("PLAY", "EASY", 8));
        FairDto.CorrectionRequest correction = new FairDto.CorrectionRequest(); correction.amount = 20; correction.reason = "Chọn nhầm mức"; correction.requestKey = UUID.randomUUID().toString();
        FairDto.Receipt adjusted = run("admin", "ROLE_ADMIN", service -> service.correct(event, award.transaction.id, correction));
        invalid(() -> undo("play", "ROLE_PLAY", award.transaction.id, undoRequest()));
        invalid(() -> undo("admin", "ROLE_ADMIN", adjusted.transaction.id, undoRequest()));
        FairDto.Receipt gift = post("admin", "ROLE_ADMIN", request("GIFT", "EASY", 8));
        invalid(() -> undo("admin", "ROLE_ADMIN", gift.transaction.id, undoRequest())); assertEquals(12, balance("HS001"));
    }
    @Test public void repeatedRequestIsAppliedOnceAndCannotBeChangedOrUsedByAnotherActor() {
        FairDto.TransactionRequest request = request("PLAY", "EASY", 8);
        FairDto.Receipt first = post("play", "ROLE_PLAY", request), replay = post("play", "ROLE_PLAY", request);
        assertEquals(first.transaction.id, replay.transaction.id); assertTrue(replay.replayed); assertEquals(8, balance("HS001"));
        invalid(() -> post("admin", "ROLE_ADMIN", request));
        request.amount = 20; request.tier = "HARD"; invalid(() -> post("play", "ROLE_PLAY", request)); assertEquals(8, balance("HS001"));
    }
    @Test public void configurablePricesAreEnforcedAndOldReceiptsRemainValid() {
        station("play", "PLAY", "HARD");
        FairDto.TransactionRequest old = request("PLAY", "HARD", 20); post("play", "ROLE_PLAY", old);
        run("admin", "ROLE_ADMIN", service -> { FairDto.EventRequest value = new FairDto.EventRequest(); value.name = "Hội chợ thử"; value.easyAmount = 5; value.mediumAmount = 15; value.hardAmount = 30; return service.saveEvent(event, value); });
        assertTrue(post("play", "ROLE_PLAY", old).replayed);
        invalid(() -> post("play", "ROLE_PLAY", request("PLAY", "HARD", 20)));
        assertEquals(50, post("play", "ROLE_PLAY", request("PLAY", "HARD", 30)).participant.balance);
        assertEquals(55, post("play", "ROLE_PLAY", request("PLAY", "EASY", 5)).participant.balance);
        forbidden(() -> run("play", "ROLE_PLAY", service -> { FairDto.EventRequest value = new FairDto.EventRequest(); value.name = "No"; return service.saveEvent(event, value); }));
        assertEquals(20, run("admin", "ROLE_ADMIN", service -> service.history(event, "", 0)).get(2).amount);
    }
    @Test public void adminCorrectionAddsOnlyTheDifferenceAndKeepsAnAuditTrail() {
        FairDto.Receipt first = post("play", "ROLE_PLAY", request("PLAY", "EASY", 8));
        FairDto.CorrectionRequest correction = new FairDto.CorrectionRequest(); correction.amount = 20; correction.reason = "Thắng khó, chọn nhầm dễ"; correction.requestKey = UUID.randomUUID().toString();
        forbidden(() -> run("play", "ROLE_PLAY", service -> service.correct(event, first.transaction.id, correction)));
        FairDto.Receipt receipt = run("admin", "ROLE_ADMIN", service -> service.correct(event, first.transaction.id, correction));
        assertEquals(12, receipt.transaction.delta); assertEquals(20, receipt.participant.balance);
        assertTrue(run("admin", "ROLE_ADMIN", service -> service.correct(event, first.transaction.id, correction)).replayed);
        correction.requestKey = UUID.randomUUID().toString(); invalid(() -> run("admin", "ROLE_ADMIN", service -> service.correct(event, first.transaction.id, correction)));
        List<FairTransaction> history = run("admin", "ROLE_ADMIN", service -> service.history(event, "", 0));
        assertEquals(2, history.size()); assertTrue(history.get(1).corrected); assertEquals(first.transaction.id, history.get(0).correctionOf);
    }
    @Test public void correctionCannotMakeTheWalletNegative() {
        FairDto.Receipt first = post("play", "ROLE_PLAY", request("PLAY", "HARD", 20));
        post("gift", "ROLE_GIFT", request("GIFT", "HARD", 20));
        FairDto.CorrectionRequest correction = new FairDto.CorrectionRequest(); correction.amount = 0; correction.reason = "Hủy nhầm"; correction.requestKey = UUID.randomUUID().toString();
        invalid(() -> run("admin", "ROLE_ADMIN", service -> service.correct(event, first.transaction.id, correction))); assertEquals(0, balance("HS001"));
    }
    @Test public void hundredGuestCardsAreIndependentAndRepeatedBatchesNeverReuseCodes() {
        List<FairWallet> guests = run("admin", "ROLE_ADMIN", service -> service.generateGuests(event, 100));
        assertEquals(100, guests.size()); Set<String> codes = new HashSet<>(); for (FairWallet guest : guests) { codes.add(guest.cardCode); assertEquals(0, guest.balance); }
        assertEquals(100, codes.size());
        FairDto.TransactionRequest request = request("PLAY", "EASY", 8); request.cardCode = guests.get(0).cardCode; post("play", "ROLE_PLAY", request);
        assertEquals(8, balance(guests.get(0).cardCode)); assertEquals(0, balance(guests.get(1).cardCode));
        List<FairWallet> extra = run("admin", "ROLE_ADMIN", service -> service.generateGuests(event, 1)); assertEquals(Integer.valueOf(101), extra.get(0).guestNumber);
        assertFalse(codes.contains(extra.get(0).cardCode)); forbidden(() -> run("gift", "ROLE_GIFT", service -> service.generateGuests(event, 1)));
    }
    @Test public void separateEventsStartAtZeroAndClosedEventsRejectNewWrites() {
        post("play", "ROLE_PLAY", request("PLAY", "HARD", 20));
        Long second = run("admin", "ROLE_ADMIN", service -> { FairDto.EventRequest request = new FairDto.EventRequest(); request.name = "Hội chợ tiếp theo"; return service.saveEvent(null, request).id; });
        assertEquals(0, run(null, null, service -> service.balance(second, "HS001").balance).intValue());
        run("admin", "ROLE_ADMIN", service -> { FairDto.EventRequest request = new FairDto.EventRequest(); request.name = "Hội chợ thử"; request.active = false; return service.saveEvent(event, request); });
        invalid(() -> post("play", "ROLE_PLAY", request("PLAY", "EASY", 8))); assertEquals(20, balance("HS001"));
    }
    @Test public void concurrentRedemptionsCannotSpendTheSameBalanceTwice() throws Exception {
        post("play", "ROLE_PLAY", request("PLAY", "HARD", 20));
        ExecutorService pool = Executors.newFixedThreadPool(2); CountDownLatch start = new CountDownLatch(1);
        Callable<Boolean> redeem = () -> { start.await(); try { post("gift", "ROLE_GIFT", request("GIFT", "MEDIUM", 12)); return true; } catch (FairService.Invalid expected) { return false; } };
        try { Future<Boolean> a = pool.submit(redeem), b = pool.submit(redeem); start.countDown(); assertEquals(1, (a.get(15, TimeUnit.SECONDS) ? 1 : 0) + (b.get(15, TimeUnit.SECONDS) ? 1 : 0)); assertEquals(8, balance("HS001")); }
        finally { pool.shutdownNow(); }
    }
    @Test public void concurrentFirstAwardsAndIdenticalRetriesAreSerialized() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2); CountDownLatch start = new CountDownLatch(1);
        FairDto.TransactionRequest request = request("PLAY", "HARD", 20);
        Callable<FairDto.Receipt> award = () -> { start.await(); return post("play", "ROLE_PLAY", request); };
        try { Future<FairDto.Receipt> a = pool.submit(award), b = pool.submit(award); start.countDown(); assertEquals(a.get(15, TimeUnit.SECONDS).transaction.id, b.get(15, TimeUnit.SECONDS).transaction.id); assertEquals(20, balance("HS001")); }
        finally { pool.shutdownNow(); }
    }
}
