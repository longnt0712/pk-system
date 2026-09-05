package com.globits.richy.dto;

import java.io.Serializable;
import java.util.Date;

import com.globits.richy.domain.TestResult;

/**
 * Lightweight test-result data used by the monthly study calendar.
 *
 * Keeping this DTO separate prevents the calendar request from loading every
 * question/answer detail that belongs to a test result.
 */
public class TestResultStudyCalendarItemDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long id;
    private Date testDate;
    private String testName;
    private Integer testType;

    public TestResultStudyCalendarItemDto() {
    }

    public TestResultStudyCalendarItemDto(TestResult domain) {
        if (domain == null) {
            return;
        }

        this.id = domain.getId();
        this.testDate = domain.getCreateDate() != null
                ? domain.getCreateDate().toDate()
                : null;
        this.testName = domain.getTestName();
        this.testType = domain.getTestType();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Date getTestDate() {
        return testDate;
    }

    public void setTestDate(Date testDate) {
        this.testDate = testDate;
    }

    public String getTestName() {
        return testName;
    }

    public void setTestName(String testName) {
        this.testName = testName;
    }

    public Integer getTestType() {
        return testType;
    }

    public void setTestType(Integer testType) {
        this.testType = testType;
    }
}
