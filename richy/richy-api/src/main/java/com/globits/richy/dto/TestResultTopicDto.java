package com.globits.richy.dto;
import java.io.Serializable;
import com.globits.richy.domain.Topic;

/** Current topic name resolved from the persisted ID, not a title snapshot. */
public class TestResultTopicDto implements Serializable {
    private static final long serialVersionUID = 1L;
    private Long id;
    private String name;
    public TestResultTopicDto() { }
    public TestResultTopicDto(Topic topic) { id = topic.getId(); name = topic.getName(); }
    public Long getId() { return id; }
    public void setId(Long value) { id = value; }
    public String getName() { return name; }
    public void setName(String value) { name = value; }
}
