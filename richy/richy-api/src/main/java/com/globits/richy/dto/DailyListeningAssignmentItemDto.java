package com.globits.richy.dto;

import java.util.ArrayList;
import java.util.List;

public class DailyListeningAssignmentItemDto {
    private final Long id;
    private final String title;
    private final String testFormat;
    private final TestFolderDto testFolder;
    private final List<TopicForListAllDto> topics = new ArrayList<>();

    public DailyListeningAssignmentItemDto(Long id, String title, String testFormat, Long folderId) {
        this.id = id;
        this.title = title;
        this.testFormat = testFormat;
        this.testFolder = folderId == null ? null : new TestFolderDto();
        if (testFolder != null) { testFolder.setId(folderId); }
    }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public String getTestFormat() { return testFormat; }
    public TestFolderDto getTestFolder() { return testFolder; }
    public List<TopicForListAllDto> getTopics() { return topics; }
}
