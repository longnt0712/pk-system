package com.globits.richy.service;

import com.globits.richy.dto.BattleOnlineAnswerDto;
import com.globits.richy.dto.BattleOnlineAnswerResultDto;
import com.globits.richy.dto.BattleOnlineCreateRoomDto;
import com.globits.richy.dto.BattleOnlineRoomDto;
import com.globits.richy.dto.BattleOnlineRoomSettingsDto;

public interface BattleOnlineService {

    BattleOnlineRoomDto createRoom(
            String username,
            BattleOnlineCreateRoomDto createDto
    );

    BattleOnlineRoomDto joinRoom(
            String roomCode,
            String username
    );

    BattleOnlineRoomDto leaveRoom(
            String roomCode,
            String username
    );

    BattleOnlineRoomDto getRoom(
            String roomCode,
            String username
    );

    BattleOnlineRoomDto setReady(
            String roomCode,
            String username,
            boolean ready
    );

    BattleOnlineRoomDto updateSettings(
            String roomCode,
            String username,
            BattleOnlineRoomSettingsDto settings
    );

    BattleOnlineRoomDto startMatch(
            String roomCode,
            String username
    );

    BattleOnlineRoomDto restartMatch(
            String roomCode,
            String username
    );

    BattleOnlineAnswerResultDto answer(
            String roomCode,
            String username,
            BattleOnlineAnswerDto answerDto
    );
}
