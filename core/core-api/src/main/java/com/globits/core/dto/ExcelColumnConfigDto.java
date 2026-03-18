package com.globits.core.dto;

public class ExcelColumnConfigDto {
	
	private String columnName;
	
	private String objectName;
	
	private int columnIndex;

	public String getColumnName() {
		return columnName;
	}

	public void setColumnName(String columnName) {
		this.columnName = columnName;
	}

	public String getObjectName() {
		return objectName;
	}

	public void setObjectName(String objectName) {
		this.objectName = objectName;
	}

	public int getColumnIndex() {
		return columnIndex;
	}

	public void setColumnIndex(int columnIndex) {
		this.columnIndex = columnIndex;
	}

	public ExcelColumnConfigDto(String columnName, String objectName, int columnIndex) {
		this.columnName = columnName;
		this.objectName = objectName;
		this.columnIndex = columnIndex;
	}
}
