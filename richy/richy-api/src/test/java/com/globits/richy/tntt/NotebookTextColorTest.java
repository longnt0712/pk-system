package com.globits.richy.tntt;

import static org.junit.Assert.*;
import com.globits.richy.service.impl.SpeakingStudentAnswerService;
import com.globits.richy.service.impl.TnttDocumentPayload;
import java.util.*;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;

public class NotebookTextColorTest {
    @Test public void textColorIsOptionalAndRoundTripsInBothNotebookValidators() {
        Map<String,Object> legacy=TnttDocumentPayload.blank();
        assertEquals(legacy,TnttDocumentPayload.decode(TnttDocumentPayload.validate(legacy)));
        assertEquals(legacy,speaking(legacy));
        for(String color:Arrays.asList("#123abc","#FF0000","#ffffff")) {
            Map<String,Object> paper=new LinkedHashMap<>(legacy);paper.put("textColor",color);paper.put("text","Chữ có màu");
            assertEquals(paper,TnttDocumentPayload.decode(TnttDocumentPayload.validate(paper)));
            assertEquals(paper,speaking(paper));
        }
    }
    @Test public void invalidCssCannotEnterTextColor() {
        for(Object color:Arrays.asList(null,12,"red","#123","#123456;display:none","url(https://example.com)","#GGGGGG")) {
            Map<String,Object> paper=TnttDocumentPayload.blank();paper.put("textColor",color);
            try {TnttDocumentPayload.validate(paper);fail("TNTT accepted invalid color");} catch(IllegalArgumentException expected) {}
            try {speaking(paper);fail("Speaking accepted invalid color");} catch(IllegalArgumentException expected) {}
        }
    }
    @SuppressWarnings("unchecked") private Map<String,Object> speaking(Map<String,Object> paper) {
        return (Map<String,Object>)ReflectionTestUtils.invokeMethod(new SpeakingStudentAnswerService(),"validateDocument",paper);
    }
}
