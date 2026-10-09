package com.globits.richy.question;

import com.globits.richy.domain.Answer;
import com.globits.richy.domain.Question;
import com.globits.richy.domain.QuestionAnswer;
import com.globits.richy.domain.QuestionAnswerTestResult;
import com.globits.richy.dto.QuestionAnswerTestResultDto;
import com.globits.richy.dto.QuestionDto;
import com.globits.richy.service.impl.QuestionServiceImpl;
import java.util.Collections;
import org.junit.Test;
import static org.junit.Assert.*;

public class ComprehensiveListeningValidationTest {
    @Test public void acceptsAudioAndYoutubeAndRejectsInvalidSchemes() {
        for (String link : new String[]{"https://school.test/audio.mp3", "https://school.test/media/42", "https://youtu.be/M7lc1UVf-VE?t=90"}) {
            assertTrue(link, ComprehensiveListeningValidation.isSupportedUrl(link));
        }
        for (String link : new String[]{"file:///audio.mp3", "javascript:alert(1)", "https://user:pass@school.test/audio.mp3", "https://youtu.be/no-id", "https://www.tiktok.com/@person/video/6718335390845095173"}) {
            assertFalse(link, ComprehensiveListeningValidation.isSupportedUrl(link));
        }
    }

    @Test public void publishedTestsNeedAudioTranscriptAndExactlyOneQuestionPerGap() {
        QuestionDto root = new QuestionDto(), pack = new QuestionDto(), question = new QuestionDto();
        root.setTestFormat("COMPREHENSIVE"); root.setStatus(6); pack.setType(18);
        root.setSubQuestions(Collections.singletonList(pack));
        assertNull(ComprehensiveListeningValidation.validate(root));
        root.setStatus(7); assertNotNull(ComprehensiveListeningValidation.validate(root));
        pack.setPronounce("https://school.test/audio.mp3"); pack.setMotherTongue("We learn daily.");
        assertNotNull(ComprehensiveListeningValidation.validate(root));
        pack.setSubQuestions(Collections.singletonList(question)); question.setQuestion("We }{SPACE}{ daily.");
        assertNull(ComprehensiveListeningValidation.validate(root));
        question.setQuestion("We }{SPACE}{ }{SPACE}{.");
        assertNotNull(ComprehensiveListeningValidation.validate(root));
    }

    @Test public void listeningAnswersAreGradedAsTextEvenWhenTheConfiguredAnswerIsCorrect() {
        Question group = new Question(); group.setType(18);
        Question question = new Question(); question.setParent(group);
        Answer text = new Answer(); text.setAnswer("learn / study");
        QuestionAnswer answer = new QuestionAnswer(); answer.setQuestion(question); answer.setAnswer(text); answer.setCorrect(true);
        question.setQuestionAnswers(Collections.singleton(answer));
        QuestionAnswerTestResult result = new QuestionAnswerTestResult(); result.setQuestionAnswer(answer);
        result.setClientAnswer(" LEARN "); assertTrue(new QuestionAnswerTestResultDto(result).getIsCorrectTestResultDetail());
        result.setClientAnswer("study"); assertTrue(new QuestionAnswerTestResultDto(result).getIsCorrectTestResultDetail());
        result.setClientAnswer("wrong"); assertFalse(new QuestionAnswerTestResultDto(result).getIsCorrectTestResultDetail());
        result.setClientAnswer(""); assertFalse(new QuestionAnswerTestResultDto(result).getIsCorrectTestResultDetail());
        group.setType(11); result.setClientAnswer("learn"); assertTrue(new QuestionAnswerTestResultDto(result).getIsCorrectTestResultDetail());
    }

    @Test public void nestedSaveAndReloadPreserveTranscriptAudioAndAuthoringSettings() {
        QuestionDto root = new QuestionDto(), pack = new QuestionDto();
        pack.setType(18); pack.setQuestion("Daily Listening"); pack.setOrdinalNumber(1);
        pack.setMotherTongue("Alice visits London, then buys tickets.");
        pack.setPronounce("https://school.test/audio.mp3"); pack.setDescription("{\"gapRate\":50}");
        root.setSubQuestions(Collections.singletonList(pack));
        Question stored = new Question();
        new QuestionServiceImpl().setListSubQuestions(root, stored, org.joda.time.LocalDateTime.now(), "teacher");
        QuestionDto reloaded = new QuestionDto(stored).getSubQuestions().get(0);
        assertEquals(pack.getMotherTongue(), reloaded.getMotherTongue());
        assertEquals(pack.getPronounce(), reloaded.getPronounce());
        assertEquals(pack.getDescription(), reloaded.getDescription());
        assertEquals(18, reloaded.getType());
    }
}
