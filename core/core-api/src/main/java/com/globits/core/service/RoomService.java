package com.globits.core.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.core.domain.Room;
import com.globits.core.dto.RoomDto;

public interface RoomService extends GenericService<Room, Long> {

	public List<RoomDto> getAllRooms();
	public Page<RoomDto> getListByPage(int pageSize, int pageIndex);
	
	public RoomDto checkDuplicateCode(String code);
	public Page<RoomDto> searchRoom(String keyword, int pageSize, int pageIndex);
	
}