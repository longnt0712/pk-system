package com.globits.richy.dto;

import java.util.ArrayList;
import java.util.List;

/** Deliberately excludes accounts, QR credentials and contact information. */
public class CampaignFieldDto {
    public CampaignDto campaign;
    public long serverTime;
    public String nextCursor;
    public boolean hasMore;
    public List<Garden> gardens = new ArrayList<>();

    public static class Garden {
        public Long id;
        public String saintName;
        public String fullName;
        public long completedCount;
        public List<String> classes = new ArrayList<>();
        public List<Color> colors = new ArrayList<>();
    }
    public static class Color {
        public String date;
        public String itemKey;
        public String paintColor;
    }
    public static class ClassOption {
        public Long id;
        public String name;
    }
}
