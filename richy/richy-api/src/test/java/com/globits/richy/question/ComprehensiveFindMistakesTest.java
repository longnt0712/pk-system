package com.globits.richy.question;

import com.globits.richy.domain.Answer;
import com.globits.richy.domain.Question;
import com.globits.richy.domain.QuestionAnswer;
import com.globits.richy.domain.QuestionAnswerTestResult;
import com.globits.richy.dto.QuestionAnswerTestResultDto;
import com.globits.richy.dto.QuestionDto;
import com.globits.richy.repository.QuestionAnswerRepository;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.Test;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;

import javax.persistence.Entity;
import javax.persistence.EntityManager;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

import static org.junit.Assert.*;

public class ComprehensiveFindMistakesTest {
    @Test
    public void loadsOnlyTheRequestedPublishedTestsMistakeSlots() throws ClassNotFoundException {
        Configuration configuration = new Configuration()
                .setProperty("hibernate.connection.url", "jdbc:h2:mem:study_mistakes;MODE=MSSQLServer")
                .setProperty("hibernate.dialect", "org.hibernate.dialect.H2Dialect")
                .setProperty("hibernate.hbm2ddl.auto", "create-drop");
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));
        for (String base : Arrays.asList("com.globits.richy", "com.globits.core", "com.globits.security")) {
            for (BeanDefinition entity : scanner.findCandidateComponents(base)) {
                configuration.addAnnotatedClass(Class.forName(entity.getBeanClassName()));
            }
        }

        try (SessionFactory factory = configuration.buildSessionFactory()) {
            EntityManager db = factory.createEntityManager();
            try {
                db.getTransaction().begin();
                QuestionAnswer published = saveMistakeSlot(db, 7);
                QuestionAnswer other = saveMistakeSlot(db, 7);
                QuestionAnswer draft = saveMistakeSlot(db, 6);
                Long testId = published.getQuestion().getParent().getParent().getParent().getId();
                Long draftId = draft.getQuestion().getParent().getParent().getParent().getId();
                db.flush();
                db.clear();

                QuestionAnswerRepository repository = new JpaRepositoryFactory(db).getRepository(QuestionAnswerRepository.class);
                assertEquals(published.getId(), repository.findStudyMistakeSlots(testId,
                        Arrays.asList(published.getId(), other.getId(), draft.getId())).get(0).getId());
                assertTrue(repository.findStudyMistakeSlots(testId, Collections.singletonList(other.getId())).isEmpty());
                assertTrue(repository.findStudyMistakeSlots(draftId, Collections.singletonList(draft.getId())).isEmpty());
            } finally {
                if (db.getTransaction().isActive()) { db.getTransaction().rollback(); }
                db.close();
            }
        }
    }

    private QuestionAnswer saveMistakeSlot(EntityManager db, int status) {
        Question test = new Question();
        test.setStatus(status);
        test.setTestFormat("COMPREHENSIVE");
        db.persist(test);
        Question passage = new Question();
        passage.setParent(test);
        db.persist(passage);
        Question pack = new Question();
        pack.setParent(passage);
        pack.setType(ComprehensiveFindMistakes.TYPE);
        pack.setMotherTongue("She [[go]] home.");
        db.persist(pack);
        QuestionAnswer slot = row(pack, 1, "1|went", "").getQuestionAnswer();
        slot.setId(null);
        db.persist(slot.getQuestion());
        db.persist(slot.getAnswer());
        db.persist(slot);
        return slot;
    }

    @Test
    public void previewsCurrentCorrectionsByPositionWithoutSavingAnAttempt() {
        Question pack = new Question();
        pack.setType(ComprehensiveFindMistakes.TYPE);
        pack.setMotherTongue("She [[go]] home and [[buy]] [[two loafs]].");
        QuestionAnswer first = row(pack, 1, "1|went", "").getQuestionAnswer();
        QuestionAnswer second = row(pack, 2, "2|bought", "").getQuestionAnswer();
        QuestionAnswer third = row(pack, 3, "3|two loaves", "").getQuestionAnswer();
        Map<Long, String> submissions = new HashMap<>();
        submissions.put(1L, "3|two   loaves");
        submissions.put(2L, "1|goes");
        submissions.put(3L, "");

        Map<Long, ComprehensiveFindMistakes.StudyReview> review = ComprehensiveFindMistakes.review(
                Arrays.asList(third, first, second), submissions);

        assertEquals("go → goes", review.get(1L).getSubmitted());
        assertEquals("go → went", review.get(1L).getExpected());
        assertFalse(review.get(1L).isCorrect());
        assertEquals("", review.get(2L).getSubmitted());
        assertEquals("buy → bought", review.get(2L).getExpected());
        assertTrue(review.get(3L).isCorrect());
        assertEquals("3|two   loaves", submissions.get(1L));
    }

    @Test
    public void alignsOutOfOrderSelectionsAndKeepsBothCorrectAndIncorrectResponsesForReview() {
        Question pack = new Question();
        pack.setType(ComprehensiveFindMistakes.TYPE);
        pack.setMotherTongue("[[Yesterday]], she [[go]] to school and [[buy]] [[two loafs of bread]]. She [[run into]] Ana.");
        QuestionAnswerTestResult first = row(pack, 1, "2|went", "5|ran into");
        QuestionAnswerTestResult second = row(pack, 2, "3|bought", "4|two   loaves of bread");
        QuestionAnswerTestResult third = row(pack, 3, "4|two loaves of bread", "1|Tomorrow");
        QuestionAnswerTestResult fourth = row(pack, 4, "5|ran into", "2|goes");

        ComprehensiveFindMistakes.alignResponses(Arrays.asList(fourth, second, first, third));

        QuestionAnswerTestResultDto firstResult = new QuestionAnswerTestResultDto(first);
        assertFalse(firstResult.getIsCorrectTestResultDetail());
        assertEquals("go → goes", firstResult.getFindMistakeSubmitted());
        assertEquals("go → went", firstResult.getFindMistakeExpected());
        assertFalse(new QuestionAnswerTestResultDto(second).getIsCorrectTestResultDetail());
        assertEquals("Yesterday → Tomorrow", new QuestionAnswerTestResultDto(second).getFindMistakeSubmitted());
        assertTrue(new QuestionAnswerTestResultDto(third).getIsCorrectTestResultDetail());
        assertTrue(new QuestionAnswerTestResultDto(fourth).getIsCorrectTestResultDetail());
    }

    @Test
    public void gradesRepeatedTextByPositionAndHidesTheAnswerKeyFromStudentQuestionDto() {
        Question pack = new Question();
        pack.setType(ComprehensiveFindMistakes.TYPE);
        pack.setMotherTongue("They [[read]] today. She [[read]] every day.");
        QuestionAnswerTestResult result = row(pack, 1, "2|reads", "1|reads");
        ComprehensiveFindMistakes.alignResponses(Collections.singletonList(result));
        assertFalse(new QuestionAnswerTestResultDto(result).getIsCorrectTestResultDetail());
        assertNull(new QuestionDto(result.getQuestionAnswer().getQuestion()).getQuestionAnswers().get(0).getAnswer());

        result.setClientAnswer("2|reads");
        assertTrue(new QuestionAnswerTestResultDto(result).getIsCorrectTestResultDetail());
        result.setClientAnswer("2|Reads");
        assertFalse(new QuestionAnswerTestResultDto(result).getIsCorrectTestResultDetail());
    }

    private QuestionAnswerTestResult row(Question pack, int ordinal, String expected, String submitted) {
        Question question = new Question();
        question.setParent(pack);
        question.setOrdinalNumber(ordinal);

        Answer answer = new Answer();
        answer.setAnswer(expected);
        QuestionAnswer slot = new QuestionAnswer();
        slot.setId(Long.valueOf(ordinal));
        slot.setQuestion(question);
        slot.setAnswer(answer);
        slot.setOrdinalNumber(1);
        slot.setCorrect(true);
        question.setQuestionAnswers(Collections.singleton(slot));

        QuestionAnswerTestResult result = new QuestionAnswerTestResult();
        result.setQuestionAnswer(slot);
        result.setOrdinalNumber(ordinal);
        result.setClientAnswer(submitted);
        return result;
    }
}
