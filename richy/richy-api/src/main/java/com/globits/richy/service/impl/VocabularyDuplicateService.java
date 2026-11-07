package com.globits.richy.service.impl;

import com.globits.richy.domain.Question;
import com.globits.richy.domain.QuestionAnswer;
import com.globits.richy.domain.QuestionTopic;
import com.globits.richy.dto.QuestionDto;
import com.globits.richy.dto.VocabularyDuplicateDto;
import com.globits.richy.question.VocabularyPolicy;
import com.globits.security.domain.User;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;
import javax.persistence.EntityManager;
import javax.persistence.LockModeType;
import javax.persistence.PersistenceContext;
import org.joda.time.LocalDateTime;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VocabularyDuplicateService {
    @PersistenceContext private EntityManager manager;
    private static final int BATCH = 400;

    private User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof User)
                || ((User) auth.getPrincipal()).getId() == null
                || (!VocabularyPolicy.hasRole(auth, "ROLE_ADMIN") && !VocabularyPolicy.hasRole(auth, "ROLE_USER"))) {
            throw new AccessDeniedException("Bạn không có quyền gộp từ vựng.");
        }
        return (User) auth.getPrincipal();
    }

    static String wordKey(String text) {
        return text == null ? "" : text.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ENGLISH);
    }

    @Transactional(readOnly = true)
    public List<VocabularyDuplicateDto.Group> groups() {
        Long owner = currentUser().getId();
        // Scalar projection: do not hydrate every word's HTML, answers and topic collections.
        List<Object[]> words = manager.createQuery("select q.id, q.question from Question q "
                + "where q.user.id = :owner and q.questionType.id = 6 and q.parent is null order by q.id", Object[].class)
                .setParameter("owner", owner).getResultList();
        Map<String, VocabularyDuplicateDto.Group> grouped = new TreeMap<String, VocabularyDuplicateDto.Group>();
        for (Object[] row : words) {
            String text = (String) row[1], key = wordKey(text);
            if (key.isEmpty()) { continue; }
            VocabularyDuplicateDto.Group group = grouped.get(key);
            if (group == null) {
                group = new VocabularyDuplicateDto.Group(); group.setWord(text.trim()); grouped.put(key, group);
            }
            group.getIds().add((Long) row[0]);
        }
        List<VocabularyDuplicateDto.Group> result = new ArrayList<VocabularyDuplicateDto.Group>();
        for (VocabularyDuplicateDto.Group group : grouped.values()) {
            if (group.getCount() > 1) { result.add(group); }
        }
        return result;
    }

    private List<Long> validIds(List<Long> ids, int minimum) {
        if (ids == null || ids.size() < minimum || ids.size() > 5000) {
            throw new IllegalArgumentException("Chọn từ " + minimum + " đến 5.000 bản từ vựng trong một nhóm.");
        }
        Set<Long> unique = new TreeSet<Long>();
        for (Long id : ids) {
            if (id == null || id <= 0 || !unique.add(id)) { throw new IllegalArgumentException("Danh sách từ được chọn không hợp lệ."); }
        }
        return new ArrayList<Long>(unique);
    }

    private List<Question> ownedWords(List<Long> ids, Long owner, boolean lock) {
        List<Question> result = new ArrayList<Question>();
        String expected = null;
        for (Long id : ids) {
            Question word = lock ? manager.find(Question.class, id, LockModeType.PESSIMISTIC_WRITE) : manager.find(Question.class, id);
            if (word == null) { throw new IllegalStateException("Nhóm từ đã thay đổi. Hãy tải lại nhóm trước khi gộp."); }
            if (word.getUser() == null || !owner.equals(word.getUser().getId())) {
                throw new AccessDeniedException("Bạn chỉ được gộp từ trong tài khoản của mình.");
            }
            String key = wordKey(word.getQuestion());
            if (word.getParent() != null || word.getQuestionType() == null || !Long.valueOf(6L).equals(word.getQuestionType().getId())
                    || key.isEmpty() || (expected != null && !expected.equals(key))) {
                throw new IllegalArgumentException("Chỉ gộp các thẻ có cùng nguyên từ hoặc cụm từ.");
            }
            expected = key; result.add(word);
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<VocabularyDuplicateDto.Card> details(List<Long> selected) {
        List<Question> words = ownedWords(validIds(selected, 2), currentUser().getId(), false);
        List<VocabularyDuplicateDto.Card> result = new ArrayList<VocabularyDuplicateDto.Card>();
        for (Question word : words) { result.add(new VocabularyDuplicateDto.Card(word, fingerprint(word))); }
        return result;
    }

    private static void part(StringBuilder result, Object value) {
        String text = value == null ? null : value.toString();
        result.append(text == null ? -1 : text.length()).append(':');
        if (text != null) { result.append(text); }
        result.append(';');
    }

    private String fingerprint(Question word) {
        StringBuilder data = new StringBuilder();
        for (Object value : Arrays.asList(word.getId(), word.getQuestion(), word.getMotherTongue(), word.getPronounce(), word.getLevel(),
                word.getDescription(), word.getExamples(), word.getAuthor(), word.getTitle(), word.getStatus(), word.getType(),
                word.getTimeReviewd(), word.getCorrectAnswer(), word.getWrongAnswer(), word.getCountWords(), word.getModifyDate())) {
            part(data, value);
        }
        List<String> links = new ArrayList<String>();
        if (word.getQuestionTopics() != null) {
            for (QuestionTopic link : word.getQuestionTopics()) {
                links.add("T:" + link.getId() + ":" + (link.getTopic() == null ? null : link.getTopic().getId()));
            }
        }
        if (word.getQuestionAnswers() != null) {
            for (QuestionAnswer answer : word.getQuestionAnswers()) {
                links.add("A:" + answer.getId() + ":" + (answer.getAnswer() == null ? null : answer.getAnswer().getId())
                        + ":" + answer.isCorrect() + ":" + answer.getOrdinalNumber());
            }
        }
        Collections.sort(links); for (String link : links) { part(data, link); }
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(data.toString().getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte value : hash) { hex.append(String.format("%02x", value & 255)); }
            return hex.toString();
        } catch (NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }

    private void requireVocabularyOnly(List<Long> ids) {
        for (int from = 0; from < ids.size(); from += BATCH) {
            List<Long> batch = ids.subList(from, Math.min(from + BATCH, ids.size()));
            Long children = manager.createQuery("select count(q.id) from Question q where q.parent.id in :ids", Long.class)
                    .setParameter("ids", batch).getSingleResult();
            Long tasks = manager.createQuery("select count(t.id) from EnrolmentClassScheduleTask t "
                    + "where t.sourceQuestion.id in :ids or t.ieltsTest.id in :ids", Long.class).setParameter("ids", batch).getSingleResult();
            Long results = manager.createQuery("select count(r.id) from TestResult r where r.sourceQuestionId in :ids", Long.class)
                    .setParameter("ids", batch).getSingleResult();
            if (children > 0 || tasks > 0 || results > 0) {
                throw new IllegalArgumentException("Có bản đang được dùng làm đề hoặc bài giao trực tiếp. Không gộp để giữ đúng bài và lịch sử học sinh.");
            }
        }
    }

    private void mutateIds(String hql, List<Long> ids, Question primary) {
        for (int from = 0; from < ids.size(); from += BATCH) {
            javax.persistence.Query query = manager.createQuery(hql).setParameter("ids", ids.subList(from, Math.min(from + BATCH, ids.size())));
            if (primary != null) { query.setParameter("primary", primary); }
            query.executeUpdate();
        }
    }

    private void mergeLinks(String entity, String target, List<Long> ids, Question primary) {
        List<Object[]> links = new ArrayList<Object[]>();
        for (int from = 0; from < ids.size(); from += BATCH) {
            links.addAll(manager.createQuery("select l.id, l.question.id, l." + target + ".id from " + entity
                    + " l where l.question.id in :ids", Object[].class)
                    .setParameter("ids", ids.subList(from, Math.min(from + BATCH, ids.size()))).getResultList());
        }
        // Keep the canonical word's existing link IDs whenever the same topic occurs on both sides.
        Collections.sort(links, (left, right) -> {
            int leftRank = primary.getId().equals(left[1]) ? 0 : 1, rightRank = primary.getId().equals(right[1]) ? 0 : 1;
            return leftRank != rightRank ? Integer.compare(leftRank, rightRank) : ((Long) left[0]).compareTo((Long) right[0]);
        });
        Set<Long> targets = new HashSet<Long>(); List<Long> remove = new ArrayList<Long>(), move = new ArrayList<Long>();
        for (Object[] link : links) {
            if (link[2] != null && !targets.add((Long) link[2])) { remove.add((Long) link[0]); }
            else if (!primary.getId().equals(link[1])) { move.add((Long) link[0]); }
        }
        mutateIds("delete from " + entity + " l where l.id in :ids", remove, null);
        mutateIds("update " + entity + " l set l.question = :primary where l.id in :ids", move, primary);
    }

    private int sum(List<Question> words, int field) {
        long total = 0;
        for (Question word : words) { total += field == 0 ? word.getCorrectAnswer() : field == 1 ? word.getWrongAnswer() : word.getTimeReviewd(); }
        if (total < Integer.MIN_VALUE || total > Integer.MAX_VALUE) { throw new IllegalArgumentException("Tổng số lượt luyện vượt giới hạn. Chưa thực hiện gộp."); }
        return (int) total;
    }

    @Transactional
    public VocabularyDuplicateDto.Result merge(VocabularyDuplicateDto.Merge request) {
        User actor = currentUser();
        if (request == null || request.getPrimaryId() == null || request.getSources() == null) {
            throw new IllegalArgumentException("Chọn bản chính và các bản muốn gộp.");
        }
        List<Long> requestedIds = new ArrayList<Long>(); Map<Long, String> expected = new HashMap<Long, String>();
        for (VocabularyDuplicateDto.Source source : request.getSources()) {
            if (source == null || source.getFingerprint() == null) { throw new IllegalArgumentException("Hãy tải chi tiết từ trước khi gộp."); }
            requestedIds.add(source.getId()); expected.put(source.getId(), source.getFingerprint());
        }
        List<Long> ids = validIds(requestedIds, 2);
        if (!ids.contains(request.getPrimaryId())) { throw new IllegalArgumentException("Bản chính phải nằm trong các bản được chọn."); }
        // Same owner lock used by imports/word creation; sorted word locks serialize overlapping merges.
        if (manager.find(User.class, actor.getId(), LockModeType.PESSIMISTIC_WRITE) == null) {
            throw new AccessDeniedException("Tài khoản không còn tồn tại.");
        }
        List<Question> words = ownedWords(ids, actor.getId(), true);
        for (Question word : words) {
            if (!fingerprint(word).equals(expected.get(word.getId()))) {
                throw new IllegalStateException("Từ hoặc topic đã được sửa ở nơi khác. Hãy tải lại nhóm và kiểm tra trước khi gộp.");
            }
        }
        requireVocabularyOnly(ids);
        Question primary = words.stream().filter(word -> request.getPrimaryId().equals(word.getId())).findFirst().get();
        String meaning = request.getMeaning();
        if (meaning == null) {
            Set<String> meanings = new LinkedHashSet<String>();
            for (Question word : words) { if (word.getMotherTongue() != null && !word.getMotherTongue().trim().isEmpty()) { meanings.add(word.getMotherTongue().trim()); } }
            meaning = String.join(" / ", meanings);
        }
        if (meaning.length() > VocabularyPolicy.MEANING_LENGTH) { throw new IllegalArgumentException("Nghĩa sau gộp vượt 500 ký tự. Vui lòng rút gọn trước khi xác nhận."); }
        int correct = sum(words, 0), wrong = sum(words, 1), reviewed = sum(words, 2);
        primary.setMotherTongue(meaning.trim()); primary.setCorrectAnswer(correct); primary.setWrongAnswer(wrong); primary.setTimeReviewd(reviewed);
        primary.setModifyDate(LocalDateTime.now()); primary.setModifiedBy(actor.getUsername()); manager.flush();
        mergeLinks("QuestionTopic", "topic", ids, primary);
        mergeLinks("CategoryQuestion", "category", ids, primary);
        List<Long> removed = new ArrayList<Long>(ids); removed.remove(primary.getId());
        // Keep answer/link IDs: saved QuestionAnswerTestResult rows continue referring to the same answers.
        mutateIds("update QuestionAnswer a set a.question = :primary where a.question.id in :ids", removed, primary);
        // Bulk deletion deliberately avoids orphanRemoval deleting the links/answers moved above.
        mutateIds("delete from Question q where q.id in :ids", removed, null);
        manager.flush(); manager.clear();
        return new VocabularyDuplicateDto.Result(new QuestionDto(manager.find(Question.class, primary.getId())), removed.size());
    }
}
