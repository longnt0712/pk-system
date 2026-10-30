package com.globits.richy.dto;

import java.io.Serializable;

/** Only the fields required to choose a test, never its question tree or answers. */
public class BattleOnlineExerciseTestDto implements Serializable {
    private static final long serialVersionUID = 1L;
    private final Long id;
    private final String title;
    public BattleOnlineExerciseTestDto(Long id, String title) { this.id = id; this.title = title; }
    public Long getId() { return id; }
    public String getTitle() { return title; }
}
