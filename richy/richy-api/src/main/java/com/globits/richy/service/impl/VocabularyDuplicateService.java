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
        return groups(false);
    }

    private String reviewKey(String word, List<Long> ids) {
        StringBuilder data = new StringBuilder(); part(data, wordKey(word));
        for (Long id : new TreeSet<Long>(ids)) { part(data, id); }
        return digest(data.toString());
    }

    private Map<String, VocabularyDuplicateDto.Group> groupedWords(Long owner) {
        // Scalar projection: do not hydrate every word's HTML, answers and topic collections.
        List<Object[]> words = manager.createQuery("select q.id, q.question, q.duplicateReviewedKey, q.duplicateReviewedAt from Question q "
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
        for (Object[] row : words) {
            VocabularyDuplicateDto.Group group = grouped.get(wordKey((String) row[1]));
            if (group != null && row[2] != null && row[3] != null && row[2].equals(reviewKey(group.getWord(), group.getIds()))) {
                group.setReviewed(true);
                Date date = (Date) row[3];
                if (group.getReviewedAt() == null || date.after(group.getReviewedAt())) { group.setReviewedAt(date); }
            }
        }
        return grouped;
    }

    @Transactional(readOnly = true)
    public List<VocabularyDuplicateDto.Group> groups(boolean includeReviewed) {
        List<VocabularyDuplicateDto.Group> result = new ArrayList<VocabularyDuplicateDto.Group>();
        for (VocabularyDuplicateDto.Group group : groupedWords(currentUser().getId()).values()) {
            if ((!group.isReviewed() && group.getCount() > 1) || (includeReviewed && group.isReviewed())) { result.add(group); }
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
        List<Question> words = ownedWords(validIds(selected, 1), currentUser().getId(), false);
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
                word.getTimeReviewd(), word.getCorrectAnswer(), word.getWrongAnswer(), word.getCountWords(), word.getModifyDate(),
                word.getDuplicateReviewedKey(), word.getDuplicateReviewedAt())) {
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
        return digest(data.toString());
    }

    private String digest(String data) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(data.getBytes(StandardCharsets.UTF_8));
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

    private static class PreparedMerge {
        private List<Long> ids, removed;
        private Question primary;
        private String meaning;
        private int correct, wrong, reviewed;
    }

    private PreparedMerge prepareMerge(VocabularyDuplicateDto.Merge request, User actor, Set<Long> batchIds,
            Map<String,VocabularyDuplicateDto.Group> currentGroups) {
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
        for (Long id : ids) {
            if (!batchIds.add(id)) { throw new IllegalArgumentException("Một bản từ vựng chỉ được xuất hiện trong một nhóm của lượt lưu."); }
        }
        if (batchIds.size() > 5000) { throw new IllegalArgumentException("Một lượt lưu tối đa 5.000 bản từ vựng."); }
        List<Question> words = ownedWords(ids, actor.getId(), true);
        if (request.getGroupIds() != null) {
            List<Long> previewIds = validIds(request.getGroupIds(), 2);
            VocabularyDuplicateDto.Group current = currentGroups.get(wordKey(words.get(0).getQuestion()));
            if (current == null || !previewIds.equals(current.getIds()) || !previewIds.containsAll(ids)) {
                throw new IllegalStateException("Nhóm có bản trùng mới hoặc đã thay đổi. Hãy tải lại danh sách trước khi gộp.");
            }
        }
        for (Question word : words) {
            if (!fingerprint(word).equals(expected.get(word.getId()))) {
                throw new IllegalStateException("Từ hoặc topic đã được sửa ở nơi khác. Hãy tải lại nhóm và kiểm tra trước khi gộp.");
            }
        }
        requireVocabularyOnly(ids);
        Question primary = words.stream().filter(word -> request.getPrimaryId().equals(word.getId())).findFirst().get();
        String meaning = request.getMeaning();
        if (meaning == null) { meaning = primary.getMotherTongue(); }
        if (meaning == null || meaning.trim().isEmpty() || meaning.length() > VocabularyPolicy.MEANING_LENGTH) {
            throw new IllegalArgumentException("Nhập nghĩa sau gộp từ 1 đến 500 ký tự.");
        }
        PreparedMerge prepared = new PreparedMerge();
        prepared.ids = ids; prepared.primary = primary; prepared.meaning = meaning.trim();
        prepared.correct = sum(words, 0); prepared.wrong = sum(words, 1); prepared.reviewed = sum(words, 2);
        prepared.removed = new ArrayList<Long>(ids); prepared.removed.remove(primary.getId());
        return prepared;
    }

    @Transactional
    public VocabularyDuplicateDto.Result merge(VocabularyDuplicateDto.Merge request) {
        return mergeBatch(Collections.singletonList(request)).get(0);
    }

    @Transactional
    public List<VocabularyDuplicateDto.Result> mergeBatch(List<VocabularyDuplicateDto.Merge> requests) {
        User actor = currentUser();
        if (requests == null || requests.isEmpty() || requests.size() > 10) {
            throw new IllegalArgumentException("Mỗi lượt lưu từ 1 đến 10 nhóm từ trùng.");
        }
        // Serialize merges/imports for this owner and validate every group before any write.
        if (manager.find(User.class, actor.getId(), LockModeType.PESSIMISTIC_WRITE) == null) {
            throw new AccessDeniedException("Tài khoản không còn tồn tại.");
        }
        Set<Long> batchIds = new HashSet<Long>(); List<PreparedMerge> prepared = new ArrayList<PreparedMerge>();
        Map<String,VocabularyDuplicateDto.Group> currentGroups = groupedWords(actor.getId());
        for (VocabularyDuplicateDto.Merge request : requests) { prepared.add(prepareMerge(request, actor, batchIds, currentGroups)); }
        for (PreparedMerge item : prepared) {
            Question primary = item.primary;
            primary.setMotherTongue(item.meaning); primary.setCorrectAnswer(item.correct);
            primary.setWrongAnswer(item.wrong); primary.setTimeReviewd(item.reviewed);
            primary.setModifyDate(LocalDateTime.now()); primary.setModifiedBy(actor.getUsername()); manager.flush();
            mergeLinks("QuestionTopic", "topic", item.ids, primary);
            mergeLinks("CategoryQuestion", "category", item.ids, primary);
            // Keep answer/link IDs so saved answers and historical results remain connected.
            mutateIds("update QuestionAnswer a set a.question = :primary where a.question.id in :ids", item.removed, primary);
            // Bulk deletion avoids orphanRemoval cascading into transferred links/answers.
            mutateIds("delete from Question q where q.id in :ids", item.removed, null);
        }
        // Mark the whole remaining same-word group, including deliberately unselected senses.
        // Its exact ID set is part of the key: a newly imported duplicate automatically reopens review.
        Map<String, VocabularyDuplicateDto.Group> remaining = groupedWords(actor.getId());
        Date reviewedAt = new Date();
        for (PreparedMerge item : prepared) {
            VocabularyDuplicateDto.Group group = remaining.get(wordKey(item.primary.getQuestion()));
            item.primary.setDuplicateReviewedKey(reviewKey(group.getWord(), group.getIds()));
            item.primary.setDuplicateReviewedAt(reviewedAt);
            group.setReviewed(true); group.setReviewedAt(reviewedAt);
        }
        manager.flush(); manager.clear();
        List<VocabularyDuplicateDto.Result> results = new ArrayList<VocabularyDuplicateDto.Result>();
        for (PreparedMerge item : prepared) {
            results.add(new VocabularyDuplicateDto.Result(new QuestionDto(manager.find(Question.class, item.primary.getId())), item.removed.size(),
                    remaining.get(wordKey(item.primary.getQuestion()))));
        }
        return results;
    }

    @Transactional
    public VocabularyDuplicateDto.Group setReviewed(VocabularyDuplicateDto.Review request) {
        User actor = currentUser();
        if (request == null || request.getSources() == null) { throw new IllegalArgumentException("Hãy tải nhóm từ trước khi đánh dấu."); }
        List<Long> ids = new ArrayList<Long>(); Map<Long,String> expected = new HashMap<Long,String>();
        for (VocabularyDuplicateDto.Source source : request.getSources()) {
            if (source == null || source.getFingerprint() == null) { throw new IllegalArgumentException("Thiếu dữ liệu đối chiếu nhóm từ."); }
            ids.add(source.getId()); expected.put(source.getId(),source.getFingerprint());
        }
        ids = validIds(ids,1);
        if (manager.find(User.class, actor.getId(), LockModeType.PESSIMISTIC_WRITE) == null) { throw new AccessDeniedException("Tài khoản không còn tồn tại."); }
        List<Question> words = ownedWords(ids,actor.getId(),true);
        for (Question word : words) {
            if (!fingerprint(word).equals(expected.get(word.getId()))) { throw new IllegalStateException("Nhóm từ đã thay đổi. Hãy tải lại trước khi đánh dấu."); }
        }
        VocabularyDuplicateDto.Group group = groupedWords(actor.getId()).get(wordKey(words.get(0).getQuestion()));
        if (group == null || !new TreeSet<Long>(ids).equals(new TreeSet<Long>(group.getIds()))) {
            throw new IllegalStateException("Có bản trùng mới trong nhóm. Hãy tải lại trước khi đánh dấu.");
        }
        for (Question word : words) { word.setDuplicateReviewedKey(null); word.setDuplicateReviewedAt(null); }
        Date date = request.isReviewed() ? new Date() : null;
        if (request.isReviewed()) { words.get(0).setDuplicateReviewedKey(reviewKey(group.getWord(),ids)); words.get(0).setDuplicateReviewedAt(date); }
        manager.flush(); manager.clear();
        group.setReviewed(request.isReviewed()); group.setReviewedAt(date);
        return group;
    }
}
