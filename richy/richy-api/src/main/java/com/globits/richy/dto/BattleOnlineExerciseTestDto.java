package com.globits.richy.dto;

import java.io.Serializable;

/** Only the fields required to choose a test, never its question tree or answers. */
public class BattleOnlineExerciseTestDto implements Serializable {
    private static final long serialVersionUID = 1L;
    private final Long id;
    private final String title;
    private final boolean findMistakes;
    public BattleOnlineExerciseTestDto(Long id, String title) { this(id, title, 0L); }
    public BattleOnlineExerciseTestDto(Long id, String title, Long mistakeGroups) {
        this.id = id; this.title = title; this.findMistakes = mistakeGroups != null && mistakeGroups > 0;
    }
    public Long getId() { return id; }
    public String getTitle() { return title; }
    public boolean isFindMistakes() { return findMistakes; }
}
