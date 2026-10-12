package com.globits.richy.domain;

import com.globits.core.domain.BaseObject;
import com.globits.security.domain.User;
import javax.persistence.*;

@Entity
@Table(name = "tbl_test_folder")
public class TestFolder extends BaseObject {
    @Column(name = "name", nullable = false, length = 200)
    private String name;
    @Column(name = "test_mode", nullable = false, length = 20)
    private String testMode = "COMPREHENSIVE";
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private TestFolder parent;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;
    public User getOwner() { return owner; }
    public void setOwner(User value) { owner = value; }
    public String getName() { return name; }
    public void setName(String value) { name = value; }
    public String getTestMode() { return testMode == null ? "COMPREHENSIVE" : testMode; }
    public void setTestMode(String value) { testMode = value; }
    public TestFolder getParent() { return parent; }
    public void setParent(TestFolder value) { parent = value; }
}
