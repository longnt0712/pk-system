package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

import com.globits.richy.domain.StudentMark;
import com.globits.security.dto.UserDto;

public class DisplayStudentMarkDto implements Serializable {
    private Long id;
    private UserDto user;
    private List<StudentMarkDto> studentMarks = new ArrayList<StudentMarkDto>();
    private String textSearch;
    private Integer enrollmentClass;
    private Long educationProgramId;

    public DisplayStudentMarkDto() {
    }

    public DisplayStudentMarkDto(StudentMark domain) {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public UserDto getUser() {
        return user;
    }

    public void setUser(UserDto user) {
        this.user = user;
    }

    public List<StudentMarkDto> getStudentMarks() {
        return studentMarks;
    }

    public void setStudentMarks(List<StudentMarkDto> studentMarks) {
        this.studentMarks = studentMarks;
    }

    public String getTextSearch() {
        return textSearch;
    }

    public void setTextSearch(String textSearch) {
        this.textSearch = textSearch;
    }

    public Integer getEnrollmentClass() {
        return enrollmentClass;
    }

    public void setEnrollmentClass(Integer enrollmentClass) {
        this.enrollmentClass = enrollmentClass;
    }

    public Long getEducationProgramId() {
        return educationProgramId;
    }

    public void setEducationProgramId(Long educationProgramId) {
        this.educationProgramId = educationProgramId;
    }
}