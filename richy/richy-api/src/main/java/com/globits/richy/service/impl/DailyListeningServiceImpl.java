package com.globits.richy.service.impl;

import com.globits.richy.domain.Question;
import com.globits.richy.domain.QuestionType;
import com.globits.richy.domain.TestFolder;
import com.globits.richy.dto.QuestionDto;
import com.globits.richy.question.ComprehensiveListeningValidation;
import com.globits.richy.repository.QuestionRepository;
import com.globits.richy.repository.QuestionTypeRepository;
import com.globits.richy.repository.TestFolderRepository;
import com.globits.security.domain.User;
import java.util.List;
import java.util.Collections;
import javax.persistence.EntityManager;
import javax.persistence.Query;
import org.joda.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Daily Listening belongs to the shared test library. Legacy IDs remain stable. */
@Service
@Transactional
public class DailyListeningServiceImpl {
    public static final String FORMAT = "DAILY_LISTENING";
    @Autowired private EntityManager manager;
    @Autowired private QuestionRepository questions;
    @Autowired private QuestionTypeRepository questionTypes;
    @Autowired private TestFolderRepository folders;
    @Autowired private TestFolderServiceImpl folderService;

    public static boolean isDailyTest(Question question) {
        return question != null && FORMAT.equals(question.getTestFormat())
                && question.getQuestionType() != null && Long.valueOf(11L).equals(question.getQuestionType().getId());
    }

    @Transactional(readOnly = true)
    public Page<QuestionDto> list(QuestionDto search, int pageIndex, int pageSize, boolean legacy) {
        boolean authoring = !legacy && search != null && search.getStatus() == 9;
        if (legacy || authoring) { administrator(); }
        int size = Math.min(100, Math.max(1, pageSize));
        PageRequest page = new PageRequest(Math.max(0, pageIndex - 1), size);
        String where = legacy
                ? "s.questionType.id = 6 and s.parent is null and s.pronounce is not null and length(trim(s.pronounce)) > 0 and s.motherTongue is not null and length(trim(s.motherTongue)) > 0"
                : "s.questionType.id = 11 and s.testFormat = 'DAILY_LISTENING' and s.parent is null" + (authoring ? " and s.status in (6, 7)" : " and s.status = 7");
        if (legacy && (search == null || search.getStatus() != 3)) { where += " and s.status = 5"; }
        String text = search == null || search.getTextSearch() == null ? "" : search.getTextSearch().trim();
        List<Long> folderIds = Collections.emptyList();
        if (!legacy && search != null) {
            if (search.isWithoutTestFolder()) { where += " and s.testFolder is null"; }
            else if (search.getTestFolderId() != null) {
                TestFolder folder = folders.findOne(search.getTestFolderId());
                if (folder == null || !FORMAT.equals(folder.getTestMode())) { return new PageImpl<QuestionDto>(Collections.emptyList(), page, 0L); }
                folderIds = folderService.descendantIds(folder.getId(), search.isIncludeSubfolders());
                if (folderIds.isEmpty()) { return new PageImpl<QuestionDto>(Collections.emptyList(), page, 0L); }
                where += " and s.testFolder.id in :folders";
            }
        }
        if (!text.isEmpty()) { where += " and (s.question like :text or s.title like :text or s.motherTongue like :text)"; }
        Query rows = manager.createQuery("select new com.globits.richy.dto.QuestionDto(s) from Question s where " + where + " order by s.createDate desc, s.id desc", QuestionDto.class);
        Query count = manager.createQuery("select count(s.id) from Question s where " + where);
        if (!folderIds.isEmpty()) { rows.setParameter("folders", folderIds); count.setParameter("folders", folderIds); }
        if (!text.isEmpty()) { rows.setParameter("text", "%" + text + "%"); count.setParameter("text", "%" + text + "%"); }
        rows.setFirstResult(page.getOffset()); rows.setMaxResults(size);
        @SuppressWarnings("unchecked") List<QuestionDto> content = rows.getResultList();
        return new PageImpl<QuestionDto>(content, page, (Long) count.getSingleResult());
    }

