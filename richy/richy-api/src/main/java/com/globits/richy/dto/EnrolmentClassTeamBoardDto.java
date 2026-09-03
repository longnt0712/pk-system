package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

import com.globits.security.dto.UserDto;

public class EnrolmentClassTeamBoardDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long classId;
    private String className;
    private boolean canManage;
    private int totalStudents;
    private List<UserDto> unassignedStudents = new ArrayList<UserDto>();
    private List<EnrolmentClassTeamDto> teams = new ArrayList<EnrolmentClassTeamDto>();

    public Long getClassId() {
        return classId;
    }

    public void setClassId(Long classId) {
        this.classId = classId;
    }

    public String getClassName() {
        return className;
    }

    public void setClassName(String className) {
        this.className = className;
    }

    public boolean isCanManage() {
        return canManage;
    }

    public void setCanManage(boolean canManage) {
        this.canManage = canManage;
    }

    public int getTotalStudents() {
        return totalStudents;
    }

    public void setTotalStudents(int totalStudents) {
        this.totalStudents = totalStudents;
    }

    public List<UserDto> getUnassignedStudents() {
        return unassignedStudents;
    }

    public void setUnassignedStudents(List<UserDto> unassignedStudents) {
        this.unassignedStudents = unassignedStudents;
    }

    public List<EnrolmentClassTeamDto> getTeams() {
        return teams;
    }

    public void setTeams(List<EnrolmentClassTeamDto> teams) {
        this.teams = teams;
    }
}
