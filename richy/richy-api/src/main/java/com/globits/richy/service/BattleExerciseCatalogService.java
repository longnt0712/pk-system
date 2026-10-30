package com.globits.richy.service;

import com.globits.richy.dto.BattleOnlineExerciseTestDto;
import com.globits.richy.dto.QuestionDto;
import org.springframework.data.domain.Page;

public interface BattleExerciseCatalogService {
    Page<BattleOnlineExerciseTestDto> search(QuestionDto filters, int pageIndex, int pageSize);
}
