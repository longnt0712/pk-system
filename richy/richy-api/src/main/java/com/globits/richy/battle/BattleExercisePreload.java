package com.globits.richy.battle;

import com.globits.richy.dto.AnswerDto;
import com.globits.richy.dto.QuestionAnswerDto;
import com.globits.richy.dto.QuestionDto;
import com.globits.richy.service.BattleOnlineException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Random;
import java.util.Set;
import javax.persistence.EntityManager;
import org.joda.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class BattleExercisePreload {
    private static final int MAX_QUESTIONS = 5000;
    private static final int QUERY_TIMEOUT_MS = 5000;

    @Autowired private EntityManager manager;

    public Plan plan(List<Long> testIds, Long hostId) {
        if (testIds.isEmpty() || testIds.size() > 10) {
            throw invalid("Chọn từ 1 đến 10 đề tổng hợp.");
        }
        Map<Long, TestHeader> tests = readTests(testIds, hostId);
        // Only IDs, ordering and video timestamps are needed to plan the room.
        List<Object[]> rows = manager.createQuery(
                "select t.id, p.id, p.videoUrl, g.id, g.type, g.videoTimeSeconds, q.id, q.videoTimeSeconds"
                + " from Question g join g.parent p join p.parent t left join g.subQuestions q"
                + " where t.id in :ids"
                + " order by t.id, p.ordinalNumber nulls last, p.id,"
                + " g.ordinalNumber nulls last, g.id, q.ordinalNumber nulls last, q.id", Object[].class)
                .setParameter("ids", testIds)
                .setMaxResults(MAX_QUESTIONS + 1)
                .setHint("javax.persistence.query.timeout", QUERY_TIMEOUT_MS)
                .getResultList();
        if (rows.size() > MAX_QUESTIONS) {
            throw invalid("Tối đa 5000 câu hỏi trong một phòng.");
        }

        Map<Long, List<QuestionRef>> questionsByTest = new HashMap<>();
        Long previousPart = null;
        Long previousGroup = null;
        Long firstQuestion = null;
        int partPosition = -1;
        int questionIndex = 0;
        for (Object[] row : rows) {
            Long testId = (Long) row[0];
            Long partId = (Long) row[1];
            String videoUrl = (String) row[2];
            Long groupId = (Long) row[3];
            int type = (Integer) row[4];
            Long questionId = (Long) row[6];
            if (questionId == null) {
                if (type != 16 && type != 17) {
                    throw invalid("Có nhóm chưa có câu hỏi hoặc đáp án.");
                }
                questionId = groupId;
            }
            if (!partId.equals(previousPart)) {
                previousPart = partId;
                partPosition++;
            }
            if (!groupId.equals(previousGroup)) {
                previousGroup = groupId;
                firstQuestion = questionId;
                questionIndex = 0;
            }
            Integer videoTime = videoUrl == null || videoUrl.trim().isEmpty() ? null
                    : (Integer) row[type == 1 ? 7 : 5];
            questionsByTest.computeIfAbsent(testId, id -> new ArrayList<>())
                    .add(new QuestionRef(testId, partId, groupId, questionId, firstQuestion,
                            type, questionIndex++, partPosition, videoTime));
        }

        List<QuestionRef> questions = new ArrayList<>(rows.size());
        for (Long testId : testIds) {
            List<QuestionRef> testQuestions = questionsByTest.get(testId);
            if (testQuestions == null || testQuestions.isEmpty()) {
                throw invalid("Đề tổng hợp chưa có câu hỏi.");
            }
            // A stable sort keeps the original question order for equal video times.
            testQuestions.sort(Comparator.comparingInt((QuestionRef ref) -> ref.partPosition)
                    .thenComparing(ref -> ref.videoTime, Comparator.nullsLast(Comparator.naturalOrder())));
            questions.addAll(testQuestions);
        }
        return new Plan(hostId, tests, questions);
    }

    public List<BattleExerciseQuestions.Turn> loadBatch(Plan plan, int offset, int limit) {
        List<QuestionRef> batch = plan.questions.subList(offset, Math.min(offset + limit, plan.size()));
        Set<Long> nodeIds = new LinkedHashSet<>();
        Set<Long> answerQuestionIds = new LinkedHashSet<>();
        for (QuestionRef ref : batch) {
            nodeIds.add(ref.partId);
            nodeIds.add(ref.groupId);
            nodeIds.add(ref.questionId);
            answerQuestionIds.add(ref.questionId);
            if (ref.usesFirstQuestion()) {
                nodeIds.add(ref.firstQuestionId);
            }
            if (ref.type == 18) {
                answerQuestionIds.add(ref.firstQuestionId);
            }
        }
        Map<Long, QuestionDto> nodes = readNodes(nodeIds);
        readAnswers(answerQuestionIds, nodes);

        // A saved edit to any selected test invalidates the entire room snapshot.
        Map<Long, TestHeader> currentTests = readTests(plan.tests.keySet(), plan.hostId);
        for (TestHeader test : currentTests.values()) {
            if (!Objects.equals(test.modifiedAt, plan.tests.get(test.id).modifiedAt)) {
                throw changedTest();
            }
        }

        Random random = new Random();
        List<BattleExerciseQuestions.Turn> turns = new ArrayList<>(batch.size());
        for (QuestionRef ref : batch) {
            QuestionDto part = requireNode(nodes, ref.partId, ref.testId);
            QuestionDto group = requireNode(nodes, ref.groupId, ref.partId);
            QuestionDto source = requireNode(nodes, ref.questionId,
                    ref.questionId.equals(ref.groupId) ? ref.partId : ref.groupId);
            QuestionDto first = ref.usesFirstQuestion() ? requireNode(nodes, ref.firstQuestionId, ref.groupId) : source;
            if (group.getType() != ref.type) {
                throw changedTest();
            }
            turns.add(BattleExerciseQuestions.fromQuestion(ref.testId, plan.tests.get(ref.testId).title,
                    part, group, source, ref.questionIndex, first, random));
        }
        return turns;
    }

    private Map<Long, TestHeader> readTests(Collection<Long> ids, Long hostId) {
        List<Object[]> rows = manager.createQuery(
                "select t.id, t.title, owner.id, t.status, t.testFormat, kind.id, t.modifyDate"
                + " from Question t left join t.user owner left join t.questionType kind"
                + " where t.id in :ids and t.parent is null", Object[].class)
                .setParameter("ids", ids)
                .setHint("javax.persistence.query.timeout", QUERY_TIMEOUT_MS)
                .getResultList();
        Map<Long, TestHeader> tests = new HashMap<>();
        for (Object[] row : rows) {
            Long id = (Long) row[0];
            int status = (Integer) row[3];
            if (status == 8 || (status != 7 && !Objects.equals(hostId, row[2]))) {
                throw forbiddenTest();
            }
            if (!"COMPREHENSIVE".equals(row[4]) || !Long.valueOf(11L).equals(row[5])) {
                throw invalid("Hãy chọn đúng đề bài tập tổng hợp.");
            }
            tests.put(id, new TestHeader(id, (String) row[1], (LocalDateTime) row[6]));
        }
        if (tests.size() != ids.size()) {
            throw forbiddenTest();
        }
        Map<Long, TestHeader> ordered = new LinkedHashMap<>();
        for (Long id : ids) {
            ordered.put(id, tests.get(id));
        }
        return ordered;
    }

    private Map<Long, QuestionDto> readNodes(Set<Long> ids) {
        List<Object[]> rows = manager.createQuery(
                "select q.id, parent.id, q.question, q.ordinalNumber, q.type, q.title, q.pronounce,"
                + " q.motherTongue, q.videoUrl, q.videoTimeSeconds"
                + " from Question q left join q.parent parent where q.id in :ids", Object[].class)
                .setParameter("ids", ids)
                .setHint("javax.persistence.query.timeout", QUERY_TIMEOUT_MS)
                .getResultList();
        Map<Long, QuestionDto> nodes = new HashMap<>();
        for (Object[] row : rows) {
            QuestionDto node = new QuestionDto();
            node.setId((Long) row[0]);
            QuestionDto parent = new QuestionDto();
            parent.setId((Long) row[1]);
            node.setParent(parent);
            node.setQuestion((String) row[2]);
            node.setOrdinalNumber((Integer) row[3]);
            node.setType((Integer) row[4]);
            node.setTitle((String) row[5]);
            node.setPronounce((String) row[6]);
            node.setMotherTongue((String) row[7]);
            node.setVideoUrl((String) row[8]);
            node.setVideoTimeSeconds((Integer) row[9]);
            node.setQuestionAnswers(new ArrayList<>());
            nodes.put(node.getId(), node);
        }
        if (nodes.size() != ids.size()) {
            throw changedTest();
        }
        return nodes;
    }

    private void readAnswers(Set<Long> ids, Map<Long, QuestionDto> nodes) {
        List<Object[]> rows = manager.createQuery(
                "select qa.question.id, qa.ordinalNumber, qa.isCorrect, a.answer"
                + " from QuestionAnswer qa left join qa.answer a where qa.question.id in :ids"
                + " order by qa.question.id, qa.ordinalNumber, qa.id", Object[].class)
                .setParameter("ids", ids)
                .setHint("javax.persistence.query.timeout", QUERY_TIMEOUT_MS)
                .getResultList();
        for (Object[] row : rows) {
            QuestionAnswerDto value = new QuestionAnswerDto();
            value.setOrdinalNumberQuestionAnswer((Integer) row[1]);
            value.setCorrect((Boolean) row[2]);
            AnswerDto answer = new AnswerDto();
            answer.setAnswer((String) row[3]);
            value.setAnswer(answer);
            nodes.get((Long) row[0]).getQuestionAnswers().add(value);
        }
    }

    private QuestionDto requireNode(Map<Long, QuestionDto> nodes, Long id, Long parentId) {
        QuestionDto node = nodes.get(id);
        if (node == null || !parentId.equals(node.getParent().getId())) {
            throw changedTest();
        }
        return node;
    }

    private static BattleOnlineException invalid(String message) {
        return new BattleOnlineException(HttpStatus.BAD_REQUEST, message);
    }

    private static BattleOnlineException forbiddenTest() {
        return new BattleOnlineException(HttpStatus.FORBIDDEN, "Bạn không có quyền dùng đề này trong Battle.");
    }

    private static BattleOnlineException changedTest() {
        return new BattleOnlineException(HttpStatus.CONFLICT, "Đề đã thay đổi trong khi tải. Hãy chọn và lưu lại đề.");
    }

    public static final class Plan {
        private final Long hostId;
        private final Map<Long, TestHeader> tests;
        private final List<QuestionRef> questions;

        private Plan(Long hostId, Map<Long, TestHeader> tests, List<QuestionRef> questions) {
            this.hostId = hostId;
            this.tests = tests;
            this.questions = questions;
        }

        public int size() { return questions.size(); }

        public List<String> titles() {
            List<String> titles = new ArrayList<>(tests.size());
            for (TestHeader test : tests.values()) {
                titles.add(test.title == null || test.title.trim().isEmpty() ? "Đề tổng hợp " + test.id : test.title);
            }
            return titles;
        }
    }

    private static final class TestHeader {
        private final Long id;
        private final String title;
        private final LocalDateTime modifiedAt;

        private TestHeader(Long id, String title, LocalDateTime modifiedAt) {
            this.id = id;
            this.title = title;
            this.modifiedAt = modifiedAt;
        }
    }

    private static final class QuestionRef {
        private final Long testId, partId, groupId, questionId, firstQuestionId;
        private final int type, questionIndex, partPosition;
        private final Integer videoTime;

        private QuestionRef(Long testId, Long partId, Long groupId, Long questionId, Long firstQuestionId,
                int type, int questionIndex, int partPosition, Integer videoTime) {
            this.testId = testId;
            this.partId = partId;
            this.groupId = groupId;
            this.questionId = questionId;
            this.firstQuestionId = firstQuestionId;
            this.type = type;
            this.questionIndex = questionIndex;
            this.partPosition = partPosition;
            this.videoTime = videoTime;
        }

        private boolean usesFirstQuestion() {
            return type == 11 || type == 13 || type == 18;
        }
    }
}
