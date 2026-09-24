package com.globits.richy.service.writing;

import java.util.ArrayList;
import java.util.List;

public class WritingGradingRequest {
    private Long testResultId;
    private String testName;
    private List<WritingGradingTask> tasks = new ArrayList<WritingGradingTask>();

    public Long getTestResultId() { return testResultId; }
    public void setTestResultId(Long value) { testResultId = value; }
    public String getTestName() { return testName; }
    public void setTestName(String value) { testName = value; }
    public List<WritingGradingTask> getTasks() { return tasks; }
    public void setTasks(List<WritingGradingTask> value) { tasks = value; }
}
