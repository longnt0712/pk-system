package com.globits.richy.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.globits.richy.domain.EnrolmentClassScheduleTask;
import com.globits.richy.domain.Question;
import com.globits.richy.dto.ComprehensiveAssignmentSectionDto;
import java.io.IOException;
import java.util.*;

/** Pure planning/serialization; never changes the source test or trusts client membership lists. */
public final class ComprehensiveAssignmentSections {
    private ComprehensiveAssignmentSections() {}
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final TypeReference<List<ComprehensiveAssignmentSectionDto>> SECTIONS = new TypeReference<List<ComprehensiveAssignmentSectionDto>>() {};
    public static void validateDuration(Integer value) {
        if (value != null && (value < 0 || value > 1440)) throw new IllegalArgumentException("Thời gian làm bài phải từ 1 đến 1.440 phút, hoặc chọn không tính giờ.");
    }
    public static List<ComprehensiveAssignmentSectionDto> read(EnrolmentClassScheduleTask task) {
        if (task == null || task.getComprehensiveSectionsJson() == null || task.getComprehensiveSectionsJson().trim().isEmpty()) return new ArrayList<ComprehensiveAssignmentSectionDto>();
        try {
            List<ComprehensiveAssignmentSectionDto> sections = JSON.readValue(task.getComprehensiveSectionsJson(), SECTIONS);
            validate(sections); return sections;
        } catch (IOException | IllegalArgumentException error) { throw new IllegalStateException("Cấu hình phần bài Tổng hợp đã lưu không hợp lệ. Vui lòng liên hệ giáo viên.", error); }
    }
    public static void write(EnrolmentClassScheduleTask task, List<ComprehensiveAssignmentSectionDto> sections) {
        if (task == null) throw new IllegalArgumentException("Thiếu task được giao.");
        if (sections == null || sections.isEmpty()) { task.setComprehensiveSectionsJson(null); return; }
        validate(sections);
        try { task.setComprehensiveSectionsJson(JSON.writeValueAsString(sections)); }
        catch (IOException error) { throw new IllegalStateException("Không lưu được cấu hình phần bài Tổng hợp.", error); }
    }
    public static ComprehensiveAssignmentSectionDto find(EnrolmentClassScheduleTask task, String key) {
        if (key == null || key.trim().isEmpty()) return null;
        for (ComprehensiveAssignmentSectionDto section : read(task)) if (key.equals(section.getKey())) return section;
        return null;
    }
    public static Set<Long> questionIds(ComprehensiveAssignmentSectionDto section) {
        return section == null ? new LinkedHashSet<Long>() : new LinkedHashSet<Long>(section.getQuestionIds());
    }
    public static boolean sameLayout(List<ComprehensiveAssignmentSectionDto> left, List<ComprehensiveAssignmentSectionDto> right) {
        if (left == null || right == null || left.size() != right.size()) return false;
        for (int i=0; i<left.size(); i++) if (!left.get(i).getQuestionIds().equals(right.get(i).getQuestionIds())) return false;
        return true;
    }
    private static void validate(List<ComprehensiveAssignmentSectionDto> sections) {
        if (sections == null || sections.size() > 5000) throw new IllegalArgumentException("Số phần bài không hợp lệ.");
        Set<String> keys = new HashSet<String>(); Set<Long> ids = new HashSet<Long>(); int expected = 1;
        for (ComprehensiveAssignmentSectionDto section : sections) {
            if (section == null || section.getNumber() != expected++ || section.getKey() == null || !section.getKey().matches("[A-Za-z0-9_-]{8,40}")
                    || !keys.add(section.getKey()) || section.getQuestionIds() == null || section.getQuestionIds().isEmpty()) throw new IllegalArgumentException("Phần bài không hợp lệ hoặc bị trùng.");
            validateDuration(section.getDurationMinutes());
            for (Long id : section.getQuestionIds()) if (id == null || id <= 0 || !ids.add(id)) throw new IllegalArgumentException("Mã câu hỏi bị thiếu hoặc trùng giữa các phần.");
            if (ids.size() > 10000) throw new IllegalArgumentException("Một bài được giao tối đa 10.000 câu hỏi.");
        }
    }
    private static List<Question> ordered(Collection<Question> values) {
        List<Question> result = new ArrayList<Question>(); if (values != null) for (Question q : values) if (q != null) result.add(q);
        result.sort(Comparator.comparingInt((Question q) -> q.getOrdinalNumber() == null ? Integer.MAX_VALUE : q.getOrdinalNumber())
            .thenComparing(q -> q.getId() == null ? Long.MAX_VALUE : q.getId())); return result;
    }
    private static final class Unit {
        private final List<Question> questions;
        private final boolean isolatedHeading;
        private Unit(List<Question> questions, boolean isolatedHeading) {
            this.questions = questions; this.isolatedHeading = isolatedHeading;
        }
    }
    private static List<Unit> units(Question source) {
        if (source == null || !"COMPREHENSIVE".equals(source.getTestFormat())) throw new IllegalArgumentException("Chọn đúng đề bài Tổng hợp.");
        List<Unit> units = new ArrayList<Unit>(); Set<Long> ids = new HashSet<Long>();
        for (Question passage : ordered(source.getSubQuestions())) {
            List<Question> packages = ordered(passage.getSubQuestions()), wholePassage = new ArrayList<Question>(); boolean linkedPassage = false;
            for (Question pack : packages) if (pack.getType() == 4) linkedPassage = true;
            for (Question pack : packages) {
                List<Question> questions = ordered(pack.getSubQuestions()); if (questions.isEmpty()) continue;
                for (Question question : questions) {
                    if (question.getId() == null || question.getId() <= 0 || !ids.add(question.getId())) throw new IllegalArgumentException("Đề có mã câu hỏi chưa lưu hoặc bị trùng. Hãy kiểm tra lại đề trước khi giao.");
                    if (ids.size() > 10000) throw new IllegalArgumentException("Một bài được giao tối đa 10.000 câu hỏi.");
                }
                if (linkedPassage) wholePassage.addAll(questions);
                else if (pack.getType() == 1 || pack.getType() == 6) for (Question question : questions) units.add(new Unit(new ArrayList<Question>(Collections.singletonList(question)), false));
                else units.add(new Unit(questions, false));
            }
            // A workspace has one heading bank, so this passage must own its whole section.
            if (!wholePassage.isEmpty()) units.add(new Unit(wholePassage, true));
        }
        if (units.isEmpty()) throw new IllegalArgumentException("Đề chưa có câu hỏi để chia phần."); return units;
    }
    public static Set<Long> sourceQuestionIds(Question source) {
        Set<Long> ids = new LinkedHashSet<Long>(); for (Unit unit : units(source)) for (Question q : unit.questions) ids.add(q.getId()); return ids;
    }
    public static void validateAgainstSource(Question source, List<ComprehensiveAssignmentSectionDto> sections) {
        validate(sections); Set<Long> ids = new LinkedHashSet<Long>(); Map<Long,String> sectionByQuestion = new HashMap<Long,String>(); Map<String,Integer> sectionSizes = new HashMap<String,Integer>();
        for (ComprehensiveAssignmentSectionDto section : sections) {
            sectionSizes.put(section.getKey(), section.getQuestionCount());
            for (Long id : section.getQuestionIds()) { ids.add(id); sectionByQuestion.put(id,section.getKey()); }
        }
        List<Unit> currentUnits = units(source); Set<Long> currentIds = new LinkedHashSet<Long>();
        for (Unit unit : currentUnits) for (Question question : unit.questions) currentIds.add(question.getId());
        if (!ids.equals(currentIds)) throw new IllegalArgumentException("Đề đã thay đổi số câu so với các phần được giao. Vui lòng giao task mới để giữ đúng tiến độ cũ.");
        for (Unit unit : currentUnits) {
            String selectedSection = sectionByQuestion.get(unit.questions.get(0).getId());
            for (Question question : unit.questions) if (!Objects.equals(selectedSection,sectionByQuestion.get(question.getId()))) {
                throw new IllegalArgumentException("Nhóm câu hỏi dùng chung trong đề đã thay đổi và nằm ở nhiều phần cũ. Vui lòng giao task mới để giữ trọn nhóm câu hỏi.");
            }
            if (unit.isolatedHeading && sectionSizes.get(selectedSection) != unit.questions.size()) {
                throw new IllegalArgumentException("Passage có câu hỏi heading phải nằm trong một phần riêng để giữ đúng ngân hàng đáp án. Vui lòng giao task mới.");
            }
        }
    }
    public static List<ComprehensiveAssignmentSectionDto> plan(Question source, int target, Integer defaultMinutes) {
        if (target < 2 || target > 1000) throw new IllegalArgumentException("Số câu mục tiêu mỗi phần phải từ 2 đến 1.000.");
        validateDuration(defaultMinutes); List<Unit> units = units(source); List<Unit> groups = new ArrayList<Unit>(); List<Question> current = new ArrayList<Question>();
        for (Unit unit : units) {
            if (unit.isolatedHeading) {
                if (!current.isEmpty()) { groups.add(new Unit(current, false)); current = new ArrayList<Question>(); }
                groups.add(new Unit(new ArrayList<Question>(unit.questions), true));
                continue;
            }
            if (!current.isEmpty() && current.size() + unit.questions.size() > target && target-current.size() <= Math.abs(target-current.size()-unit.questions.size())) {
                groups.add(new Unit(current, false)); current = new ArrayList<Question>();
            }
            current.addAll(unit.questions);
            if (current.size() >= target) { groups.add(new Unit(current, false)); current = new ArrayList<Question>(); }
        }
        if (!current.isEmpty()) groups.add(new Unit(current, false));
        // A boundary moved to preserve a shared group can leave a tiny tail.
        // Prefer e.g. 49 + 51 over 49 + 50 + 1 while retaining every atomic unit.
        if (groups.size() > 1) {
            Unit last = groups.get(groups.size()-1), previous = groups.get(groups.size()-2);
            if (!last.isolatedHeading && !previous.isolatedHeading && last.questions.size()*2 < target && previous.questions.size()+last.questions.size() <= target+target/2) {
                previous.questions.addAll(last.questions); groups.remove(groups.size()-1);
            }
        }
        List<ComprehensiveAssignmentSectionDto> sections = new ArrayList<ComprehensiveAssignmentSectionDto>();
        for (Unit unit : groups) {
            List<Question> group = unit.questions;
            ComprehensiveAssignmentSectionDto section = new ComprehensiveAssignmentSectionDto(); section.setKey(UUID.randomUUID().toString()); section.setNumber(sections.size()+1); section.setDurationMinutes(defaultMinutes);
            List<Long> ids = new ArrayList<Long>(); for (Question q : group) ids.add(q.getId()); section.setQuestionIds(ids);
            section.setFirstOrdinal(group.get(0).getOrdinalNumber() == null ? 0 : group.get(0).getOrdinalNumber());
            section.setLastOrdinal(group.get(group.size()-1).getOrdinalNumber() == null ? 0 : group.get(group.size()-1).getOrdinalNumber()); sections.add(section);
        }
        validate(sections); return sections;
    }
}
