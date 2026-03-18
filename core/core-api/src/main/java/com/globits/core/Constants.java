package com.globits.core;

public class Constants {
	public static final String ROLE_ADMIN="ROLE_ADMIN";
	public static final String ROLE_USER="ROLE_USER";
	public static final String USER_ADMIN_USERNAME = "admin";
	public static enum PersonAddressType{
		RegisterAddress(1),//Địa chỉ thường trú
		CurrentAddress(2);//Chỗ ở hiện tại
		
		private int value;    
		
		private PersonAddressType(int value) {
		    this.value = value;
		}
	
		public int getValue() {
			return value;
		}
	}
	
	public static enum MaritalStatusEnum{
		Single(1),//Chưa kết hôn
		Married(2),//Đã kết hôn
		ReMarried(3),//Đã tái hôn
		Divorced(4),//Đã ly dị
		Separated(5),//Ly thân;
		SingleHasChildren(6);//Độc thân nhưng có con
		
		private int value;    
		
		private MaritalStatusEnum(int value) {
		    this.value = value;
		}
	
		public int getValue() {
			return value;
		}
	}
	
	public static enum ActionLogTypeEnum{
		View(0),//Xem
		Create(1),//Tạo mới
		Update(2),//Sửa
		Delete(3);//Xóa một bản ghi nào đó
		
		private int value;    
		
		private ActionLogTypeEnum(int value) {
		    this.value = value;
		}
	
		public int getValue() {
			return value;
		}
	}
	
	
}
