package com.globits.richy;

public class TaskManConstant {
	public static String FolderPath;
	public static final String SYSTEM_ADMIN ="ROLE_ADMIN";
	public static final String TASKMAN_ADMIN ="ROLE_TASKMAN_ADMIN";
	public static final String TASKMAN_USER ="ROLE_TASKMAN_USER";
	public static final String PROJECT_USER ="ROLE_PROJECT_USER";
	public static final String PROJECT_ADMIN ="ROLE_PROJECT_ADMIN";
	
	public static enum ParticipateTypeEnum{
		DepartmentType(0),//Phòng ban
		PersonalType(1),
		OtherType(2);//Cá nhân
		
		private int value;    
		
		private ParticipateTypeEnum(int value) {
		    this.value = value;
		}
	
		public int getValue() {
			return value;
		}
	}
	
	public static enum TaskOwnerTypeEnum{
		DepartmentType(0),//Phòng ban
		PersonalType(1),//Cá nhân
		OtherType(2);//Khác
		
		private int value;    
		
		private TaskOwnerTypeEnum(int value) {
		    this.value = value;
		}
	
		public int getValue() {
			return value;
		}
	}
	
	public static enum ParticipateStateEnum{
		NotCommentType(0),//Chưa tham gia
		CommentedType(1);//Đã tham gia
		
		private int value;    
		
		private ParticipateStateEnum(int value) {
		    this.value = value;
		}
	
		public int getValue() {
			return value;
		}
	}
}
