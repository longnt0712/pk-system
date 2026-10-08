package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/** Public exercise content. Correct answers are held only by the game server. */
public class BattleOnlineExerciseDto implements Serializable {
    private static final long serialVersionUID = 1L;
    public int type;
    public String answerMode;
    public String title;
    public String passageHtml;
    public String instructionsHtml;
    public String contentHtml;
    public int minimumWords;
    public String videoUrl;
    public String videoSourceId;
    public Integer videoTimeSeconds;
    public int videoAnswerSeconds = 20;
    public List<Item> items = new ArrayList<Item>();

    public static class Item implements Serializable {
        private static final long serialVersionUID = 1L;
        public String id;
        public Integer number;
        public Integer numberEnd;
        public Integer gapIndex;
        public String promptHtml;
        public List<Option> options = new ArrayList<Option>();
    }

    public static class Option extends BattleOnlineAnswerOptionDto {
        private static final long serialVersionUID = 1L;
        public String html;
        public Option(String key, String text, String html) {
            super(key, text); this.html = html;
        }
    }
}
