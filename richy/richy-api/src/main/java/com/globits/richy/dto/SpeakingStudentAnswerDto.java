package com.globits.richy.dto;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

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
    public static class RestoreRequest {
        public Long setId,studentId,questionId,versionId,revision,versionRevision;
    }
    public static class NotebookRequest {
        public Long setId,studentId,questionId,revision;
        public Map<String,Object> document;
    }
}
