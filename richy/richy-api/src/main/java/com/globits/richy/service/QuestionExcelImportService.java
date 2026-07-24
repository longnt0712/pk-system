package com.globits.richy.service;

import org.springframework.web.multipart.MultipartFile;

import com.globits.richy.dto.QuestionImportConfirmDto;
import com.globits.richy.dto.QuestionImportPreviewDto;
import com.globits.richy.dto.QuestionImportResultDto;

public interface QuestionExcelImportService {

    QuestionImportPreviewDto preview(
            MultipartFile file,
            Long topicId
    );

    QuestionImportResultDto confirm(
            QuestionImportConfirmDto dto
    );
}