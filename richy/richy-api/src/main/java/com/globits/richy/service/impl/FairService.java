package com.globits.richy.service.impl;

import java.util.*;
import javax.persistence.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.ResponseStatus;
import com.globits.core.domain.Person;
import com.globits.security.domain.User;
import com.globits.security.repository.UserRepository;
import com.globits.richy.domain.*;
import com.globits.richy.dto.FairDto;

/** Paper tickets never enter this ledger. Every wallet starts at zero per event. */
@Service
@Transactional
public class FairService {
    @PersistenceContext private EntityManager em;
    @Autowired private UserRepository users;

    @Transactional(readOnly = true)
    public List<FairEvent> events(boolean includeClosed) {
        if (includeClosed) { require("ROLE_ADMIN"); }
        return em.createQuery("from FairEvent" + (includeClosed ? "" : " where active=true") + " order by id desc", FairEvent.class).getResultList();
    }

    public FairEvent saveEvent(Long id, FairDto.EventRequest request) {
        require("ROLE_ADMIN");
        FairEvent event = id == null ? new FairEvent() : event(id);
        event.name = text(request.name, 150, "Hãy nhập tên hội chợ.");
        if (request.active != null) { event.active = request.active; }
        if (request.easyAmount != null) { event.easyAmount = positive(request.easyAmount); }
        if (request.mediumAmount != null) { event.mediumAmount = positive(request.mediumAmount); }
        if (request.hardAmount != null) { event.hardAmount = positive(request.hardAmount); }
        if (id == null) { event.createdAt = System.currentTimeMillis(); em.persist(event); }
        return event;
    }

    @Transactional(readOnly = true)
    public FairEvent event(Long id) {
        FairEvent event = id == null ? null : em.find(FairEvent.class, id);
        if (event == null) { throw new Missing("Không tìm thấy hội chợ."); }
        return event;
    }

    @Transactional(readOnly = true)
    public FairDto.Balance balance(Long eventId, String rawCode) {
        event(eventId);
        return new FairDto.Balance(resolve(eventId, rawCode));
    }

    private FairWallet resolve(Long eventId, String rawCode) {
        String code = cardCode(rawCode);
        FairWallet wallet = one("from FairWallet where eventId=:event and cardCode=:code", FairWallet.class, eventId, "code", code, false);
        if (wallet != null && wallet.guestNumber != null) { return wallet; }
        User student = users.findByUsernameAndPerson(code);
        if (student == null || !Boolean.TRUE.equals(student.getActive()) || student.getPerson() == null
                || student.getRoles().stream().noneMatch(role -> "ROLE_STUDENT".equals(role.getName()))) {
            throw new Missing("Không tìm thấy thẻ học sinh hoặc thẻ khách này.");
        }
        wallet = one("from FairWallet where eventId=:event and studentId=:student", FairWallet.class, eventId, "student", student.getId(), false);
        if (wallet != null) { return wallet; }
        Person person = student.getPerson();
        wallet = new FairWallet(); wallet.eventId = eventId; wallet.studentId = student.getId(); wallet.cardCode = student.getUsername();
        String name = (clean(person.getLastName()) + " " + clean(person.getFirstName())).trim();
        wallet.displayName = name.isEmpty() ? clean(person.getDisplayName()) : name;
        if (wallet.displayName.isEmpty()) { wallet.displayName = wallet.cardCode; }
        if (wallet.displayName.length() > 200) { wallet.displayName = wallet.displayName.substring(0, 200); }
        return wallet;
    }

    @Transactional(readOnly = true)
    public FairDto.Operator operator(Long eventId) {
        require("ROLE_ADMIN", "ROLE_GIFT", "ROLE_PLAY"); event(eventId);
        FairDto.Operator dto = new FairDto.Operator(); dto.username = actor(); dto.admin = has("ROLE_ADMIN");
        dto.canPlay = dto.admin || has("ROLE_PLAY"); dto.canGift = dto.admin || has("ROLE_GIFT");
        dto.station = station(eventId, dto.username); return dto;
    }

    public FairStation saveStation(Long eventId, FairDto.StationRequest request) {
        require("ROLE_ADMIN"); event(eventId);
        User user = users.findByUsername(text(request.operatorName, 100, "Hãy nhập tài khoản người trực."));
        if (user == null || !Boolean.TRUE.equals(user.getActive())) { throw invalid("Tài khoản người trực không tồn tại hoặc đã khóa."); }
        operation(request.operation);
        if (user.getRoles().stream().noneMatch(role -> "ROLE_ADMIN".equals(role.getName())
                || ("ROLE_" + request.operation).equals(role.getName()))) {
            throw invalid("Tài khoản cần được gán quyền ROLE_" + request.operation + " trước.");
        }
        // Serialize initial assignment so two admins cannot create duplicate stations for one account.
        em.lock(event(eventId), LockModeType.PESSIMISTIC_WRITE);
        FairStation value = station(eventId, user.getUsername());
        if (value == null) { value = new FairStation(); value.eventId = eventId; value.operatorName = user.getUsername(); }
        value.name = text(request.name, 150, "Hãy nhập tên gian hàng."); value.operation = request.operation; value.tier = "CHOOSE";
        if (value.id == null) { em.persist(value); }
        return value;
    }

