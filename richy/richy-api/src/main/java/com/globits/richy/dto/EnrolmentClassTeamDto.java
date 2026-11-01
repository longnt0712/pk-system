package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

import com.globits.security.dto.UserDto;

public class EnrolmentClassTeamDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long id;
    private String name;
    private String code;
    private String gender;
    private String leadershipKey;
    private Long captainId;
    private List<Long> deputyIds = new ArrayList<Long>();
    public String getGender() { return gender; }
    public void setGender(String value) { gender = value; }
    public String getLeadershipKey() { return leadershipKey; }
    public void setLeadershipKey(String value) { leadershipKey = value; }
    public Long getCaptainId() { return captainId; }
    public void setCaptainId(Long value) { captainId = value; }
    public List<Long> getDeputyIds() { return deputyIds; }
    public void setDeputyIds(List<Long> value) { deputyIds = value; }
    private List<UserDto> students = new ArrayList<UserDto>();

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

    public List<UserDto> getStudents() {
        return students;
    }

    public void setStudents(List<UserDto> students) {
        this.students = students;
    }
}
