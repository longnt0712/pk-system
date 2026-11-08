package com.globits.richy.config;

import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

import org.junit.Test;
import org.springframework.context.annotation.*;
import org.springframework.mock.web.MockServletContext;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.handler.AbstractUrlHandlerMapping;
import org.springframework.web.socket.server.HandshakeInterceptor;

public class TnttDocumentLiveConfigTest {
    @Configuration
    static class Dependencies {
        @Bean public TnttDocumentLiveGateway gateway() {
            TnttDocumentLiveGateway gateway = mock(TnttDocumentLiveGateway.class);
            HandshakeInterceptor handshake = mock(HandshakeInterceptor.class);
            when(gateway.handshake()).thenReturn(handshake);
            return gateway;
        }
    }

    @Test public void documentSocketsAndTheExistingBattleSockJsEndpointStartTogether() {
        AnnotationConfigWebApplicationContext context = new AnnotationConfigWebApplicationContext();
        context.setServletContext(new MockServletContext());
        context.register(Dependencies.class, TnttDocumentLiveConfig.class, BattleOnlineWebSocketConfig.class);
        try {
            context.refresh();
            AbstractUrlHandlerMapping notes = context.getBean("webSocketHandlerMapping", AbstractUrlHandlerMapping.class);
            AbstractUrlHandlerMapping battle = context.getBean("stompWebSocketHandlerMapping", AbstractUrlHandlerMapping.class);
            assertTrue(notes.getHandlerMap().containsKey("/public/tntt-document-live"));
            assertTrue(battle.getHandlerMap().containsKey("/public/battle-online-ws/**"));
        } finally { context.close(); }
    }
}