    @Transactional(readOnly = true)
    public List<FairStation> stations(Long eventId) {
        require("ROLE_ADMIN"); event(eventId);
        return em.createQuery("from FairStation where eventId=:event order by name", FairStation.class).setParameter("event", eventId).getResultList();
    }

    public List<FairWallet> generateGuests(Long eventId, int count) {
        require("ROLE_ADMIN"); FairEvent event = event(eventId); em.lock(event, LockModeType.PESSIMISTIC_WRITE);
        if (count < 1 || count > 500) { throw invalid("Mỗi lần tạo từ 1 đến 500 thẻ khách."); }
        Integer last = em.createQuery("select max(guestNumber) from FairWallet where eventId=:event", Integer.class).setParameter("event", eventId).getSingleResult();
        int start = last == null ? 0 : last;
        if (start + count > 10000) { throw invalid("Hội chợ đã đạt giới hạn thẻ khách."); }
        List<FairWallet> result = new ArrayList<>();
        for (int i = 1; i <= count; i++) {
            FairWallet wallet = new FairWallet(); wallet.eventId = eventId; wallet.guestNumber = start + i;
            wallet.displayName = String.format(Locale.ROOT, "Khách KH%03d", wallet.guestNumber);
            // The random suffix prevents collisions with existing student usernames and between events.
            wallet.cardCode = "HC-" + eventId + "-KH" + String.format(Locale.ROOT, "%03d", wallet.guestNumber) + "-" + UUID.randomUUID().toString().substring(0, 8);
            em.persist(wallet); result.add(wallet);
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<FairWallet> guests(Long eventId) {
        require("ROLE_ADMIN"); event(eventId);
        return em.createQuery("from FairWallet where eventId=:event and guestNumber is not null order by guestNumber", FairWallet.class).setParameter("event", eventId).getResultList();
    }

    public FairDto.Receipt transact(Long eventId, FairDto.TransactionRequest request) {
        operation(request.operation); require("ROLE_ADMIN", "ROLE_" + request.operation); key(request.requestKey);
        if (request.amount == null || request.amount < 1) { throw invalid("Mức phiếu không hợp lệ."); }
        FairEvent event = event(eventId);
        FairWallet wallet = lockedWallet(eventId, request.cardCode);
        FairTransaction previous = request(eventId, request.requestKey);
        if (previous != null) {
            same(previous, wallet, request.operation, request.amount, null);
            if (!Objects.equals(previous.tier, request.tier)) { throw invalid("Mã giao dịch đã dùng cho một mức khác."); }
            return new FairDto.Receipt(wallet, previous, true);
        }
        if (!event.active) { throw invalid("Hội chợ đã đóng, không thể cộng hoặc đổi phiếu."); }
        if (price(event, request.tier) != request.amount) { throw invalid("Cấu hình mức phiếu đã thay đổi. Hãy kiểm tra mức mới rồi xác nhận lại."); }
        FairStation station = station(eventId, actor());
        // Roles authorize the action. Legacy station assignments only supply an audit label.
        String stationName = station != null && request.operation.equals(station.operation) ? station.name
            : "PLAY".equals(request.operation) ? "Thưởng trò chơi" : "Đổi quà";
        int delta = "PLAY".equals(request.operation) ? request.amount : -request.amount;
        FairTransaction tx = record(wallet, request.operation, request.amount, delta, request.requestKey,
            has("ROLE_ADMIN") ? "Quản trị viên" : stationName, null, null);
        tx.tier = request.tier;
        return new FairDto.Receipt(wallet, tx, false);
    }

    public FairDto.Receipt undo(Long eventId, Long transactionId, FairDto.UndoRequest request) {
        require("ROLE_ADMIN", "ROLE_PLAY"); key(request.requestKey); event(eventId);
        FairTransaction original = transactionId == null ? null : em.find(FairTransaction.class, transactionId);
        if (original == null || !eventId.equals(original.eventId) || !"PLAY".equals(original.operation)
                || original.correctionOf != null || original.delta <= 0) { throw invalid("Chỉ có thể hoàn tác một lượt cộng phiếu gốc."); }
        if (!actor().equals(original.actor)) { throw new AccessDeniedException("Chỉ được hoàn tác lượt cộng do chính tài khoản này thực hiện."); }
        FairWallet wallet = em.find(FairWallet.class, original.walletId, LockModeType.PESSIMISTIC_WRITE);
        em.refresh(wallet, LockModeType.PESSIMISTIC_WRITE);
        FairTransaction previous = request(eventId, request.requestKey);
        if (previous != null) {
            same(previous, wallet, "PLAY", 0, original.id);
            if (!"Hoàn tác cộng phiếu".equals(previous.reason)) { throw invalid("Mã giao dịch đã dùng cho một thao tác khác."); }
            return new FairDto.Receipt(wallet, previous, true);
        }
        em.refresh(original);
        if (original.corrected) { throw invalid("Lượt cộng này đã được hoàn tác hoặc điều chỉnh trước đó."); }
        List<FairTransaction> latest = em.createQuery("from FairTransaction where eventId=:event and actor=:actor and correctionOf is null order by id desc", FairTransaction.class)
            .setParameter("event", eventId).setParameter("actor", actor()).setMaxResults(1).getResultList();
        if (latest.isEmpty() || !latest.get(0).id.equals(original.id)) { throw invalid("Chỉ được hoàn tác lượt cộng gần nhất của tài khoản này."); }
        FairTransaction tx = record(wallet, "PLAY", 0, -original.amount, request.requestKey,
            original.stationName, original.id, "Hoàn tác cộng phiếu");
        original.corrected = true;
        return new FairDto.Receipt(wallet, tx, false);
    }

    public FairDto.Receipt correct(Long eventId, Long transactionId, FairDto.CorrectionRequest request) {
        require("ROLE_ADMIN"); key(request.requestKey); event(eventId);
        if (request.amount == null || request.amount < 0 || request.amount > 1000000) { throw invalid("Mức phiếu cần sửa không hợp lệ."); }
        String reason = text(request.reason, 300, "Hãy nhập lý do sửa giao dịch.");
        FairTransaction original = em.find(FairTransaction.class, transactionId);
        if (original == null || !eventId.equals(original.eventId) || original.correctionOf != null) { throw invalid("Giao dịch cần sửa không hợp lệ."); }
        FairWallet wallet = em.find(FairWallet.class, original.walletId, LockModeType.PESSIMISTIC_WRITE);
        em.refresh(wallet, LockModeType.PESSIMISTIC_WRITE);
        FairTransaction previous = request(eventId, request.requestKey);
        if (previous != null) {
            same(previous, wallet, original.operation, request.amount, original.id);
            return new FairDto.Receipt(wallet, previous, true);
        }
        em.refresh(original); // Another administrator may have corrected it while we waited for the wallet lock.
        if (original.corrected) { throw invalid("Giao dịch này đã được sửa. Hãy xem lịch sử."); }
        if (request.amount == original.amount) { throw invalid("Mức mới đang giống mức đã ghi nhận."); }
        int delta = ("PLAY".equals(original.operation) ? 1 : -1) * (request.amount - original.amount);
        FairTransaction tx = record(wallet, original.operation, request.amount, delta, request.requestKey,
            original.stationName, original.id, reason);
        original.corrected = true;
        return new FairDto.Receipt(wallet, tx, false);
    }

    @Transactional(readOnly = true)
    public List<FairTransaction> history(Long eventId, String code, long before) {
        require("ROLE_ADMIN"); event(eventId);
        String filter = clean(code);
        String sql = "from FairTransaction where eventId=:event" + (filter.isEmpty() ? "" : " and cardCode=:code")
            + (before > 0 ? " and id<:before" : "") + " order by id desc";
        TypedQuery<FairTransaction> query = em.createQuery(sql, FairTransaction.class).setParameter("event", eventId).setMaxResults(50);
        if (!filter.isEmpty()) { query.setParameter("code", cardCode(filter)); }
        if (before > 0) { query.setParameter("before", before); }
        return query.getResultList();
    }

    private FairWallet lockedWallet(Long eventId, String code) {
        FairWallet candidate = resolve(eventId, code);
        if (candidate.id != null) { em.refresh(candidate, LockModeType.PESSIMISTIC_WRITE); return candidate; }
        // First-time issuance locks the event, then checks again before creating the zero wallet.
        em.lock(event(eventId), LockModeType.PESSIMISTIC_WRITE);
        FairWallet existing = one("from FairWallet where eventId=:event and studentId=:student", FairWallet.class,
            eventId, "student", candidate.studentId, true);
        if (existing != null) { return existing; }
        em.persist(candidate); em.flush(); return candidate;
    }

    private FairTransaction record(FairWallet wallet, String operation, int amount, int delta, String key, String station, Long correction, String reason) {
        long next = (long) wallet.balance + delta;
        if (next < 0) { throw invalid("Không đủ phiếu. Hiện có " + wallet.balance + " phiếu, còn thiếu " + (-next) + " phiếu."); }
        if (next > Integer.MAX_VALUE) { throw invalid("Số dư vượt giới hạn cho phép."); }
        wallet.balance = (int) next;
        FairTransaction tx = new FairTransaction(); tx.eventId = wallet.eventId; tx.walletId = wallet.id;
        tx.cardCode = wallet.cardCode; tx.displayName = wallet.displayName; tx.operation = operation; tx.amount = amount;
        tx.delta = delta; tx.balanceAfter = wallet.balance; tx.actor = actor(); tx.stationName = station;
        tx.requestKey = key; tx.createdAt = System.currentTimeMillis(); tx.correctionOf = correction; tx.reason = reason;
        em.persist(tx); em.flush(); return tx;
    }

    private FairStation station(Long event, String actor) {
        return one("from FairStation where eventId=:event and operatorName=:actor", FairStation.class, event, "actor", actor, false);
    }
    private FairTransaction request(Long event, String key) {
        return one("from FairTransaction where eventId=:event and requestKey=:key", FairTransaction.class, event, "key", key, false);
    }
    private <T> T one(String sql, Class<T> type, Long event, String parameter, Object value, boolean lock) {
        TypedQuery<T> query = em.createQuery(sql, type).setParameter("event", event).setParameter(parameter, value);
        if (lock) { query.setLockMode(LockModeType.PESSIMISTIC_WRITE); }
        List<T> values = query.setMaxResults(1).getResultList(); return values.isEmpty() ? null : values.get(0);
    }
    private void same(FairTransaction tx, FairWallet wallet, String operation, int amount, Long correction) {
        if (!tx.actor.equals(actor()) || !tx.walletId.equals(wallet.id) || !tx.operation.equals(operation)
            || tx.amount != amount || !Objects.equals(tx.correctionOf, correction)) {
            throw invalid("Mã giao dịch đã dùng cho một thao tác khác.");
        }
    }
    private static int positive(int value) {
        if (value < 1 || value > 1000000) { throw invalid("Mỗi mức phải từ 1 đến 1.000.000 phiếu."); }
        return value;
    }
    private static int price(FairEvent event, String tier) {
        if ("EASY".equals(tier)) { return event.easyAmount; }
        if ("MEDIUM".equals(tier)) { return event.mediumAmount; }
        if ("HARD".equals(tier)) { return event.hardAmount; }
        throw invalid("Hãy chọn mức dễ, trung bình hoặc khó.");
    }
    private static void operation(String value) { if (!"PLAY".equals(value) && !"GIFT".equals(value)) { throw invalid("Chức năng không hợp lệ."); } }
    private static void key(String value) {
        try { if (value == null || !UUID.fromString(value).toString().equals(value)) { throw new IllegalArgumentException(); } }
        catch (IllegalArgumentException error) { throw invalid("Mã giao dịch không hợp lệ."); }
    }
    private static String cardCode(String value) {
        String code = text(value, 100, "Hãy quét hoặc nhập mã thẻ.");
        if (!code.matches("[\\p{L}\\p{N}_.@-]+")) { throw invalid("Mã thẻ không hợp lệ. Hãy dùng mã học sinh hoặc thẻ khách."); }
        return code;
    }
    private static String clean(String value) { return value == null ? "" : value.trim(); }
    private static String text(String value, int max, String message) {
        String result = clean(value);
        if (result.isEmpty() || result.length() > max || result.chars().anyMatch(Character::isISOControl)) { throw invalid(message); }
        return result;
    }
    private static Authentication authentication() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) { throw new AccessDeniedException("Hãy đăng nhập bằng tài khoản người trực."); }
        return auth;
    }
    private static String actor() { return authentication().getName(); }
    private static boolean has(String role) { return authentication().getAuthorities().stream().anyMatch(value -> role.equals(value.getAuthority())); }
    private static void require(String... roles) {
        for (String role : roles) { if (has(role)) { return; } }
        throw new AccessDeniedException("Tài khoản không có quyền thực hiện thao tác này.");
    }
    private static Invalid invalid(String message) { return new Invalid(message); }
    @ResponseStatus(HttpStatus.BAD_REQUEST) public static class Invalid extends RuntimeException { public Invalid(String message) { super(message); } }
    @ResponseStatus(HttpStatus.NOT_FOUND) public static class Missing extends RuntimeException { public Missing(String message) { super(message); } }
}