    public QuestionDto save(QuestionDto dto) {
        User author = administrator();
        if (dto == null) { throw new IllegalArgumentException("Thiếu nội dung bài nghe."); }
        String title = dto.getQuestion() == null ? "" : dto.getQuestion().trim();
        if (title.isEmpty() || title.length() > 200) { throw new IllegalArgumentException("Tên bài cần từ 1 đến 200 ký tự."); }
        String audio = dto.getPronounce() == null ? "" : dto.getPronounce().trim();
        validateContent(audio, dto.getMotherTongue());
        Question question = dto.getId() == null ? new Question() : questions.findOne(dto.getId());
        if (dto.getId() != null && !isDailyTest(question)) { throw new IllegalArgumentException("Bài không thuộc kho Daily Listening. Hãy chuyển bài cũ trước khi sửa."); }
        TestFolder folder = dto.getTestFolderId() == null ? null : folders.findOne(dto.getTestFolderId());
        if (dto.getTestFolderId() != null && (folder == null || !FORMAT.equals(folder.getTestMode()))) {
            throw new IllegalArgumentException("Hãy chọn folder Daily Listening còn tồn tại.");
        }
        if (dto.getId() == null) {
            question.setUser(author); question.setCreateDate(LocalDateTime.now()); question.setCreatedBy(author.getUsername());
            question.setQuestionType(testType()); question.setTestFormat(FORMAT); question.setStatus(7); question.setWebsite(1);
        }
        // Update content only; never overwrite ownership, review counters, answers or relationships from a client DTO.
        question.setQuestion(title); question.setTitle(title); question.setPronounce(audio); question.setMotherTongue(dto.getMotherTongue());
        question.setStatus(dto.getStatus() == 6 ? 6 : 7);
        question.setTestFolder(folder); touch(question, author);
        return new QuestionDto(questions.save(question));
    }

    public QuestionDto migrate(Long id) {
        User author = administrator();
        Question question = id == null ? null : questions.findOne(id);
        if (isDailyTest(question)) { return new QuestionDto(question); }
        if (question == null || question.getQuestionType() == null || !Long.valueOf(6L).equals(question.getQuestionType().getId()) || question.getParent() != null) {
            throw new IllegalArgumentException("Không tìm thấy flashcard cũ để chuyển.");
        }
        validateContent(question.getPronounce(), question.getMotherTongue());
        question.setQuestionType(testType()); question.setTestFormat(FORMAT); question.setStatus(7);
        if (question.getTestFolder() != null && !FORMAT.equals(question.getTestFolder().getTestMode())) { question.setTestFolder(null); }
        if (question.getTitle() == null || question.getTitle().trim().isEmpty()) {
            String title = question.getQuestion();
            if (title == null || title.trim().isEmpty()) {
                title = question.getMotherTongue().replaceAll("<[^>]*>", " ").replace("&nbsp;", " ").replaceAll("\\s+", " ").trim();
                title = title.substring(0, Math.min(100, title.length()));
            }
            question.setTitle(title);
        }
        // Reclassify the existing row so results, assignments and saved learner drafts keep their original ID.
        touch(question, author);
        return new QuestionDto(questions.save(question));
    }

    private QuestionType testType() {
        QuestionType type = questionTypes.findOne(11L);
        if (type == null) { throw new IllegalArgumentException("Chưa có cấu hình loại bài test (11)."); }
        return type;
    }
    public static void validateForPublishing(Question question) { validateContent(question.getPronounce(), question.getMotherTongue()); }
    private static void validateContent(String audio, String transcript) {
        if (audio == null || !ComprehensiveListeningValidation.isSupportedUrl(audio.trim())) {
            throw new IllegalArgumentException("Cần link audio hoặc YouTube hợp lệ (http/https).");
        }
        if (transcript == null || transcript.replaceAll("<[^>]*>", " ").replace("&nbsp;", " ").trim().isEmpty()) {
            throw new IllegalArgumentException("Cần transcript để tạo gaps.");
        }
    }
    private User administrator() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof User)
                || auth.getAuthorities().stream().noneMatch(role -> "ROLE_ADMIN".equals(role.getAuthority()))) {
            throw new AccessDeniedException("Chỉ giáo viên quản trị được tạo, sửa và chuyển bài vào kho chung.");
        }
        return (User) auth.getPrincipal();
    }
    private void touch(Question question, User user) {
        question.setModifiedBy(user.getUsername()); question.setModifyDate(LocalDateTime.now());
    }
}
