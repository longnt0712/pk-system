package com.globits.richy.dto;

/** Battle folder browsing is direct unless recursion is explicitly requested. */
public class BattleOnlineExerciseTestFilterDto extends QuestionDto {
    private static final long serialVersionUID = 1L;
    public BattleOnlineExerciseTestFilterDto() { setIncludeSubfolders(false); }
}
