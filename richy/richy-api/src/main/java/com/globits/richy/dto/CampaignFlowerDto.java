package com.globits.richy.dto;
import java.util.ArrayList;
import java.util.List;
/** Minimal student identity and the student's own sheet; no account or family data. */
public class CampaignFlowerDto {
    public static class Student {
        public String studentCode;
        public String saintName;
        public String fullName;
        public List<String> classes = new ArrayList<>();
    }
    public static class Access {
        public String token;
        public Student student;
    }
    public static class Landing {
        public long serverTime;
        public Student student;
        public List<CampaignDto> campaigns = new ArrayList<>();
    }
    public static class Entry {
        public String date;
        public String itemKey;
        public Boolean completed;
    }
    public static class Sheet {
        public long serverTime;
        public Student student;
        public CampaignDto campaign;
        public List<Entry> entries = new ArrayList<>();
    }
    public static class AccessRequest { public String studentCode; }
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
    public static class CheckRequest { public Boolean completed; }
}
