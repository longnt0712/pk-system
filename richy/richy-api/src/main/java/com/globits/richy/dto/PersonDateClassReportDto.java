package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

public class PersonDateClassReportDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private Long classId;
    private String className;
    private int totalStudents;
    private int existingStudents;
    private int createdStudents;
    private List<String> missingStudentNames = new ArrayList<String>();

    public Long getClassId() { return classId; }
    public void setClassId(Long value) { classId = value; }
    public String getClassName() { return className; }
    public void setClassName(String value) { className = value; }
    public int getTotalStudents() { return totalStudents; }
    public void setTotalStudents(int value) { totalStudents = value; }
    public int getExistingStudents() { return existingStudents; }
    public void setExistingStudents(int value) { existingStudents = value; }
    public int getCreatedStudents() { return createdStudents; }
    public void setCreatedStudents(int value) { createdStudents = value; }
    public List<String> getMissingStudentNames() { return missingStudentNames; }
    public void setMissingStudentNames(List<String> value) {
        missingStudentNames = value == null ? new ArrayList<String>() : value;
    }
    public boolean isComplete() { return existingStudents >= totalStudents; }
}