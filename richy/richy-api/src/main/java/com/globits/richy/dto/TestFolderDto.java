package com.globits.richy.dto;

import com.globits.richy.domain.TestFolder;

public class TestFolderDto {
    private Long id;
    private String name;
    private Long parentId;
    private boolean canManage;
    private Long ownerId;
    private String ownerName;
    public Long getOwnerId() { return ownerId; }
    public String getOwnerName() { return ownerName; }
    public TestFolderDto() { }
    public TestFolderDto(TestFolder folder) {
        id = folder.getId(); name = folder.getName();
        parentId = folder.getParent() == null ? null : folder.getParent().getId();
        if (folder.getOwner() != null) { ownerId = folder.getOwner().getId(); ownerName = folder.getOwner().getUsername(); }
    }
    public Long getId() { return id; }
    public void setId(Long value) { id = value; }
    public String getName() { return name; }
    public void setName(String value) { name = value; }
    public Long getParentId() { return parentId; }
    public void setParentId(Long value) { parentId = value; }
    public boolean isCanManage() { return canManage; }
    public void setCanManage(boolean value) { canManage = value; }
}
