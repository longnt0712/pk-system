package com.globits.richy.dto;

import java.util.ArrayList;
import java.util.List;

public class SpeakingStudentAnswerDto {
    public static class Note {
        public String id;
        public String text;
        public Note(){}
        public Note(String id,String text){this.id=id;this.text=text;}
    }
    public static class WriteRequest {
        public Long setId;
        public Long studentId;
        public Long questionId;
        public String html;
        public List<Note> notes=new ArrayList<Note>();
        /** 0 means no saved response; persisted versions are exposed as 1, 2, ... */
        public Long revision;
    }
    public static class ImportRequest {
        public Long setId;
        public Long studentId;
        public List<WriteRequest> rows=new ArrayList<WriteRequest>();
    }
}
