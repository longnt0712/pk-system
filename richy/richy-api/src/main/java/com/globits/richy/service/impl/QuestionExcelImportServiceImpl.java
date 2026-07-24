package com.globits.richy.service.impl;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.FormulaEvaluator;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.joda.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.globits.richy.domain.Question;
import com.globits.richy.domain.QuestionTopic;
import com.globits.richy.domain.QuestionType;
import com.globits.richy.domain.Topic;
import com.globits.richy.dto.QuestionImportConfirmDto;
import com.globits.richy.dto.QuestionImportExistingDto;
import com.globits.richy.dto.QuestionImportPreviewDto;
import com.globits.richy.dto.QuestionImportResultDto;
import com.globits.richy.dto.QuestionImportRowDto;
import com.globits.richy.dto.QuestionImportStatus;
import com.globits.richy.repository.QuestionRepository;
import com.globits.richy.repository.QuestionTopicRepository;
import com.globits.richy.repository.QuestionTypeRepository;
import com.globits.richy.repository.TopicRepository;
import com.globits.richy.service.QuestionExcelImportService;
import com.globits.security.domain.User;
import com.globits.security.repository.UserRepository;
import com.globits.richy.dto.QuestionImportCandidateDto;
@Service
public class QuestionExcelImportServiceImpl
        implements QuestionExcelImportService {

    private static final Long FLASH_CARD_TYPE_ID = 6L;
    private static final int MAX_IMPORT_ROWS = 5000;
    private static final int MAX_TEXT_LENGTH = 200;
    private static final long MAX_QUESTIONS_PER_USER = 20000L;

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private QuestionTopicRepository questionTopicRepository;

    @Autowired
    private QuestionTypeRepository questionTypeRepository;

    @Autowired
    private TopicRepository topicRepository;

    @Autowired
    private UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public QuestionImportPreviewDto preview(
            MultipartFile file,
            Long topicId) {

        validateFile(file);

        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();

        User currentUser = getCurrentUser(authentication);
        Topic topic = getAllowedTopic(
                topicId,
                currentUser,
                authentication
        );

        QuestionImportPreviewDto preview =
                new QuestionImportPreviewDto();

        preview.setTopicId(topic.getId());
        preview.setTopicName(topic.getName());

        List<QuestionImportRowDto> rows = readExcel(file);

        Map<String, List<QuestionImportExistingDto>> existingMap =
                loadExistingMap(currentUser.getId());

        Set<Long> questionIdsInTopic =
                loadQuestionIdsInTopic(topicId);

        Set<String> wordsSeenInFile = new HashSet<String>();

        for (QuestionImportRowDto row : rows) {

            String validationMessage = validateRow(row);

            if (validationMessage != null) {
                setRowStatus(
                        row,
                        QuestionImportStatus.INVALID,
                        validationMessage,
                        false
                );
                continue;
            }

            String normalizedWord = normalizeWord(row.getWord());

            if (wordsSeenInFile.contains(normalizedWord)) {
                setRowStatus(
                        row,
                        QuestionImportStatus.DUPLICATE_IN_FILE,
                        "Từ này bị trùng trong chính file Excel",
                        false
                );
                continue;
            }

            wordsSeenInFile.add(normalizedWord);

            List<QuestionImportExistingDto> existingQuestions =
                    existingMap.get(normalizedWord);

            if (existingQuestions == null
                    || existingQuestions.isEmpty()) {

                setRowStatus(
                        row,
                        QuestionImportStatus.NEW,
                        "Sẽ tạo flashcard mới",
                        true
                );

                continue;
            }

            if (existingQuestions.size() > 1) {

                List<QuestionImportCandidateDto> candidates =
                        new ArrayList<QuestionImportCandidateDto>();

                for (QuestionImportExistingDto existing
                        : existingQuestions) {

                    QuestionImportCandidateDto candidate =
                            new QuestionImportCandidateDto();

                    candidate.setId(existing.getId());
                    candidate.setWord(existing.getQuestion());
                    candidate.setPronounce(existing.getPronounce());
                    candidate.setMotherTongue(
                            existing.getMotherTongue()
                    );

                    candidate.setAlreadyInTopic(
                            questionIdsInTopic.contains(
                                    existing.getId()
                            )
                    );

                    candidates.add(candidate);
                }

                row.setCandidates(candidates);

                /*
                 * Chưa chọn candidate nên chưa cho import.
                 */
                row.setSelectedExistingQuestionId(null);

                setRowStatus(
                        row,
                        QuestionImportStatus.CONFLICT,
                        "Có nhiều flashcard trùng. Hãy chọn một flashcard bên dưới",
                        false
                );

                continue;
            }

            QuestionImportExistingDto existing =
                    existingQuestions.get(0);

            row.setExistingQuestionId(existing.getId());

            if (questionIdsInTopic.contains(existing.getId())) {
                setRowStatus(
                        row,
                        QuestionImportStatus.ALREADY_IN_TOPIC,
                        "Flashcard đã thuộc topic này",
                        false
                );
            } else {
                setRowStatus(
                        row,
                        QuestionImportStatus.ADD_TOPIC,
                        "Flashcard đã tồn tại, sẽ gán thêm topic",
                        true
                );
            }
        }

        preview.setRows(rows);
        preview.setTotalRows(rows.size());

        calculatePreviewCounters(preview);

        preview.setMessage("Đọc file Excel thành công");

        return preview;
    }

    @Override
    @Transactional
    public QuestionImportResultDto confirm(
            QuestionImportConfirmDto dto) {

        if (dto == null) {
            throw new IllegalArgumentException(
                    "Dữ liệu xác nhận import không hợp lệ"
            );
        }

        if (dto.getTopicId() == null) {
            throw new IllegalArgumentException(
                    "Topic ID không được để trống"
            );
        }

        if (dto.getRows() == null || dto.getRows().isEmpty()) {
            throw new IllegalArgumentException(
                    "Không có dòng nào được chọn để import"
            );
        }

        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();

        User currentPrincipal = getCurrentUser(authentication);

        User currentUser =
                userRepository.findOne(currentPrincipal.getId());

        if (currentUser == null) {
            throw new IllegalArgumentException(
                    "Không tìm thấy người dùng hiện tại"
            );
        }

        Topic topic = getAllowedTopic(
                dto.getTopicId(),
                currentUser,
                authentication
        );

        QuestionType flashCardType =
                questionTypeRepository.findOne(FLASH_CARD_TYPE_ID);

        if (flashCardType == null) {
            throw new IllegalArgumentException(
                    "Không tìm thấy QuestionType Flash card ID = 6"
            );
        }

        /*
         * Không tin dữ liệu status từ client.
         * Backend sẽ kiểm tra lại toàn bộ.
         */
        LinkedHashMap<String, QuestionImportRowDto> uniqueRows =
                new LinkedHashMap<String, QuestionImportRowDto>();

        int invalidRequestRows = 0;

        for (QuestionImportRowDto row : dto.getRows()) {

            String validationMessage = validateRow(row);

            if (validationMessage != null) {
                invalidRequestRows++;
                continue;
            }

            String normalizedWord = normalizeWord(row.getWord());

            if (!uniqueRows.containsKey(normalizedWord)) {
                uniqueRows.put(normalizedWord, row);
            }
        }

        Map<String, List<QuestionImportExistingDto>> existingMap =
                loadExistingMap(currentUser.getId());

        Set<Long> questionIdsInTopic =
                loadQuestionIdsInTopic(topic.getId());

        int numberToCreate = 0;

        for (Map.Entry<String, QuestionImportRowDto> entry
                : uniqueRows.entrySet()) {

            List<QuestionImportExistingDto> existing =
                    existingMap.get(entry.getKey());

            if (existing == null || existing.isEmpty()) {
                numberToCreate++;
            }
        }

        Long currentQuestionCount =
                questionRepository.countByUserId(currentUser.getId());

        if (currentQuestionCount == null) {
            currentQuestionCount = 0L;
        }

        if (currentQuestionCount + numberToCreate
                > MAX_QUESTIONS_PER_USER) {

            throw new IllegalArgumentException(
                    "Import này vượt quá giới hạn 20.000 words"
            );
        }

        QuestionImportResultDto result =
                new QuestionImportResultDto();

        result.setErrorCount(invalidRequestRows);

        LocalDateTime now = LocalDateTime.now();
        String username = currentUser.getUsername();

        for (Map.Entry<String, QuestionImportRowDto> entry
                : uniqueRows.entrySet()) {

            String normalizedWord = entry.getKey();
            QuestionImportRowDto row = entry.getValue();

            List<QuestionImportExistingDto> existingQuestions =
                    existingMap.get(normalizedWord);

            if (existingQuestions != null
                    && existingQuestions.size() > 1) {

                Long selectedQuestionId =
                        row.getSelectedExistingQuestionId();

                /*
                 * Người dùng chưa chọn Question.
                 */
                if (selectedQuestionId == null) {
                    result.setErrorCount(
                            result.getErrorCount() + 1
                    );
                    continue;
                }

                /*
                 * Kiểm tra ID được chọn có thực sự thuộc nhóm
                 * các Question trùng word hay không.
                 */
                QuestionImportExistingDto selectedCandidate = null;

                for (QuestionImportExistingDto candidate
                        : existingQuestions) {

                    if (selectedQuestionId.equals(
                            candidate.getId())) {

                        selectedCandidate = candidate;
                        break;
                    }
                }

                if (selectedCandidate == null) {
                    result.setErrorCount(
                            result.getErrorCount() + 1
                    );
                    continue;
                }

                Question selectedQuestion =
                        questionRepository.findOne(
                                selectedQuestionId
                        );

                if (selectedQuestion == null) {
                    result.setErrorCount(
                            result.getErrorCount() + 1
                    );
                    continue;
                }

                /*
                 * Không cho chọn Question của user khác.
                 */
                if (selectedQuestion.getUser() == null
                        || selectedQuestion.getUser().getId() == null
                        || !currentUser.getId().equals(
                                selectedQuestion.getUser().getId()
                        )) {

                    result.setErrorCount(
                            result.getErrorCount() + 1
                    );
                    continue;
                }

                /*
                 * Question phải là flashcard.
                 */
                if (selectedQuestion.getQuestionType() == null
                        || selectedQuestion.getQuestionType().getId() == null
                        || !FLASH_CARD_TYPE_ID.equals(
                                selectedQuestion
                                        .getQuestionType()
                                        .getId()
                        )) {

                    result.setErrorCount(
                            result.getErrorCount() + 1
                    );
                    continue;
                }

                /*
                 * Word của Question được chọn phải giống word import.
                 */
                if (!normalizedWord.equals(
                        normalizeWord(
                                selectedQuestion.getQuestion()
                        ))) {

                    result.setErrorCount(
                            result.getErrorCount() + 1
                    );
                    continue;
                }

                Long topicCount =
                        questionTopicRepository
                                .countByQuestionIdAndTopicId(
                                        selectedQuestion.getId(),
                                        topic.getId()
                                );

                /*
                 * Đã có topic thì không tạo QuestionTopic mới.
                 */
                if (topicCount != null && topicCount > 0) {
                    result.setSkippedCount(
                            result.getSkippedCount() + 1
                    );
                    continue;
                }

                /*
                 * Chỉ điền dữ liệu nếu trường cũ đang trống.
                 * Không ghi đè nghĩa và phát âm đã tồn tại.
                 */
                if (dto.isUpdateEmptyFields()) {

                    boolean changed = false;

                    if (isBlank(selectedQuestion.getPronounce())
                            && !isBlank(row.getPronounce())) {

                        selectedQuestion.setPronounce(
                                cleanText(row.getPronounce())
                        );

                        changed = true;
                    }

                    String importedMotherTongue =
                            getImportedMotherTongue(row);

                    if (isBlank(
                            selectedQuestion.getMotherTongue())
                            && !isBlank(importedMotherTongue)) {

                        selectedQuestion.setMotherTongue(
                                cleanText(importedMotherTongue)
                        );

                        changed = true;
                    }

                    if (changed) {
                        selectedQuestion.setModifiedBy(username);
                        selectedQuestion.setModifyDate(now);

                        questionRepository.save(
                                selectedQuestion
                        );
                    }
                }

                createQuestionTopic(
                        selectedQuestion,
                        topic,
                        username,
                        now
                );

                result.setTopicAddedCount(
                        result.getTopicAddedCount() + 1
                );

                continue;
            }

            if (existingQuestions != null
                    && existingQuestions.size() == 1) {

                QuestionImportExistingDto existingDto =
                        existingQuestions.get(0);

                Long existingQuestionId = existingDto.getId();

                Long topicCount =
                        questionTopicRepository
                                .countByQuestionIdAndTopicId(
                                        existingQuestionId,
                                        topic.getId()
                                );

                if (topicCount != null && topicCount > 0) {
                    result.setSkippedCount(
                            result.getSkippedCount() + 1
                    );
                    continue;
                }

                Question existingQuestion =
                        questionRepository.findOne(
                                existingQuestionId
                        );

                if (existingQuestion == null) {
                    result.setErrorCount(
                            result.getErrorCount() + 1
                    );
                    continue;
                }

                boolean questionChanged = false;

                if (dto.isUpdateEmptyFields()) {

                    if (isBlank(existingQuestion.getPronounce())
                            && !isBlank(row.getPronounce())) {

                        existingQuestion.setPronounce(
                                cleanText(row.getPronounce())
                        );

                        questionChanged = true;
                    }

                    String importedMotherTongue =
                            getImportedMotherTongue(row);

                    if (isBlank(existingQuestion.getMotherTongue())
                            && !isBlank(importedMotherTongue)) {

                        existingQuestion.setMotherTongue(
                                cleanText(importedMotherTongue)
                        );

                        questionChanged = true;
                    }
                }

                if (questionChanged) {
                    existingQuestion.setModifiedBy(username);
                    existingQuestion.setModifyDate(now);

                    questionRepository.save(existingQuestion);
                }

                createQuestionTopic(
                        existingQuestion,
                        topic,
                        username,
                        now
                );

                questionIdsInTopic.add(existingQuestionId);

                result.setTopicAddedCount(
                        result.getTopicAddedCount() + 1
                );

                continue;
            }

            Question question = new Question();

            question.setQuestion(cleanText(row.getWord()));
            question.setPronounce(cleanText(row.getPronounce()));
            question.setMotherTongue(
                    cleanText(getImportedMotherTongue(row))
            );

            question.setQuestionType(flashCardType);
            question.setUser(currentUser);

            question.setStatus(1);
            question.setType(1);

            question.setCreateDate(now);
            question.setCreatedBy(username);

            question = questionRepository.save(question);

            createQuestionTopic(
                    question,
                    topic,
                    username,
                    now
            );

            QuestionImportExistingDto newExisting =
                    new QuestionImportExistingDto(
                            question.getId(),
                            question.getQuestion(),
                            question.getPronounce(),
                            question.getMotherTongue()
                    );

            List<QuestionImportExistingDto> newList =
                    new ArrayList<QuestionImportExistingDto>();

            newList.add(newExisting);
            existingMap.put(normalizedWord, newList);

            result.setCreatedCount(
                    result.getCreatedCount() + 1
            );
        }

        result.setSuccess(true);

        result.setMessage(
                "Import thành công: tạo mới "
                        + result.getCreatedCount()
                        + ", thêm topic "
                        + result.getTopicAddedCount()
                        + ", bỏ qua "
                        + result.getSkippedCount()
                        + ", lỗi "
                        + result.getErrorCount()
        );

        return result;
    }

    private List<QuestionImportRowDto> readExcel(
            MultipartFile file) {

        List<QuestionImportRowDto> rows =
                new ArrayList<QuestionImportRowDto>();

        try (
                InputStream inputStream = file.getInputStream();
                Workbook workbook =
                        WorkbookFactory.create(inputStream)
        ) {

            if (workbook.getNumberOfSheets() <= 0) {
                throw new IllegalArgumentException(
                        "File Excel không có sheet"
                );
            }

            Sheet sheet = workbook.getSheetAt(0);

            Row headerRow = sheet.getRow(0);

            if (headerRow == null) {
                throw new IllegalArgumentException(
                        "File Excel không có dòng tiêu đề"
                );
            }

            DataFormatter formatter = new DataFormatter();

            FormulaEvaluator evaluator =
                    workbook.getCreationHelper()
                            .createFormulaEvaluator();

            Map<String, Integer> headerIndexes =
                    resolveHeaderIndexes(
                            headerRow,
                            formatter,
                            evaluator
                    );

            Integer wordIndex = headerIndexes.get("word");
            Integer pronounceIndex =
                    headerIndexes.get("pronounce");
            Integer firstLanguageIndex =
                    headerIndexes.get("firstLanguage");

            if (wordIndex == null) {
                throw new IllegalArgumentException(
                        "Không tìm thấy cột word"
                );
            }

            if (pronounceIndex == null) {
                throw new IllegalArgumentException(
                        "Không tìm thấy cột pronounce"
                );
            }

            if (firstLanguageIndex == null) {
                throw new IllegalArgumentException(
                        "Không tìm thấy cột first language"
                );
            }

            int lastRowNumber = sheet.getLastRowNum();

            if (lastRowNumber > MAX_IMPORT_ROWS) {
                throw new IllegalArgumentException(
                        "Chỉ được import tối đa "
                                + MAX_IMPORT_ROWS
                                + " dòng"
                );
            }

            /*
             * Dòng 1 của Excel là header.
             * POI index 0.
             * Dữ liệu bắt đầu từ index 1.
             */
            for (int rowIndex = 1;
                 rowIndex <= lastRowNumber;
                 rowIndex++) {

                Row excelRow = sheet.getRow(rowIndex);

                if (excelRow == null) {
                    continue;
                }

                String word = getCellValue(
                        excelRow,
                        wordIndex,
                        formatter,
                        evaluator
                );

                String pronounce = getCellValue(
                        excelRow,
                        pronounceIndex,
                        formatter,
                        evaluator
                );

                String firstLanguage = getCellValue(
                        excelRow,
                        firstLanguageIndex,
                        formatter,
                        evaluator
                );

                if (isBlank(word)
                        && isBlank(pronounce)
                        && isBlank(firstLanguage)) {
                    continue;
                }

                QuestionImportRowDto row =
                        new QuestionImportRowDto();

                /*
                 * Hiển thị đúng số dòng Excel:
                 * POI index 1 tương ứng dòng Excel số 2.
                 */
                row.setRowNumber(rowIndex + 1);
                row.setWord(cleanText(word));
                row.setPronounce(cleanText(pronounce));
                row.setFirstLanguage(
                        cleanText(firstLanguage)
                );

                rows.add(row);
            }

            return rows;

        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException(
                    "Không thể đọc file Excel: "
                            + e.getMessage()
            );
        }
    }

    private Map<String, Integer> resolveHeaderIndexes(
            Row headerRow,
            DataFormatter formatter,
            FormulaEvaluator evaluator) {

        Map<String, Integer> indexes =
                new HashMap<String, Integer>();

        for (int i = 0;
             i < headerRow.getLastCellNum();
             i++) {

            String header = getCellValue(
                    headerRow,
                    i,
                    formatter,
                    evaluator
            );

            String normalizedHeader =
                    normalizeHeader(header);

            if ("word".equals(normalizedHeader)
                    || "question".equals(normalizedHeader)) {

                indexes.put("word", i);
            }

            if ("pronounce".equals(normalizedHeader)
                    || "pronouce".equals(normalizedHeader)
                    || "pronunciation".equals(normalizedHeader)) {

                indexes.put("pronounce", i);
            }

            if ("firstlanguage".equals(normalizedHeader)
                    || "mothertongue".equals(normalizedHeader)) {

                indexes.put("firstLanguage", i);
            }
        }

        return indexes;
    }

    private String getCellValue(
            Row row,
            Integer columnIndex,
            DataFormatter formatter,
            FormulaEvaluator evaluator) {

        if (row == null || columnIndex == null) {
            return "";
        }

        if (row.getCell(columnIndex) == null) {
            return "";
        }

        return formatter.formatCellValue(
                row.getCell(columnIndex),
                evaluator
        ).trim();
    }

    private Map<String, List<QuestionImportExistingDto>>
    loadExistingMap(Long userId) {

        List<QuestionImportExistingDto> existingList =
                questionRepository.findForExcelImport(
                        userId,
                        FLASH_CARD_TYPE_ID
                );

        Map<String, List<QuestionImportExistingDto>> map =
                new HashMap<String, List<QuestionImportExistingDto>>();

        if (existingList == null) {
            return map;
        }

        for (QuestionImportExistingDto existing
                : existingList) {

            String normalizedWord =
                    normalizeWord(existing.getQuestion());

            if (isBlank(normalizedWord)) {
                continue;
            }

            List<QuestionImportExistingDto> sameWords =
                    map.get(normalizedWord);

            if (sameWords == null) {
                sameWords =
                        new ArrayList<QuestionImportExistingDto>();

                map.put(normalizedWord, sameWords);
            }

            sameWords.add(existing);
        }

        return map;
    }

    private Set<Long> loadQuestionIdsInTopic(
            Long topicId) {

        List<Long> ids =
                questionTopicRepository
                        .findQuestionIdsByTopicId(topicId);

        if (ids == null) {
            return new HashSet<Long>();
        }

        return new HashSet<Long>(ids);
    }

    private void createQuestionTopic(
            Question question,
            Topic topic,
            String username,
            LocalDateTime now) {

        QuestionTopic questionTopic =
                new QuestionTopic();

        questionTopic.setQuestion(question);
        questionTopic.setTopic(topic);

        questionTopic.setCreateDate(now);
        questionTopic.setCreatedBy(username);

        questionTopicRepository.save(questionTopic);
    }

    private void validateFile(MultipartFile file) {

        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException(
                    "Bạn chưa chọn file Excel"
            );
        }

        String filename = file.getOriginalFilename();

        if (filename == null) {
            throw new IllegalArgumentException(
                    "Tên file không hợp lệ"
            );
        }

        String lowerFilename =
                filename.toLowerCase(Locale.ENGLISH);

        if (!lowerFilename.endsWith(".xlsx")
                && !lowerFilename.endsWith(".xls")) {

            throw new IllegalArgumentException(
                    "Chỉ chấp nhận file .xlsx hoặc .xls"
            );
        }
    }

    private String validateRow(
            QuestionImportRowDto row) {

        if (row == null) {
            return "Dòng dữ liệu bị null";
        }

        if (isBlank(row.getWord())) {
            return "Word không được để trống";
        }

        if (cleanText(row.getWord()).length()
                > MAX_TEXT_LENGTH) {

            return "Word vượt quá 200 ký tự";
        }

        if (!isBlank(row.getPronounce())
                && cleanText(row.getPronounce()).length()
                > MAX_TEXT_LENGTH) {

            return "Pronounce vượt quá 200 ký tự";
        }

        String motherTongue =
                getImportedMotherTongue(row);

        if (!isBlank(motherTongue)
                && cleanText(motherTongue).length()
                > MAX_TEXT_LENGTH) {

            return "First language vượt quá 200 ký tự";
        }

        return null;
    }

    private void setRowStatus(
            QuestionImportRowDto row,
            QuestionImportStatus status,
            String message,
            boolean importable) {

        row.setStatus(status);
        row.setMessage(message);
        row.setImportable(importable);
        row.setSelected(importable);
    }

    private void calculatePreviewCounters(
            QuestionImportPreviewDto preview) {

        for (QuestionImportRowDto row
                : preview.getRows()) {

            if (row.getStatus() == null) {
                continue;
            }

            switch (row.getStatus()) {

                case NEW:
                    preview.setNewCount(
                            preview.getNewCount() + 1
                    );
                    break;

                case ADD_TOPIC:
                    preview.setAddTopicCount(
                            preview.getAddTopicCount() + 1
                    );
                    break;

                case ALREADY_IN_TOPIC:
                    preview.setAlreadyInTopicCount(
                            preview.getAlreadyInTopicCount() + 1
                    );
                    break;

                case DUPLICATE_IN_FILE:
                    preview.setDuplicateInFileCount(
                            preview.getDuplicateInFileCount() + 1
                    );
                    break;

                case INVALID:
                    preview.setInvalidCount(
                            preview.getInvalidCount() + 1
                    );
                    break;

                case CONFLICT:
                    preview.setConflictCount(
                            preview.getConflictCount() + 1
                    );
                    break;

                default:
                    break;
            }
        }
    }

    private User getCurrentUser(
            Authentication authentication) {

        if (authentication == null
                || !authentication.isAuthenticated()) {

            throw new IllegalArgumentException(
                    "Người dùng chưa đăng nhập"
            );
        }

        Object principal = authentication.getPrincipal();

        if (!(principal instanceof User)) {
            throw new IllegalArgumentException(
                    "Không xác định được người dùng đăng nhập"
            );
        }

        User user = (User) principal;

        if (user.getId() == null) {
            throw new IllegalArgumentException(
                    "Người dùng không có ID"
            );
        }

        return user;
    }

    private Topic getAllowedTopic(
            Long topicId,
            User currentUser,
            Authentication authentication) {

        if (topicId == null) {
            throw new IllegalArgumentException(
                    "Bạn chưa chọn topic"
            );
        }

        Topic topic = topicRepository.findOne(topicId);

        if (topic == null) {
            throw new IllegalArgumentException(
                    "Không tìm thấy topic ID = " + topicId
            );
        }

        /*
         * Topic không có user được xem là topic dùng chung.
         */
        if (topic.getUser() == null
                || topic.getUser().getId() == null) {
            return topic;
        }

        if (topic.getUser().getId()
                .equals(currentUser.getId())) {
            return topic;
        }

        if (isAdmin(authentication)) {
            return topic;
        }

        throw new IllegalArgumentException(
                "Bạn không có quyền sử dụng topic này"
        );
    }

    private boolean isAdmin(
            Authentication authentication) {

        if (authentication == null
                || authentication.getAuthorities() == null) {
            return false;
        }

        for (GrantedAuthority authority
                : authentication.getAuthorities()) {

            if (authority != null
                    && "ROLE_ADMIN".equals(
                            authority.getAuthority()
                    )) {
                return true;
            }
        }

        return false;
    }

    private String getImportedMotherTongue(
            QuestionImportRowDto row) {

        if (row == null) {
            return null;
        }

        if (!isBlank(row.getMotherTongue())) {
            return row.getMotherTongue();
        }

        return row.getFirstLanguage();
    }

    private String normalizeWord(String word) {

        if (word == null) {
            return "";
        }

        return word
                .trim()
                .replaceAll("\\s+", " ")
                .toLowerCase(Locale.ENGLISH);
    }

    private String normalizeHeader(String header) {

        if (header == null) {
            return "";
        }

        return header
                .trim()
                .toLowerCase(Locale.ENGLISH)
                .replaceAll("[\\s_\\-]+", "");
    }

    private String cleanText(String text) {

        if (text == null) {
            return null;
        }

        String cleaned = text
                .trim()
                .replaceAll("\\s+", " ");

        return cleaned.length() == 0
                ? null
                : cleaned;
    }

    private boolean isBlank(String text) {
        return text == null || text.trim().isEmpty();
    }
}