package com.globits.richy.config;

import static com.globits.richy.service.impl.TnttDocumentPayload.map;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

import com.globits.richy.service.impl.*;
import com.globits.security.domain.User;
import java.net.URI;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.LongSupplier;
import org.junit.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.common.exceptions.InvalidTokenException;
import org.springframework.security.oauth2.provider.*;
import org.springframework.security.oauth2.provider.token.ResourceServerTokenServices;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.socket.*;

public class TnttDocumentLiveGatewayTest {
    private TnttDocumentService documents;
    private ResourceServerTokenServices tokens;
    private TnttDocumentLiveGateway gateway;
    private long now;
    private static final String A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222", C = "33333333-3333-4333-8333-333333333333";

    @Before public void setup() {
        now = 1800000000000L; documents = mock(TnttDocumentService.class); tokens = mock(ResourceServerTokenServices.class);
        when(tokens.loadAuthentication("a")).thenReturn(authentication(1L)); when(tokens.loadAuthentication("b")).thenReturn(authentication(2L));
        when(tokens.loadAuthentication("invalid")).thenThrow(new InvalidTokenException("Invalid session"));
        when(documents.liveAccess(anyLong())).thenAnswer(invocation -> {
            Long id = (Long) invocation.getArguments()[0];
            if (!Arrays.asList(12L, 13L).contains(id)) throw new AccessDeniedException("No access");
            User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
            return map("userId", user.getId(), "name", "Người soạn " + user.getId(), "revision", 4L);
        });
        gateway = new TnttDocumentLiveGateway(documents, tokens);
        ReflectionTestUtils.setField(gateway, "clock", (LongSupplier) () -> now);
    }
    @After public void cleanup() { gateway.destroy(); SecurityContextHolder.clearContext(); }
    private OAuth2Authentication authentication(Long id) {
        User user = new User(); user.setId(id);
        return new OAuth2Authentication(new OAuth2Request(null, "web", null, true, null, null, null, null, null), new UsernamePasswordAuthenticationToken(user, null, Collections.emptyList()));
    }
    private Map<String, Object> claim(String ticket, boolean expected) throws Exception {
        ServerHttpRequest request = mock(ServerHttpRequest.class); ServerHttpResponse response = mock(ServerHttpResponse.class);
        when(request.getURI()).thenReturn(URI.create("https://tnttphungkhoang.com/service/public/tntt-document-live?ticket=" + ticket));
        Map<String, Object> attributes = new HashMap<>();
        assertEquals(expected, gateway.handshake().beforeHandshake(request, response, gateway, attributes));
        if (!expected) verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
        return attributes;
    }
    private class Connection {
        WebSocketSession socket = mock(WebSocketSession.class);
        List<String> messages = new CopyOnWriteArrayList<>(); AtomicBoolean open = new AtomicBoolean(true);
        Connection(Long document, String client, String token) throws Exception {
            String ticket = (String) gateway.issue(document, client, token).get("ticket");
            Map<String, Object> attributes = claim(ticket, true);
            when(socket.getId()).thenReturn(client + document); when(socket.getAttributes()).thenReturn(attributes); when(socket.isOpen()).thenAnswer(value -> open.get());
            doAnswer(value -> { messages.add(((TextMessage) value.getArguments()[0]).getPayload()); return null; }).when(socket).sendMessage(any(WebSocketMessage.class));
            doAnswer(value -> { open.set(false); gateway.afterConnectionClosed(socket, (CloseStatus) value.getArguments()[0]); return null; }).when(socket).close(any(CloseStatus.class));
            gateway.afterConnectionEstablished(socket);
        }
        void send(String value) throws Exception { gateway.handleMessage(socket, new TextMessage(value)); }
    }
    private void delivered(java.util.function.BooleanSupplier condition) throws Exception {
        long deadline = System.currentTimeMillis() + 2000;
        while (!condition.getAsBoolean() && System.currentTimeMillis() < deadline) Thread.sleep(10);
        assertTrue(condition.getAsBoolean());
    }

    @Test public void ticketsAreOneUseExpireAndRequireBothOAuthAndDocumentPermission() throws Exception {
        String ticket = (String) gateway.issue(12L, A, "a").get("ticket"); claim(ticket, true); claim(ticket, false);
        ticket = (String) gateway.issue(12L, A, "a").get("ticket"); now += 30001; claim(ticket, false);
        try { gateway.issue(12L, A, "invalid"); fail(); } catch (InvalidTokenException expected) {}
        try { gateway.issue(99L, A, "a"); fail(); } catch (AccessDeniedException expected) {}
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }
    @Test public void threeConnectionsAreRoomScopedAndCannotSpoofNamesOrPublishDocumentWrites() throws Exception {
        Connection a = new Connection(12L, A, "a"), b = new Connection(12L, B, "b"), other = new Connection(13L, C, "b");
        delivered(() -> a.messages.stream().anyMatch(message -> message.contains("join")));
        a.send("{\"type\":\"cursor\",\"name\":\"spoof\",\"cursor\":{\"visible\":true,\"x\":120,\"y\":180,\"tool\":\"pen\"}}");
        delivered(() -> b.messages.stream().anyMatch(message -> message.contains("\"type\":\"cursor\"")));
        String packet = b.messages.stream().filter(message -> message.contains("\"type\":\"cursor\"")).findFirst().get();
        assertTrue(packet.contains("Người soạn 1")); assertFalse(packet.contains("spoof")); assertFalse(packet.contains("\"token\""));
        gateway.onApplicationEvent(new TnttDocumentChanged(this, 12L, 5L));
        delivered(() -> b.messages.stream().anyMatch(message -> message.contains("\"revision\":5")));
        assertFalse(other.messages.stream().anyMatch(message -> message.contains("\"type\":\"cursor\"") || message.contains("\"revision\":5")));
        a.send("{\"type\":\"save\",\"document\":{\"text\":\"must not write\"}}");
        assertFalse(a.open.get()); verify(documents, never()).save(anyLong(), any());
    }
    @Test public void revokedSessionsAndInvalidCoordinatesCloseAndRemoveThePeer() throws Exception {
        Connection a = new Connection(12L, A, "a"), b = new Connection(12L, B, "b");
        now += 10001; when(tokens.loadAuthentication("a")).thenThrow(new InvalidTokenException("Revoked"));
        a.send("{\"type\":\"ping\"}"); assertFalse(a.open.get());
        delivered(() -> b.messages.stream().anyMatch(message -> message.contains("\"type\":\"leave\"")));
        b.send("{\"type\":\"cursor\",\"cursor\":{\"visible\":true,\"x\":-1,\"y\":20,\"tool\":\"text\"}}"); assertFalse(b.open.get());
    }
}
