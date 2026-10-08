package com.globits.richy.question;

import com.globits.richy.dto.QuestionDto;
import java.util.Collections;
import org.junit.Test;
import static org.junit.Assert.*;

public class ComprehensiveVideoValidationTest {
    @Test public void answerWindowIsOptionalForOldQuestionsAndValidatesNestedValues() {
        QuestionDto root=new QuestionDto(), child=new QuestionDto(); root.setSubQuestions(Collections.singletonList(child));
        assertNull(ComprehensiveVideoValidation.validate(root));
        child.setVideoAnswerSeconds(20); assertNull(ComprehensiveVideoValidation.validate(root));
        child.setVideoAnswerSeconds(35); assertNull(ComprehensiveVideoValidation.validate(root));
        child.setVideoAnswerSeconds(0); assertNotNull(ComprehensiveVideoValidation.validate(root));
        child.setVideoAnswerSeconds(3601); assertNotNull(ComprehensiveVideoValidation.validate(root));
    }
    @Test public void acceptsSupportedLinksAndRejectsOtherHostsAndSchemes() {
        String[] supported = {"https://youtu.be/M7lc1UVf-VE?t=90", "https://www.youtube.com/watch?v=M7lc1UVf-VE&t=90s",
            "https://youtube.com/shorts/M7lc1UVf-VE", "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE",
            "https://www.tiktok.com/@scout2015/video/6718335390845095173", "https://cdn.example.test/video.MP4?token=abc"};
        for (String url : supported) { assertTrue(url, ComprehensiveVideoValidation.isSupportedUrl(url)); }
        String[] invalid = {"javascript:alert(1)", "file:///video.mp4", "https://user:pass@youtube.com/watch?v=M7lc1UVf-VE",
            "https://youtube.com.evil.test/watch?v=M7lc1UVf-VE", "https://youtu.be/no-id", "https://vt.tiktok.com/short/"};
        for (String url : invalid) { assertFalse(url, ComprehensiveVideoValidation.isSupportedUrl(url)); }
    }
    @Test public void validatesNestedCuesWithoutRejectingExistingTests() {
        QuestionDto root = new QuestionDto(), child = new QuestionDto();
        root.setSubQuestions(Collections.singletonList(child));
        assertNull(ComprehensiveVideoValidation.validate(root));
        child.setVideoTimeSeconds(0); assertNull(ComprehensiveVideoValidation.validate(root));
        child.setVideoTimeSeconds(90); assertNull(ComprehensiveVideoValidation.validate(root));
        child.setVideoTimeSeconds(-1); assertNotNull(ComprehensiveVideoValidation.validate(root));
        child.setVideoTimeSeconds(360000); assertNotNull(ComprehensiveVideoValidation.validate(root));
        child.setVideoTimeSeconds(90); child.setVideoUrl("https://example.test/unembeddable");
        assertNotNull(ComprehensiveVideoValidation.validate(root));
    }
    @Test public void publishedVideoTestsRequireCuesButDraftsMayBeIncomplete() {
        QuestionDto root = new QuestionDto(), passage = new QuestionDto(), pack = new QuestionDto(), cue = new QuestionDto();
        root.setTestFormat("COMPREHENSIVE"); root.setStatus(6);
        passage.setVideoUrl("https://youtu.be/M7lc1UVf-VE"); pack.setType(1);
        pack.setSubQuestions(Collections.singletonList(cue)); passage.setSubQuestions(Collections.singletonList(pack));
        root.setSubQuestions(Collections.singletonList(passage));
        assertNull(ComprehensiveVideoValidation.validate(root));
        root.setStatus(7); assertNotNull(ComprehensiveVideoValidation.validate(root));
        cue.setVideoTimeSeconds(90); assertNull(ComprehensiveVideoValidation.validate(root));
        pack.setType(11); assertNotNull(ComprehensiveVideoValidation.validate(root));
        pack.setVideoTimeSeconds(120); assertNull(ComprehensiveVideoValidation.validate(root));
    }
}
