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
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.SharedEntityManagerCreator;
import org.springframework.transaction.interceptor.DefaultTransactionAttribute;
import org.springframework.transaction.interceptor.NameMatchTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
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

    @Test public void defaultMeaningKeepsOneDefinitionFromThePrimary() {
        Question a = card("minimal", "tối thiểu", null), b = card("minimal", " tối thiểu ", null), c = card("minimal", "rất ít", null);
        VocabularyDuplicateDto.Result result = duplicates.merge(request(a.getId(), null, a.getId(), b.getId(), c.getId()));
        assertEquals("tối thiểu", result.getCard().getMotherTongue()); assertEquals(2, result.getMergedCount());
        assertTrue(duplicates.groups().isEmpty());
    }

    private VocabularyDuplicateDto.Review review(boolean value, Long... ids) {
        db.flush(); db.clear();
        VocabularyDuplicateDto.Review request = new VocabularyDuplicateDto.Review(); request.setReviewed(value);
        for (VocabularyDuplicateDto.Card card : duplicates.details(Arrays.asList(ids))) {
            VocabularyDuplicateDto.Source source = new VocabularyDuplicateDto.Source(); source.setId(card.getId()); source.setFingerprint(card.getFingerprint());
            request.getSources().add(source);
        }
        return request;
    }

    @Test public void mergeDoesNotCheckAnUnseenNewDuplicateInTheSameWordGroup() {
        Question a = card("new import", "one", null), b = card("new import", "two", null);
        VocabularyDuplicateDto.Merge pending = request(a.getId(), "kept", a.getId(),b.getId());
        pending.setGroupIds(Arrays.asList(a.getId(),b.getId()));
        Question fresh = card("new import", "imported later", null); db.flush(); db.clear();
        try { duplicates.mergeBatch(Collections.singletonList(pending)); fail("A new unseen duplicate must reopen review"); }
        catch (IllegalStateException expected) { }
        assertNotNull(db.find(Question.class,b.getId()));
        assertEquals("one",db.find(Question.class,a.getId()).getMotherTongue());
        assertNull(db.find(Question.class,a.getId()).getDuplicateReviewedKey());
        assertEquals(3,duplicates.groups().get(0).getCount());
        VocabularyDuplicateDto.Merge reviewed = request(a.getId(), "kept",a.getId(),b.getId());
        reviewed.setGroupIds(Arrays.asList(a.getId(),b.getId(),fresh.getId()));
        duplicates.mergeBatch(Collections.singletonList(reviewed));
        assertTrue(duplicates.groups().isEmpty());
        assertEquals(Arrays.asList(a.getId(),fresh.getId()),duplicates.groups(true).get(0).getIds());
    }

    @Test public void tenGroupsMergeTogetherAndRemainReviewedAfterReload() {
        List<VocabularyDuplicateDto.Merge> requests = new ArrayList<VocabularyDuplicateDto.Merge>();
        List<Long> primaryIds = new ArrayList<Long>(), sourceIds = new ArrayList<Long>();
        for (int index = 0; index < 10; index++) {
            Question a = card("batch word " + index, "one", lesson("Main " + index));
            Question b = card("batch word " + index, "two", lesson("Source " + index));
            primaryIds.add(a.getId()); sourceIds.add(b.getId());
            requests.add(request(a.getId(), "kept " + index,a.getId(),b.getId()));
        }
        List<VocabularyDuplicateDto.Result> results = duplicates.mergeBatch(requests);
        assertEquals(10, results.size()); assertTrue(duplicates.groups().isEmpty());
        db.clear();
        List<VocabularyDuplicateDto.Group> all = duplicates.groups(true); assertEquals(10,all.size());
        for (int index = 0; index < 10; index++) {
            VocabularyDuplicateDto.Result result = results.get(index);
            assertEquals(primaryIds.get(index),result.getCard().getId()); assertEquals(2,result.getCard().getQuestionTopics().size());
            assertEquals("kept " + index,result.getCard().getMotherTongue()); assertEquals(1,result.getMergedCount());
            assertTrue(result.getGroup().isReviewed()); assertEquals(Collections.singletonList(primaryIds.get(index)),result.getGroup().getIds());
            assertNull(db.find(Question.class,sourceIds.get(index)));
        }
        for (VocabularyDuplicateDto.Group group : all) { assertTrue(group.isReviewed()); assertNotNull(group.getReviewedAt()); }
    }

    @Test public void aStaleSecondGroupOrOverlappingRequestsDoNotPartiallyMergeTheFirst() {
        Question a = card("batch alpha","original a",null), b = card("batch alpha","source a",null);
        Question c = card("batch beta","original b",null), d = card("batch beta","source b",null);
        VocabularyDuplicateDto.Merge first = request(a.getId(),"after a",a.getId(),b.getId());
        VocabularyDuplicateDto.Merge second = request(c.getId(),"after b",c.getId(),d.getId());
        db.find(Question.class,d.getId()).setMotherTongue("changed elsewhere"); db.flush();
        try { duplicates.mergeBatch(Arrays.asList(first,second)); fail("All groups must validate before writes"); }
        catch (IllegalStateException expected) { }
        assertEquals("original a",db.find(Question.class,a.getId()).getMotherTongue()); assertNotNull(db.find(Question.class,b.getId()));
        try { duplicates.mergeBatch(Arrays.asList(first,first)); fail("Overlapping groups must be rejected"); }
        catch (IllegalArgumentException expected) { }
        assertNotNull(db.find(Question.class,b.getId()));
        try { duplicates.mergeBatch(Collections.nCopies(11,first)); fail("More than ten groups must be rejected"); }
        catch (IllegalArgumentException expected) { }
        assertEquals("original a",db.find(Question.class,a.getId()).getMotherTongue());
    }

    @Test public void manualReviewDoesNotMergeWordsAndNewDuplicatesReopenReview() {
        Question a = card("review word","one",lesson("Original")), b = card("review word","two",lesson("Other"));
        VocabularyDuplicateDto.Group marked = duplicates.setReviewed(review(true,a.getId(),b.getId()));
        assertTrue(marked.isReviewed()); assertTrue(duplicates.groups().isEmpty()); db.clear();
        assertNotNull(db.find(Question.class,a.getId())); assertNotNull(db.find(Question.class,b.getId()));
        assertEquals("one",db.find(Question.class,a.getId()).getMotherTongue());
        assertEquals(1,duplicates.groups(true).size()); assertTrue(duplicates.groups(true).get(0).isReviewed());
        duplicates.setReviewed(review(false,a.getId(),b.getId()));
        assertEquals(1,duplicates.groups().size()); assertFalse(duplicates.groups(true).get(0).isReviewed());
        duplicates.setReviewed(review(true,a.getId(),b.getId()));
        Question c = card(" REVIEW WORD ","new sense",null); db.flush(); db.clear();
        assertEquals(3,duplicates.groups().get(0).getCount()); assertFalse(duplicates.groups().get(0).isReviewed());
        VocabularyDuplicateDto.Review partial = review(true,a.getId(),b.getId());
        try { duplicates.setReviewed(partial); fail("A partial snapshot cannot hide a new duplicate"); }
        catch (IllegalStateException expected) { }
        assertNotNull(db.find(Question.class,c.getId())); assertEquals(1,duplicates.groups().size());
    }

    @Test public void reviewedPartialMergeKeepsOtherSensesAndOnlyReappearsForANewId() {
        Question a = card("record","hồ sơ",null), b = card("record","bản ghi",null), c = card("record","ghi lại",null);
        VocabularyDuplicateDto.Result result = duplicates.merge(request(a.getId(),"hồ sơ; bản ghi",a.getId(),b.getId()));
        assertTrue(result.getGroup().isReviewed()); assertEquals(2,result.getGroup().getCount());
        assertTrue(duplicates.groups().isEmpty()); assertNotNull(db.find(Question.class,c.getId()));
        card("record","kỷ lục",null); db.flush(); db.clear();
        assertEquals(3,duplicates.groups().get(0).getCount()); assertFalse(duplicates.groups().get(0).isReviewed());
    }

    @Test public void staleOrForeignManualReviewCannotHideAnotherUsersCards() {
        Question a = card("review access","one",null), b = card("review access","two",null);
        VocabularyDuplicateDto.Review stale = review(true,a.getId(),b.getId());
        db.find(Question.class,b.getId()).setMotherTongue("updated"); db.flush();
        try { duplicates.setReviewed(stale); fail("Stale contents must not be marked"); } catch (IllegalStateException expected) { }
        Question foreign = card("review access","foreign",null);
        foreign.setUser(db.createQuery("from User u where u.id <> :owner",User.class).setParameter("owner",owner().getId()).getResultList().get(0)); db.flush();
        stale.getSources().get(1).setId(foreign.getId());
        try { duplicates.setReviewed(stale); fail("Foreign review must be rejected"); } catch (AccessDeniedException expected) { }
        assertFalse(duplicates.groups(true).get(0).isReviewed());
    }

    @Test public void lateDatabaseFailureRollsBackEarlierGroupsAndReviewMarks() {
        Question a = card("rollback alpha","original a",null), b = card("rollback alpha","source a",lesson("Source lesson"));
        Question c = card("rollback beta","original b",null), d = card("rollback beta","source b",null);
        Long aId=a.getId(),bId=b.getId(),cId=c.getId(),dId=d.getId();
        VocabularyDuplicateDto.Merge first = request(aId,"after a",aId,bId), second = request(cId,"after b",cId,dId);
        db.getTransaction().commit(); db.getTransaction().begin();
        db.createNativeQuery("CREATE TABLE codex_merge_guard(id BIGINT PRIMARY KEY,question_id BIGINT REFERENCES tbl_question(id))").executeUpdate();
        db.createNativeQuery("INSERT INTO codex_merge_guard VALUES(1,"+dId+")").executeUpdate(); db.getTransaction().commit();
        try {
            VocabularyDuplicateService target = new VocabularyDuplicateService();
            ReflectionTestUtils.setField(target,"manager",SharedEntityManagerCreator.createSharedEntityManager(db.getEntityManagerFactory()));
            JpaTransactionManager transactions = new JpaTransactionManager(db.getEntityManagerFactory()); transactions.afterPropertiesSet();
            NameMatchTransactionAttributeSource attributes = new NameMatchTransactionAttributeSource();
            attributes.addTransactionalMethod("mergeBatch",new DefaultTransactionAttribute());
            ProxyFactory proxy = new ProxyFactory(target); proxy.setProxyTargetClass(true); proxy.addAdvice(new TransactionInterceptor(transactions,attributes));
            try { ((VocabularyDuplicateService)proxy.getProxy()).mergeBatch(Arrays.asList(first,second)); fail("Synthetic FK failure should abort the batch"); }
            catch (javax.persistence.PersistenceException expected) { }
            db.clear(); db.getTransaction().begin();
            assertEquals("original a",db.find(Question.class,aId).getMotherTongue()); assertEquals("original b",db.find(Question.class,cId).getMotherTongue());
            assertNotNull(db.find(Question.class,bId)); assertNotNull(db.find(Question.class,dId));
            assertNull(db.find(Question.class,aId).getDuplicateReviewedKey()); assertNull(db.find(Question.class,cId).getDuplicateReviewedKey());
            assertEquals(Long.valueOf(1),db.createQuery("select count(l.id) from QuestionTopic l where l.question.id=:word",Long.class).setParameter("word",bId).getSingleResult());
        } finally {
            if (!db.getTransaction().isActive()) { db.getTransaction().begin(); }
            db.createNativeQuery("DROP TABLE codex_merge_guard").executeUpdate(); db.getTransaction().commit(); db.getTransaction().begin();
        }
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
