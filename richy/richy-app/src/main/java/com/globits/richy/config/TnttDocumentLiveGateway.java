package com.globits.richy.config;

import static com.globits.richy.service.impl.TnttDocumentPayload.map;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.globits.richy.service.impl.TnttDocumentChanged;
import com.globits.richy.service.impl.TnttDocumentService;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.LongSupplier;
import javax.annotation.PostConstruct;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationListener;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.*;
import org.springframework.security.oauth2.provider.token.ResourceServerTokenServices;
import org.springframework.security.oauth2.common.exceptions.OAuth2Exception;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.*;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

/** Only presence and committed revision hints cross this socket. Writes keep REST OAuth and DB revision checks. */
@Component
public class TnttDocumentLiveGateway extends TextWebSocketHandler implements ApplicationListener<TnttDocumentChanged>, DisposableBean {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String[] COLORS = {"#2563eb", "#b45309", "#be185d", "#047857", "#7c3aed", "#0e7490", "#c2410c", "#4338ca"};
    private final TnttDocumentService documents;
    private final ResourceServerTokenServices tokens;
    private final Map<String, Ticket> tickets = new ConcurrentHashMap<>();
    private final Map<String, Peer> sockets = new ConcurrentHashMap<>();
    private final Map<Long, ConcurrentHashMap<String, Peer>> rooms = new ConcurrentHashMap<>();
    private final ExecutorService delivery = new ThreadPoolExecutor(1, 2, 30, TimeUnit.SECONDS, new ArrayBlockingQueue<>(512), task -> { Thread thread = new Thread(task, "tntt-live-delivery"); thread.setDaemon(true); return thread; }, new ThreadPoolExecutor.DiscardOldestPolicy());
    private ScheduledExecutorService cleaner;
    private LongSupplier clock = System::currentTimeMillis;

    private static final class Ticket {
        Long documentId, userId;
        String clientId, token;
        long expires;
    }
    private static final class Peer {
        Ticket ticket;
        WebSocketSession raw, channel;
        Map<String, Object> profile;
        String color;
        volatile Map<String, Object> cursor = map("visible", false);
        volatile long seen, checked, moved;
        Map<String, Object> publicValue() { return map("id", ticket.clientId, "name", profile.get("name"), "color", color, "cursor", cursor); }
    }

    @Autowired
    public TnttDocumentLiveGateway(TnttDocumentService documents, ResourceServerTokenServices tokens) { this.documents = documents; this.tokens = tokens; }

    private Map<String, Object> access(String token, Long id) {
        Authentication authentication = tokens.loadAuthentication(token);
        if (authentication == null || !authentication.isAuthenticated()) throw new AccessDeniedException("Cần đăng nhập.");
        SecurityContext previous = SecurityContextHolder.getContext(), temporary = SecurityContextHolder.createEmptyContext();
        temporary.setAuthentication(authentication); SecurityContextHolder.setContext(temporary);
        try { return documents.liveAccess(id); } finally { SecurityContextHolder.setContext(previous); }
    }

    public Map<String, Object> issue(Long id, String clientId, String token) {
        if (clientId == null || !clientId.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}") || token == null || token.isEmpty() || token.length() > 8192) throw new IllegalArgumentException("Thiếu phiên soạn tài liệu.");
        Map<String, Object> profile = access(token, id);
        tickets.entrySet().removeIf(entry -> entry.getValue().expires <= clock.getAsLong());
        if (tickets.size() >= 5000) throw new IllegalArgumentException("Đang có nhiều phiên kết nối. Vui lòng thử lại.");
        Ticket ticket = new Ticket(); ticket.documentId = id; ticket.userId = ((Number) profile.get("userId")).longValue(); ticket.clientId = clientId; ticket.token = token; ticket.expires = clock.getAsLong() + 30000;
        String nonce = UUID.randomUUID().toString().replace("-", ""); tickets.put(nonce, ticket);
        return map("ticket", nonce, "expiresAt", ticket.expires);
    }

