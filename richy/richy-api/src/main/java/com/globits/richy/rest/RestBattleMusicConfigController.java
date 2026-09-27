package com.globits.richy.rest;

import java.util.Collections;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import com.globits.richy.dto.BattleMusicConfigDto;
import com.globits.richy.service.BattleMusicConfigService;
import com.globits.richy.service.BattleOnlineException;

@RestController
@RequestMapping("/api/battle-music-config")
@Secured({"ROLE_ADMIN", "ROLE_USER", "ROLE_VIEWER"})
public class RestBattleMusicConfigController {
    @Autowired
    private BattleMusicConfigService service;

    @RequestMapping(value = "/active", method = RequestMethod.GET)
    public BattleMusicConfigDto getActiveConfig() { return service.getActiveConfig(); }

    @Secured("ROLE_ADMIN")
    @RequestMapping(value = "/admin", method = RequestMethod.GET)
    public BattleMusicConfigDto getAdminConfig() { return service.getAdminConfig(); }

    @Secured("ROLE_ADMIN")
    @RequestMapping(value = "/admin", method = RequestMethod.PUT)
    public BattleMusicConfigDto saveConfig(@RequestBody BattleMusicConfigDto dto) {
        return service.saveConfig(dto);
    }

    @ExceptionHandler(BattleOnlineException.class)
    public ResponseEntity<Map<String, String>> handleBattleOnlineException(BattleOnlineException exception) {
        return ResponseEntity.status(exception.getStatus())
                .body(Collections.singletonMap("message", exception.getMessage()));
    }
}
