package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

public class PersonDateBulkCreateDto implements Serializable {
    private static final long serialVersionUID = 1L;
    private String attendanceDate;
    private Integer schoolId;
    private List<Long> classIds = new ArrayList<Long>();

    public String getAttendanceDate() { return attendanceDate; }
    public void setAttendanceDate(String value) { attendanceDate = value; }
    public Integer getSchoolId() { return schoolId; }
    public void setSchoolId(Integer value) { schoolId = value; }
    public List<Long> getClassIds() { return classIds; }
    public void setClassIds(List<Long> value) { classIds = value; }
}