    public HandshakeInterceptor handshake() {
        return new HandshakeInterceptor() {
            @Override public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler handler, Map<String, Object> attributes) {
                List<String> values = UriComponentsBuilder.fromUri(request.getURI()).build().getQueryParams().get("ticket");
                Ticket ticket = values != null && values.size() == 1 ? tickets.remove(values.get(0)) : null;
                if (ticket == null || ticket.expires <= clock.getAsLong()) { response.setStatusCode(HttpStatus.UNAUTHORIZED); return false; }
                attributes.put("tntt-ticket", ticket); return true;
            }
            @Override public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler handler, Exception exception) {}
        };
    }

    @Override public void afterConnectionEstablished(WebSocketSession socket) throws Exception {
        Object claimed = socket.getAttributes().get("tntt-ticket");
        if (!(claimed instanceof Ticket)) { socket.close(CloseStatus.POLICY_VIOLATION); return; }
        Ticket ticket = (Ticket) claimed;
        Map<String, Object> profile;
        try { profile = access(ticket.token, ticket.documentId); } catch (RuntimeException error) { socket.close(error instanceof AccessDeniedException || error instanceof OAuth2Exception ? CloseStatus.POLICY_VIOLATION.withReason("AUTH") : CloseStatus.SERVER_ERROR); return; }
        if (((Number) profile.get("userId")).longValue() != ticket.userId) { socket.close(CloseStatus.POLICY_VIOLATION); return; }
        socket.setTextMessageSizeLimit(2048);
        Peer peer = new Peer(); peer.ticket = ticket; peer.profile = profile; peer.raw = socket; peer.channel = new ConcurrentWebSocketSessionDecorator(socket, 5000, 32768); peer.seen = peer.checked = clock.getAsLong();
        Peer previous;
        List<Object> others = new ArrayList<>();
        // Membership and removal of an empty room must be atomic with each other.
        synchronized (rooms) {
            ConcurrentHashMap<String, Peer> room = rooms.computeIfAbsent(ticket.documentId, id -> new ConcurrentHashMap<>());
            if (room.size() >= 100) { socket.close(CloseStatus.POLICY_VIOLATION); return; }
            previous = room.get(ticket.clientId);
            if (previous != null && !Objects.equals(previous.ticket.userId, ticket.userId)) { socket.close(CloseStatus.POLICY_VIOLATION); return; }
            Set<String> usedColors = new HashSet<>(); room.values().forEach(value -> usedColors.add(value.color));
            int hash = ticket.clientId.hashCode() & Integer.MAX_VALUE;
            peer.color = previous == null ? null : previous.color;
            for (int index = 0; peer.color == null && index < COLORS.length; index++) { String color = COLORS[(hash % COLORS.length + index) % COLORS.length]; if (!usedColors.contains(color)) peer.color = color; }
            if (peer.color == null) peer.color = String.format("#%02x%02x%02x", 32 + (hash & 79), 32 + (hash >> 8 & 79), 32 + (hash >> 16 & 79));
            room.values().forEach(value -> { if (!value.ticket.clientId.equals(ticket.clientId)) others.add(value.publicValue()); });
            room.put(ticket.clientId, peer); sockets.put(socket.getId(), peer);
        }
        if (previous != null) close(previous, CloseStatus.NORMAL);
        send(peer, map("type", "welcome", "documentId", ticket.documentId, "revision", profile.get("revision"), "self", peer.publicValue(), "peers", others));
        broadcast(ticket.documentId, ticket.clientId, map("type", "join", "peer", peer.publicValue()));
    }

    @Override protected void handleTextMessage(WebSocketSession socket, TextMessage message) throws Exception {
        Peer peer = sockets.get(socket.getId());
        if (peer == null) { socket.close(CloseStatus.POLICY_VIOLATION); return; }
        try {
            if (message.getPayloadLength() > 2048) throw new IllegalArgumentException();
            Map<String, Object> value = JSON.readValue(message.getPayload(), new TypeReference<Map<String, Object>>() {});
            long now = clock.getAsLong(); peer.seen = now;
            if (now - peer.checked >= 10000) {
                peer.profile = access(peer.ticket.token, peer.ticket.documentId); peer.checked = now;
                if (((Number) peer.profile.get("userId")).longValue() != peer.ticket.userId) throw new AccessDeniedException("Phiên soạn đã thay đổi.");
            }
            if ("ping".equals(value.get("type"))) {
                List<Object> roster = new ArrayList<>(); Map<String, Peer> room = rooms.get(peer.ticket.documentId);
                if (room != null) room.values().forEach(other -> { if (other != peer) roster.add(other.publicValue()); });
                send(peer, map("type", "pong", "peers", roster)); return;
            }
            if (!"cursor".equals(value.get("type")) || !(value.get("cursor") instanceof Map)) throw new IllegalArgumentException();
            if (now - peer.moved < 35) return;
            Map<?, ?> cursor = (Map<?, ?>) value.get("cursor");
            if (!Boolean.TRUE.equals(cursor.get("visible"))) peer.cursor = map("visible", false);
            else {
                double x = coordinate(cursor.get("x")), y = coordinate(cursor.get("y"));
                Object tool = cursor.get("tool");
                if (!Arrays.asList("text", "pen", "highlighter", "eraser", "lasso").contains(tool)) throw new IllegalArgumentException();
                peer.cursor = map("visible", true, "x", x, "y", y, "tool", tool);
            }
            peer.moved = now;
            broadcast(peer.ticket.documentId, peer.ticket.clientId, map("type", "cursor", "peer", peer.publicValue()));
        } catch (AccessDeniedException | OAuth2Exception error) { close(peer, CloseStatus.POLICY_VIOLATION.withReason("AUTH")); }
        catch (IllegalArgumentException | java.io.IOException error) { close(peer, CloseStatus.POLICY_VIOLATION.withReason("INVALID_DATA")); }
        catch (Exception error) { close(peer, CloseStatus.SERVER_ERROR); }
    }

    private double coordinate(Object value) {
        if (!(value instanceof Number)) throw new IllegalArgumentException();
        double coordinate = ((Number) value).doubleValue();
        if (Double.isNaN(coordinate) || Double.isInfinite(coordinate) || coordinate < 0 || coordinate > 100000) throw new IllegalArgumentException();
        return coordinate;
    }
    private void send(Peer peer, Map<String, Object> packet) {
        try { if (peer.channel.isOpen()) peer.channel.sendMessage(new TextMessage(JSON.writeValueAsString(packet))); }
        catch (Exception error) { close(peer, CloseStatus.SERVER_ERROR); }
    }
    private void broadcast(Long id, String exclude, Map<String, Object> packet) {
        if (delivery.isShutdown()) return;
        delivery.execute(() -> { Map<String, Peer> room = rooms.get(id); if (room != null) room.values().forEach(peer -> { if (!peer.ticket.clientId.equals(exclude)) send(peer, packet); }); });
    }
    private void close(Peer peer, CloseStatus status) {
        try { peer.channel.close(status); } catch (Exception ignore) {} finally { remove(peer); }
    }
    private void remove(Peer peer) {
        sockets.remove(peer.raw.getId(), peer);
        boolean removed = false;
        synchronized (rooms) {
            ConcurrentHashMap<String, Peer> room = rooms.get(peer.ticket.documentId);
            if (room != null && room.remove(peer.ticket.clientId, peer)) {
                removed = true; if (room.isEmpty()) rooms.remove(peer.ticket.documentId, room);
            }
        }
        if (removed) broadcast(peer.ticket.documentId, peer.ticket.clientId, map("type", "leave", "id", peer.ticket.clientId));
    }
    @Override public void afterConnectionClosed(WebSocketSession socket, CloseStatus status) { Peer peer = sockets.get(socket.getId()); if (peer != null) remove(peer); }
    @Override public void handleTransportError(WebSocketSession socket, Throwable error) { Peer peer = sockets.get(socket.getId()); if (peer != null) close(peer, CloseStatus.SERVER_ERROR); }
    @Override public void onApplicationEvent(TnttDocumentChanged event) { broadcast(event.documentId, null, map("type", "revision", "revision", event.revision)); }

    @PostConstruct public void start() {
        cleaner = Executors.newSingleThreadScheduledExecutor(task -> { Thread thread = new Thread(task, "tntt-live-cleaner"); thread.setDaemon(true); return thread; });
        cleaner.scheduleWithFixedDelay(() -> {
            long now = clock.getAsLong(); tickets.entrySet().removeIf(entry -> entry.getValue().expires <= now);
            sockets.values().forEach(peer -> { if (now - peer.seen > 45000) close(peer, CloseStatus.NORMAL); });
        }, 15, 15, TimeUnit.SECONDS);
    }
    @Override public void destroy() { if (cleaner != null) cleaner.shutdownNow(); sockets.values().forEach(peer -> close(peer, CloseStatus.GOING_AWAY)); delivery.shutdownNow(); tickets.clear(); rooms.clear(); }
}
