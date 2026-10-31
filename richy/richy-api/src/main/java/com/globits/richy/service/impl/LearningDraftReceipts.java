package com.globits.richy.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.globits.richy.domain.TestResult;
import com.globits.richy.dto.LearningDraftDto;
import java.util.*;
import java.util.regex.*;
import javax.persistence.EntityManager;

/** Read-only evidence for reminders. Never deletes or rewrites a learner's draft. */
public final class LearningDraftReceipts {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Pattern TASK = Pattern.compile(":task:(\\d+)(?=:|$)");
    private static final Pattern SECTION = Pattern.compile(":section:([A-Za-z0-9_-]{1,40})(?=:|$)");
    private static final Pattern ATTEMPT = Pattern.compile(":attempt:([a-f0-9]{32})$");
    private LearningDraftReceipts() { }

    private static class Context {
        Long user, source, task; int type; String attempt, section; SortedSet<Integer> parts;
    }
    private static Long id(JsonNode node) {
        if (node == null || node.isNull() || !node.asText().matches("[1-9][0-9]*")) return null;
        try { return Long.valueOf(node.asText()); } catch (NumberFormatException invalid) { return null; }
    }
    private static SortedSet<Integer> parts(JsonNode node) {
        SortedSet<Integer> values = new TreeSet<Integer>();
        if (node != null && node.isArray()) for (JsonNode value : node) {
            Long number = id(value); if (number == null || number > 4) return new TreeSet<Integer>(); values.add(number.intValue());
        }
        return values;
    }
    private static Context context(Long user, LearningDraftDto draft) {
        if (!"IELTS".equals(draft.getDraftType()) || draft.getDraftKey() == null || draft.getPayload() == null) return null;
        try {
            JsonNode payload = JSON.readTree(draft.getPayload()); Context value = new Context();
            value.user = id(payload.get("userId")); value.source = id(payload.get("testId"));
            if (!user.equals(value.user) || value.source == null) return null;
            value.attempt = payload.path("clientAttemptKey").asText("");
            if (!value.attempt.matches("[a-f0-9]{32}")) return null;
            String key = draft.getDraftKey(); Matcher keyedAttempt = ATTEMPT.matcher(key);
            if (keyedAttempt.find() && !keyedAttempt.group(1).equals(value.attempt)) return null;
            value.task = id(payload.get("assignmentTaskId")); Matcher task = TASK.matcher(key);
            if (task.find()) { Long keyed = Long.valueOf(task.group(1)); if (value.task != null && !value.task.equals(keyed)) return null; value.task = keyed; }
            if (value.task == null && ("STUDY".equalsIgnoreCase(payload.path("sessionMode").asText(""))
                || (!payload.hasNonNull("sessionMode") && key.toLowerCase(Locale.ROOT).matches(".*:study(?::.*)?$")))) return null;
            value.section = payload.path("assignmentSectionKey").asText(""); Matcher section = SECTION.matcher(key);
            if (section.find()) { if (!value.section.isEmpty() && !value.section.equals(section.group(1))) return null; value.section = section.group(1); }
            String mode = payload.path("testMode").asText("").toUpperCase(Locale.ROOT);
            if (mode.isEmpty()) mode = key.contains(":comprehensive") ? "COMPREHENSIVE" : key.contains(":writing") ? "WRITING"
                : key.contains(":listening") || payload.path("isListening").asBoolean(false) ? "LISTENING" : "READING";
            value.type = "COMPREHENSIVE".equals(mode) ? 6 : "WRITING".equals(mode) ? 7 : "LISTENING".equals(mode) ? 2 : "READING".equals(mode) ? 4 : 0;
            if (value.type == 0 || (value.type != 6 && !value.section.isEmpty())) return null;
            JsonNode assigned = payload.get("assignmentParts");
            if (assigned != null && !assigned.isNull() && !assigned.isArray()) return null;
            value.parts = parts(assigned);
            if (assigned != null && assigned.size() > 0 && value.parts.isEmpty()) return null;
            if (value.parts.isEmpty() && payload.path("isPartAssignment").asBoolean(true)) {
                Long part = id(payload.get("assignmentPart")); if (part != null && part <= 4) value.parts.add(part.intValue());
            }
            if (value.parts.isEmpty()) value.parts = parts(payload.get("partNumbers"));
            return value.parts.isEmpty() ? null : value;
        } catch (Exception malformed) { return null; }
    }

    public static void attach(EntityManager manager, Long user, List<LearningDraftDto> drafts) {
        Map<LearningDraftDto,Context> contexts = new LinkedHashMap<LearningDraftDto,Context>(); Set<String> keys = new LinkedHashSet<String>();
        for (LearningDraftDto draft : drafts) { Context value = context(user,draft); if (value != null) { contexts.put(draft,value); keys.add(value.attempt); } }
        List<String> attempts = new ArrayList<String>(keys); Map<String,List<Object[]>> matches = new HashMap<String,List<Object[]>>();
        // Bound SQL Server parameters and project only receipt metadata, not essays, answers or learning state.
        for (int offset = 0; offset < attempts.size(); offset += 200) {
            List<Object[]> rows = manager.createQuery("select r.id,r.user.id,r.clientAttemptKey,r.testType,r.sourceQuestionId,r.assignmentTaskId,"
                + "r.assignmentSectionKey,r.completedPartsValue,r.completedPart,r.resultStatus,r.ieltsSessionMode from TestResult r "
                + "where r.user.id=:user and r.clientAttemptKey in :attempts and r.testType in (2,4,6,7) order by r.id asc",Object[].class)
                .setParameter("user",user).setParameter("attempts",attempts.subList(offset,Math.min(offset+200,attempts.size()))).getResultList();
            for (Object[] row : rows) { String key = (String)row[2]; if (!matches.containsKey(key)) matches.put(key,new ArrayList<Object[]>()); matches.get(key).add(row); }
        }
        for (Map.Entry<LearningDraftDto,Context> entry : contexts.entrySet()) {
            Context value = entry.getValue(); List<Object[]> rows = matches.get(value.attempt); if (rows == null) continue;
            for (Object[] row : rows) {
                List<Integer> completed = TestResult.parseCompletedParts((String)row[7],(Integer)row[8]);
                if (!Objects.equals(row[1],user) || !Objects.equals(row[3],value.type) || !Objects.equals(row[4],value.source)
                    || !Objects.equals(row[5],value.task) || !Objects.equals(row[6] == null ? "" : row[6],value.section)
                    || !value.parts.equals(new TreeSet<Integer>(completed)) || "STUDY".equals(row[10])
                    || !("SUCCESS".equals(row[9]) || "FAILED".equals(row[9]))) continue;
                Map<String,Object> receipt = new LinkedHashMap<String,Object>(); receipt.put("id",row[0]); receipt.put("user",Collections.singletonMap("id",user));
                receipt.put("clientAttemptKey",row[2]); receipt.put("testType",row[3]); receipt.put("sourceQuestionId",row[4]);
                receipt.put("assignmentTaskId",row[5]); receipt.put("assignmentSectionKey",row[6]); receipt.put("completedParts",completed);
                receipt.put("resultStatus",row[9]); receipt.put("ieltsSessionMode",row[10]); entry.getKey().setSavedResult(receipt); break;
            }
        }
    }
}
