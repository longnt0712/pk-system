package com.globits.richy.question;

import com.globits.richy.domain.*;
import com.globits.richy.dto.VocabularyDuplicateDto;
import com.globits.richy.service.impl.VocabularyDuplicateService;
import com.globits.security.domain.User;
import java.util.*;
import javax.persistence.EntityManager;
import org.junit.Before;
import org.junit.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;

/** Real FK, orphanRemoval and JPQL checks using the existing Hibernate vocabulary fixture. */
public class VocabularyDuplicatePersistenceTest extends VocabularyWorkspacePersistenceTest {
    private EntityManager db;
    private VocabularyDuplicateService duplicates;

    @Before public void duplicateFixture() {
        db = (EntityManager) ReflectionTestUtils.getField(this, "manager");
        duplicates = new VocabularyDuplicateService(); ReflectionTestUtils.setField(duplicates, "manager", db);
    }
    private User owner() { return (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal(); }
    private Topic lesson(String name) { Topic topic = new Topic(); topic.setName(name); topic.setUser(owner()); db.persist(topic); return topic; }
    private Question card(String text, String meaning, Topic lesson) {
        Question word = new Question(); word.setQuestion(text); word.setMotherTongue(meaning); word.setUser(owner());
        word.setQuestionType(db.find(QuestionType.class, 6L)); word.setStatus(1); db.persist(word);
        if (lesson != null) { link(word, lesson); }
        return word;
    }
    private QuestionTopic link(Question word, Topic lesson) {
        QuestionTopic link = new QuestionTopic(); link.setQuestion(word); link.setTopic(lesson); db.persist(link); return link;
    }
    private VocabularyDuplicateDto.Merge request(Long primary, String meaning, Long... ids) {
        db.flush(); db.clear();
        VocabularyDuplicateDto.Merge request = new VocabularyDuplicateDto.Merge(); request.setPrimaryId(primary); request.setMeaning(meaning);
        for (VocabularyDuplicateDto.Card card : duplicates.details(Arrays.asList(ids))) {
            VocabularyDuplicateDto.Source source = new VocabularyDuplicateDto.Source(); source.setId(card.getId()); source.setFingerprint(card.getFingerprint());
            request.getSources().add(source);
        }
        return request;
    }

    @Test public void duplicateGroupsUseTheWholePhraseAndOnlyTheCurrentOwner() {
        Question first = card("minimal", "one", null), second = card(" MINIMAL ", "two", null);
        card("minimal security", "different phrase", null); card("unrelated", "minimal", null);
        Question foreign = card("minimal", "foreign", null); foreign.setUser(db.createQuery("from User u where u.id <> :owner", User.class).setParameter("owner", owner().getId()).getResultList().get(0));
        db.flush(); db.clear();
        List<VocabularyDuplicateDto.Group> groups = duplicates.groups();
        assertEquals(1, groups.size()); assertEquals(Arrays.asList(first.getId(), second.getId()), groups.get(0).getIds());
        assertEquals(2, duplicates.details(groups.get(0).getIds()).size());
        try { duplicates.details(Arrays.asList(first.getId(), foreign.getId())); fail("Foreign card must be rejected"); }
        catch (AccessDeniedException expected) { }
    }

    @Test public void selectedMergeKeepsThePrimaryIdAndUnionOfTopicsWithoutDeletingSavedAnswerLinks() {
        Topic shared = lesson("Shared"), extra = lesson("Extra");
        Question primary = card("minimal", "tối thiểu", shared), source = card("minimal", "rất ít", extra);
        Question unselected = card("minimal", "not selected", null); link(source, shared);
        primary.setPronounce("/primary/"); primary.setLevel("B2"); primary.setDescription("Primary description");
        primary.setCorrectAnswer(2); primary.setWrongAnswer(1); primary.setTimeReviewd(3);
        source.setPronounce("/source/"); source.setLevel("C1"); source.setCorrectAnswer(5); source.setWrongAnswer(2); source.setTimeReviewd(7);
        Long primaryLinkId = db.createQuery("select l.id from QuestionTopic l where l.question.id = :word", Long.class).setParameter("word", primary.getId()).getSingleResult();
        Answer answer = new Answer(); answer.setAnswer("saved answer"); db.persist(answer);
        QuestionAnswer qa = new QuestionAnswer(); qa.setQuestion(source); qa.setAnswer(answer); db.persist(qa);
        TestResult result = new TestResult(); db.persist(result);
        QuestionAnswerTestResult saved = new QuestionAnswerTestResult(); saved.setQuestionAnswer(qa); saved.setTestResult(result); saved.setClientAnswer("original answer"); db.persist(saved);
        Category category = new Category(); category.setName("Existing category"); db.persist(category);
        for (Question word : Arrays.asList(primary, source)) { CategoryQuestion categoryLink = new CategoryQuestion(); categoryLink.setCategory(category); categoryLink.setQuestion(word); db.persist(categoryLink); }
        VocabularyDuplicateDto.Result merged = duplicates.merge(request(primary.getId(), "tối thiểu / rất ít", primary.getId(), source.getId()));
        assertEquals(primary.getId(), merged.getCard().getId()); assertEquals(1, merged.getMergedCount());
        assertEquals("tối thiểu / rất ít", merged.getCard().getMotherTongue());
        assertEquals("/primary/", merged.getCard().getPronounce()); assertEquals("B2", merged.getCard().getLevel());
        assertEquals("Primary description", merged.getCard().getDescription());
        assertEquals(7, merged.getCard().getCorrectAnswer()); assertEquals(3, merged.getCard().getWrongAnswer()); assertEquals(10, merged.getCard().getTimeReviewd());
        assertEquals(2, merged.getCard().getQuestionTopics().size()); assertNull(db.find(Question.class, source.getId()));
        assertEquals("not selected", db.find(Question.class, unselected.getId()).getMotherTongue());
        assertEquals(primary.getId(), db.find(QuestionTopic.class, primaryLinkId).getQuestion().getId());
        assertEquals(primary.getId(), db.find(QuestionAnswer.class, qa.getId()).getQuestion().getId());
        assertEquals(qa.getId(), db.find(QuestionAnswerTestResult.class, saved.getId()).getQuestionAnswer().getId());
        assertEquals("original answer", db.find(QuestionAnswerTestResult.class, saved.getId()).getClientAnswer());
        assertNotNull(db.find(TestResult.class, result.getId()));
        assertEquals(Long.valueOf(1), db.createQuery("select count(l.id) from CategoryQuestion l where l.question.id = :word", Long.class).setParameter("word", primary.getId()).getSingleResult());
    }

    @Test public void defaultMeaningJoinsDistinctNonemptyMeaningsUsingSlash() {
        Question a = card("minimal", "tối thiểu", null), b = card("minimal", " tối thiểu ", null), c = card("minimal", "rất ít", null);
        VocabularyDuplicateDto.Result result = duplicates.merge(request(a.getId(), null, a.getId(), b.getId(), c.getId()));
        assertEquals("tối thiểu / rất ít", result.getCard().getMotherTongue()); assertEquals(2, result.getMergedCount());
        assertTrue(duplicates.groups().isEmpty());
    }

    @Test public void staleWordOrTopicChangesAndInvalidMeaningDoNotDeleteAnything() {
        Question a = card("minimal", "one", null), b = card("minimal", "two", null);
        VocabularyDuplicateDto.Merge stale = request(a.getId(), "one / two", a.getId(), b.getId());
        db.find(Question.class, b.getId()).setMotherTongue("edited elsewhere"); db.flush();
        try { duplicates.merge(stale); fail("Stale changes must be rejected"); } catch (IllegalStateException expected) { }
        assertNotNull(db.find(Question.class, b.getId())); assertEquals("one", db.find(Question.class, a.getId()).getMotherTongue());
        VocabularyDuplicateDto.Merge longMeaning = request(a.getId(), String.join("", Collections.nCopies(501, "x")), a.getId(), b.getId());
        try { duplicates.merge(longMeaning); fail("Long meaning must be rejected"); } catch (IllegalArgumentException expected) { }
        assertNotNull(db.find(Question.class, b.getId()));
        VocabularyDuplicateDto.Merge staleTopic = request(a.getId(), "one / two", a.getId(), b.getId());
        link(db.find(Question.class, b.getId()), lesson("Added after preview")); db.flush(); db.clear();
        try { duplicates.merge(staleTopic); fail("New topic must require another review"); } catch (IllegalStateException expected) { }
        assertNotNull(db.find(Question.class, b.getId()));
    }

    @Test public void wordsUsedAsTestRootsAreNotMergedAndRepeatedSubmissionCannotDeleteAnotherCard() {
        Question a = card("minimal", "one", null), b = card("minimal", "two", null);
        TestResult test = new TestResult(); test.setSourceQuestionId(b.getId()); db.persist(test);
        VocabularyDuplicateDto.Merge blocked = request(a.getId(), "one / two", a.getId(), b.getId());
        try { duplicates.merge(blocked); fail("A test root must remain intact"); } catch (IllegalArgumentException expected) { }
        assertNotNull(db.find(Question.class, b.getId()));
        db.remove(db.find(TestResult.class, test.getId())); db.flush();
        VocabularyDuplicateDto.Merge first = request(a.getId(), "one / two", a.getId(), b.getId()); duplicates.merge(first);
        Question unrelated = card("minimal", "later duplicate", null); db.flush();
        try { duplicates.merge(first); fail("A repeated request must not delete a later card"); } catch (IllegalStateException expected) { }
        assertNotNull(db.find(Question.class, unrelated.getId()));
    }

    @Test public void tamperedSelectionCannotMergeAnotherOwnersWordOrAnUnrelatedPhrase() {
        Question a = card("minimal", "one", null), b = card("minimal", "two", null);
        Question foreign = card("minimal", "foreign", null), different = card("minimal security", "different", null);
        foreign.setUser(db.createQuery("from User u where u.id <> :owner", User.class).setParameter("owner", owner().getId()).getResultList().get(0));
        VocabularyDuplicateDto.Merge selection = request(a.getId(), "one / two", a.getId(), b.getId());
        selection.getSources().get(1).setId(foreign.getId());
        try { duplicates.merge(selection); fail("Foreign source must be rejected before writing"); } catch (AccessDeniedException expected) { }
        selection.getSources().get(1).setId(different.getId());
        try { duplicates.merge(selection); fail("Different whole phrase must not merge"); } catch (IllegalArgumentException expected) { }
        selection.getSources().get(1).setId(b.getId()); selection.setPrimaryId(foreign.getId());
        try { duplicates.merge(selection); fail("Primary must be selected and owned"); } catch (IllegalArgumentException expected) { }
        selection.setPrimaryId(a.getId()); selection.getSources().get(1).setId(a.getId());
        try { duplicates.merge(selection); fail("Repeated source IDs must not count as two cards"); } catch (IllegalArgumentException expected) { }
        for (Question word : Arrays.asList(a, b, foreign, different)) { assertNotNull(db.find(Question.class, word.getId())); }
        assertEquals("one", db.find(Question.class, a.getId()).getMotherTongue());
        assertEquals("two", db.find(Question.class, b.getId()).getMotherTongue());
    }

    @Test public void largeTopicUnionIsTransferredInBatchesAndViewerCannotMerge() {
        Question a = card("minimal", "one", lesson("Primary")), b = card("minimal", "two", null);
        for (int index = 0; index < 405; index++) { link(b, lesson("Topic " + index)); }
        VocabularyDuplicateDto.Merge request = request(a.getId(), "one / two", a.getId(), b.getId());
        assertEquals(406, duplicates.merge(request).getCard().getQuestionTopics().size());
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(owner(), "",
                Collections.singletonList(new SimpleGrantedAuthority("ROLE_VIEWER"))));
        try { duplicates.groups(); fail("Read-only role must not manage merges"); } catch (AccessDeniedException expected) { }
    }
}
