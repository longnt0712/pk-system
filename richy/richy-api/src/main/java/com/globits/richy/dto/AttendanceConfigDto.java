package com.globits.richy.dto;

import com.globits.richy.domain.AttendanceConfig;

public class AttendanceConfigDto {
    private String massStartTime;
    private Integer massLateMinutes;
    private Boolean massAutoLate;
    private String classStartTime;
    private Integer classLateMinutes;
    private Boolean classAutoLate;
    private String qrSwitchTime;
    private Long serverTimeMillis;

    public AttendanceConfigDto() { }

    public AttendanceConfigDto(AttendanceConfig config) {
        massStartTime = config == null ? "08:00" : config.getMassStartTime();
        massLateMinutes = config == null ? 5 : config.getMassLateMinutes();
        massAutoLate = config == null ? Boolean.TRUE : config.getMassAutoLate();
        classStartTime = config == null ? "09:00" : config.getClassStartTime();
        classLateMinutes = config == null ? 15 : config.getClassLateMinutes();
        classAutoLate = config == null ? Boolean.FALSE : config.getClassAutoLate();
        qrSwitchTime = config == null ? "09:00" : config.getQrSwitchTime();
    }

    public String getMassStartTime() { return massStartTime; }
    public void setMassStartTime(String value) { massStartTime = value; }
    public Integer getMassLateMinutes() { return massLateMinutes; }
    public void setMassLateMinutes(Integer value) { massLateMinutes = value; }
    public Boolean getMassAutoLate() { return massAutoLate; }
    public void setMassAutoLate(Boolean value) { massAutoLate = value; }
    public String getClassStartTime() { return classStartTime; }
    public void setClassStartTime(String value) { classStartTime = value; }
    public Integer getClassLateMinutes() { return classLateMinutes; }
    public void setClassLateMinutes(Integer value) { classLateMinutes = value; }
    public Boolean getClassAutoLate() { return classAutoLate; }
    public void setClassAutoLate(Boolean value) { classAutoLate = value; }
    public String getQrSwitchTime() { return qrSwitchTime; }
    public void setQrSwitchTime(String value) { qrSwitchTime = value; }
    public Long getServerTimeMillis() { return serverTimeMillis; }
    public void setServerTimeMillis(Long value) { serverTimeMillis = value; }
}
