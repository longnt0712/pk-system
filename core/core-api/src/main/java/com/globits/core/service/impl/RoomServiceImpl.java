package com.globits.core.service.impl;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.globits.core.domain.Department;
import com.globits.core.domain.Room;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.dto.RoomDto;
import com.globits.core.repository.RoomRepository;
import com.globits.core.service.RoomService;

@Transactional
@Service
public class RoomServiceImpl extends GenericServiceImpl<Room, Long> implements RoomService {

	@Autowired
	RoomRepository roomRepository;
	
	@Override
	@Transactional(readOnly = true)
	public List<RoomDto> getAllRooms() {

		Iterator<Room> itr = repository.findAll().iterator();
		List<RoomDto> list = new ArrayList<RoomDto>();

		while (itr.hasNext()) {
			list.add(new RoomDto(itr.next()));
		}

		return list;
	}

	@Override
	public RoomDto checkDuplicateCode(String code) {
		RoomDto viewCheckDuplicateCodeDto = new RoomDto();
		Room room = null;
		List<Room> list = roomRepository.findListByCode(code);
		if(list != null && list.size() > 0) {
			room = list.get(0);
		}
		if(list == null) {
			viewCheckDuplicateCodeDto.setDuplicate(false);
		}else if(list != null && list.size() > 0) {
			viewCheckDuplicateCodeDto.setDuplicate(true);
			viewCheckDuplicateCodeDto.setDupCode(room.getCode());
			viewCheckDuplicateCodeDto.setDupName(room.getName());
		}
		return viewCheckDuplicateCodeDto;
	}

	@Override
	public Page<RoomDto> getListByPage(int pageSize, int pageIndex) {
		Pageable pageable = new PageRequest(pageIndex - 1, pageSize);
		return roomRepository.getByPage(pageable);
	}	
	
	@Override
	public Page<RoomDto> searchRoom(String keyword, int pageSize, int pageIndex) {
		Pageable pageable = new PageRequest(pageIndex - 1, pageSize);
		return roomRepository.searchRoom("%"+keyword+"%", pageable);
	}	
}
