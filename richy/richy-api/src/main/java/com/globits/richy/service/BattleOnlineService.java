package com.globits.richy.service;

import com.globits.richy.dto.BattleOnlineAnswerDto;
import com.globits.richy.dto.BattleOnlineAnswerResultDto;
import com.globits.richy.dto.BattleOnlineCreateRoomDto;
import com.globits.richy.dto.BattleOnlinePasswordChoiceDto;
import com.globits.richy.dto.BattleOnlinePasswordGuessDto;
import com.globits.richy.dto.BattleOnlinePasswordGuessResultDto;
import com.globits.richy.dto.BattleOnlineRoomDto;
import com.globits.richy.dto.BattleOnlineRoomSettingsDto;
import com.globits.richy.dto.BattleOnlineTeamAssignmentDto;
import com.globits.richy.dto.BattleOnlineUseSkillDto;

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

    BattleOnlineRoomDto setSpectator(
            String roomCode,
            String username,
            boolean spectator
    );

    BattleOnlineRoomDto kickPlayer(
            String roomCode,
            String username,
            String targetUsername
    );

    BattleOnlineRoomDto assignPlayerTeam(
            String roomCode,
            String username,
            BattleOnlineTeamAssignmentDto teamDto
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

    BattleOnlineRoomDto useSkill(
            String roomCode,
            String username,
            BattleOnlineUseSkillDto skillDto
    );

    BattleOnlineRoomDto choosePassword(
            String roomCode,
            String username,
            BattleOnlinePasswordChoiceDto passwordDto
    );

    BattleOnlinePasswordGuessResultDto guessPassword(
            String roomCode,
            String username,
            BattleOnlinePasswordGuessDto passwordDto
    );
}
