package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import com.globits.richy.domain.EnrolmentClass;
import com.globits.security.domain.User;
import com.globits.security.dto.UserDto;

public class EnrolmentClassDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long id;
    private String name;
    private String code;
    private Integer schoolId;
    private Long parentId;
    private String parentName;
    private Set<Long> teacherIds = new LinkedHashSet<Long>();
    private List<UserDto> teachers = new ArrayList<UserDto>();
    private Long primaryTeacherId;
    // Null means a legacy client sent only teacherIds.
    private Set<Long> deputyTeacherIds;

    public Long getPrimaryTeacherId() {
        return primaryTeacherId;
    }

    public void setPrimaryTeacherId(Long primaryTeacherId) {
        this.primaryTeacherId = primaryTeacherId;
    }

    public Set<Long> getDeputyTeacherIds() {
        return deputyTeacherIds;
    }

    public void setDeputyTeacherIds(Set<Long> deputyTeacherIds) {
        this.deputyTeacherIds = deputyTeacherIds;
    }
    private int childCount;
    private boolean canManageTeams;
    private boolean canEdit;
    private boolean canAddChild;
    private String textSearch;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public Integer getSchoolId() {
        return schoolId;
    }

    public void setSchoolId(Integer schoolId) {
        this.schoolId = schoolId;
    }

    public Long getParentId() {
        return parentId;
    }

    public void setParentId(Long parentId) {
        this.parentId = parentId;
    }

    public String getParentName() {
        return parentName;
    }

    public void setParentName(String parentName) {
        this.parentName = parentName;
    }

    public Set<Long> getTeacherIds() {
        return teacherIds;
    }

    public void setTeacherIds(Set<Long> teacherIds) {
        this.teacherIds = teacherIds;
    }

    public List<UserDto> getTeachers() {
        return teachers;
    }

    public void setTeachers(List<UserDto> teachers) {
        this.teachers = teachers;
    }

    public int getChildCount() {
        return childCount;
    }

    public void setChildCount(int childCount) {
        this.childCount = childCount;
    }

    public boolean isCanManageTeams() {
        return canManageTeams;
    }

    public void setCanManageTeams(boolean canManageTeams) {
        this.canManageTeams = canManageTeams;
    }

    public boolean isCanEdit() {
        return canEdit;
    }

    public void setCanEdit(boolean canEdit) {
        this.canEdit = canEdit;
    }

    public boolean isCanAddChild() {
        return canAddChild;
    }

    public void setCanAddChild(boolean canAddChild) {
        this.canAddChild = canAddChild;
    }

    public String getTextSearch() {
        return textSearch;
    }

    public void setTextSearch(String textSearch) {
        this.textSearch = textSearch;
    }

    public EnrolmentClassDto() {
    }

    public EnrolmentClassDto(EnrolmentClass domain) {
        this.id = domain.getId();
        this.name = domain.getName();
        this.code = domain.getCode();
        this.schoolId = domain.getSchoolId();
        if (domain.getParent() != null) {
            this.parentId = domain.getParent().getId();
            this.parentName = domain.getParent().getName();
        }
        if (domain.getTeachers() != null) {
            for (User teacher : domain.getTeachers()) {
                this.teacherIds.add(teacher.getId());
                this.teachers.add(new UserDto(teacher, true));
            }
        }
        this.primaryTeacherId = teacherIds.contains(domain.getPrimaryTeacherId())
                ? domain.getPrimaryTeacherId() : null;
        this.deputyTeacherIds = new LinkedHashSet<Long>(teacherIds);
        this.deputyTeacherIds.remove(this.primaryTeacherId);
    }
}
