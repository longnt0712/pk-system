package com.globits.richy.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.*;

@Configuration
@EnableWebSocket
public class TnttDocumentLiveConfig implements WebSocketConfigurer {
    @Autowired private TnttDocumentLiveGateway gateway;
    @Value("${tntt.documents.realtime.allowed-origins:https://tnttphungkhoang.com,https://www.tnttphungkhoang.com}") private String origins;

    @Override public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(gateway, "/public/tntt-document-live").addInterceptors(gateway.handshake()).setAllowedOrigins(origins.split("\\s*,\\s*"));
    }
}
