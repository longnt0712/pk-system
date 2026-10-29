package com.globits.richy.dto;

import java.util.ArrayList;
import java.util.List;

/** Requests contain no owner fields: ownership is always taken from authentication. */
public final class SpeakingDto {
    private SpeakingDto() {}
    public static class SetRequest {
        public Integer year;
        public Integer number;
        public List<Long> classIds = new ArrayList<Long>();
        public List<Long> studentIds = new ArrayList<Long>();
    }
    public static class ImportRow {
        public String rowId;
        public int part;
        public String topic;
        public String prompt;
        public String sample;
        public String code;
        public String linkedPart2;
        public String note;
        public String error;
    }
    public static class ImportChoice {
        public String rowId;
        public String action;
    }
    public static class ConfirmImport {
        public String token;
        public List<ImportChoice> choices = new ArrayList<ImportChoice>();
    }
    public static class PassRequest {
        public Long studentId;
        public List<Long> questionIds = new ArrayList<Long>();
        public Boolean passed;
        public String note;
    }
    public static class PracticeRequest {
        public String clientKey;
        public List<Long> setIds = new ArrayList<Long>();
        public List<Integer> parts = new ArrayList<Integer>();
        public Integer part1Count = 5;
        public Integer part3Count = 4;
        public Boolean onlyUnpassed = false;
    }
    public static class PracticeProgress {
        public Integer currentIndex;
        public Long elapsedSeconds;
        public Boolean finished;
    }
    public static class RecordingRequest {
        public String uploadKey;
        public String contentType;
        public Integer questionIndex;
    }
    public static class RecordingFinish {
        public Integer chunkCount;
    }
}
