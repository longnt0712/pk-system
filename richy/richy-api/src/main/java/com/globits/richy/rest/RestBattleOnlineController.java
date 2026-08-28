package com.globits.richy.rest;

import java.util.Collections;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.annotation.Secured;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import com.globits.richy.dto.BattleOnlineAnswerDto;
import com.globits.richy.dto.BattleOnlineAnswerResultDto;
import com.globits.richy.dto.BattleOnlineCreateRoomDto;
import com.globits.richy.dto.BattleOnlinePasswordChoiceDto;
import com.globits.richy.dto.BattleOnlinePasswordGuessDto;
import com.globits.richy.dto.BattleOnlinePasswordGuessResultDto;
import com.globits.richy.dto.BattleOnlineReadyDto;
import com.globits.richy.dto.BattleOnlineRoomDto;
import com.globits.richy.dto.BattleOnlineRoomSettingsDto;
import com.globits.richy.dto.BattleOnlineSpectatorDto;
import com.globits.richy.dto.BattleOnlineUseSkillDto;
import com.globits.richy.service.BattleOnlineException;
import com.globits.richy.service.BattleOnlineService;

@RestController
@RequestMapping("/api/battle-online")
@Secured({"ROLE_ADMIN", "ROLE_USER", "ROLE_VIEWER"})
public class RestBattleOnlineController {

    @Autowired
    private BattleOnlineService battleOnlineService;

    @RequestMapping(value = "/rooms", method = RequestMethod.POST)
    public BattleOnlineRoomDto createRoom(
            @RequestBody BattleOnlineCreateRoomDto dto) {

        return battleOnlineService.createRoom(
                currentUsername(),
                dto
        );
    }

    @RequestMapping(value = "/rooms/{roomCode}/join", method = RequestMethod.POST)
    public BattleOnlineRoomDto joinRoom(@PathVariable String roomCode) {
        return battleOnlineService.joinRoom(
                roomCode,
                currentUsername()
        );
    }

    @RequestMapping(value = "/rooms/{roomCode}/leave", method = RequestMethod.POST)
    public BattleOnlineRoomDto leaveRoom(@PathVariable String roomCode) {
        return battleOnlineService.leaveRoom(
                roomCode,
                currentUsername()
        );
    }

    @RequestMapping(value = "/rooms/{roomCode}", method = RequestMethod.GET)
    public BattleOnlineRoomDto getRoom(@PathVariable String roomCode) {
        return battleOnlineService.getRoom(
                roomCode,
                currentUsername()
        );
    }

    @RequestMapping(value = "/rooms/{roomCode}/ready", method = RequestMethod.POST)
    public BattleOnlineRoomDto setReady(
            @PathVariable String roomCode,
            @RequestBody BattleOnlineReadyDto dto) {

        return battleOnlineService.setReady(
                roomCode,
                currentUsername(),
                dto != null && dto.isReady()
        );
    }

    @RequestMapping(value = "/rooms/{roomCode}/spectator", method = RequestMethod.POST)
    public BattleOnlineRoomDto setSpectator(
            @PathVariable String roomCode,
            @RequestBody BattleOnlineSpectatorDto dto) {

        return battleOnlineService.setSpectator(
                roomCode,
                currentUsername(),
                dto != null && dto.isSpectator()
        );
    }

    @RequestMapping(
            value = "/rooms/{roomCode}/players/{targetUsername}/kick",
            method = RequestMethod.POST
    )
    public BattleOnlineRoomDto kickPlayer(
            @PathVariable String roomCode,
            @PathVariable String targetUsername) {

        return battleOnlineService.kickPlayer(
                roomCode,
                currentUsername(),
                targetUsername
        );
    }

    @RequestMapping(value = "/rooms/{roomCode}/settings", method = RequestMethod.PUT)
    public BattleOnlineRoomDto updateSettings(
            @PathVariable String roomCode,
            @RequestBody BattleOnlineRoomSettingsDto dto) {

        return battleOnlineService.updateSettings(
                roomCode,
                currentUsername(),
                dto
        );
    }

    @RequestMapping(value = "/rooms/{roomCode}/start", method = RequestMethod.POST)
    public BattleOnlineRoomDto startMatch(@PathVariable String roomCode) {
        return battleOnlineService.startMatch(
                roomCode,
                currentUsername()
        );
    }

    @RequestMapping(value = "/rooms/{roomCode}/restart", method = RequestMethod.POST)
    public BattleOnlineRoomDto restartMatch(@PathVariable String roomCode) {
        return battleOnlineService.restartMatch(
                roomCode,
                currentUsername()
        );
    }

    @RequestMapping(value = "/rooms/{roomCode}/answer", method = RequestMethod.POST)
    public BattleOnlineAnswerResultDto answer(
            @PathVariable String roomCode,
            @RequestBody BattleOnlineAnswerDto dto) {

        return battleOnlineService.answer(
                roomCode,
                currentUsername(),
                dto
        );
    }

    @RequestMapping(value = "/rooms/{roomCode}/skill", method = RequestMethod.POST)
    public BattleOnlineRoomDto useSkill(
            @PathVariable String roomCode,
            @RequestBody BattleOnlineUseSkillDto dto) {

        return battleOnlineService.useSkill(
                roomCode,
                currentUsername(),
                dto
        );
    }

    @RequestMapping(value = "/rooms/{roomCode}/password", method = RequestMethod.POST)
    public BattleOnlineRoomDto choosePassword(
            @PathVariable String roomCode,
            @RequestBody BattleOnlinePasswordChoiceDto dto) {

        return battleOnlineService.choosePassword(
                roomCode,
                currentUsername(),
                dto
        );
    }

    @RequestMapping(value = "/rooms/{roomCode}/password-guess", method = RequestMethod.POST)
    public BattleOnlinePasswordGuessResultDto guessPassword(
            @PathVariable String roomCode,
            @RequestBody BattleOnlinePasswordGuessDto dto) {

        return battleOnlineService.guessPassword(
                roomCode,
                currentUsername(),
                dto
        );
    }

    private String currentUsername() {
        Authentication authentication =
                SecurityContextHolder
                    .getContext()
                    .getAuthentication();

        if (
            authentication == null ||
            !authentication.isAuthenticated() ||
            authentication.getName() == null
        ) {
            throw new BattleOnlineException(
                    org.springframework.http.HttpStatus.UNAUTHORIZED,
                    "Bạn chưa đăng nhập."
            );
        }

        return authentication.getName();
    }

    @ExceptionHandler(BattleOnlineException.class)
    public ResponseEntity<Map<String, String>> handleBattleOnlineException(
            BattleOnlineException exception) {

        return ResponseEntity
                .status(exception.getStatus())
                .body(
                    Collections.singletonMap(
                        "message",
                        exception.getMessage()
                    )
                );
    }
}
