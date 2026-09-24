package com.globits.richy.service.writing;

import com.globits.richy.dto.TestResultDto;

public interface WritingGradingService {
    TestResultDto grade(Long testResultId);
}
