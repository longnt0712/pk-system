package com.globits.core.rest;

import java.util.List;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import com.globits.core.domain.Room;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.dto.RoomDto;
import com.globits.core.service.RoomService;

@RestController
@RequestMapping("/api/room")
public class RestRoomController {
	@PersistenceContext
	private EntityManager manager;
	@Autowired
	private RoomService roomService;

	@RequestMapping(value = "/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT" })
	public Page<Room> getList(@PathVariable int pageIndex, @PathVariable int pageSize) {
		Page<Room> page = roomService.getList(pageIndex, pageSize);
		return page;
	}
	@RequestMapping(value = "/{keyword}/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT" })
	public Page<RoomDto> searchRoom(@PathVariable String keyword, @PathVariable int pageIndex, @PathVariable int pageSize) {
		Page<RoomDto> page = roomService.searchRoom(keyword,pageSize, pageIndex);
		return page;
	}
	
	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT" })
	@RequestMapping(value = "/{roomId}", method = RequestMethod.GET)
	public Room getRoom(@PathVariable("roomId") String roomId) {
		Room room = roomService.findById(new Long(roomId));
		return room;
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(method = RequestMethod.POST)
	public Room saveRoom(@RequestBody Room country) {
		return roomService.save(country);
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/{roomId}", method = RequestMethod.PUT)
	public Room updateRoom(@RequestBody Room Room, @PathVariable("roomId") Long RoomId) {
		return roomService.save(Room);
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/{roomId}", method = RequestMethod.DELETE)
	public Room removeRoom(@PathVariable("roomId") String roomId) {
		Room Room = roomService.delete(new Long(roomId));
		return Room;
	}

	/**
	 * Get all rooms
	 * 
	 * @author Tuan Anh for Calendar
	 */
	@Secured({ "ROLE_ADMIN", "ROLE_USER" })
	@RequestMapping(value = "/all", method = RequestMethod.GET)
	public ResponseEntity<List<RoomDto>> getAllRooms() {

		List<RoomDto> rooms = roomService.getAllRooms();

		return new ResponseEntity<List<RoomDto>>(rooms, HttpStatus.OK);
	}
	
	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT" })
	@RequestMapping(value = "/checkCode/{code}",method = RequestMethod.GET)
	public RoomDto checkDuplicateCode(@PathVariable("code") String code) {
		return roomService.checkDuplicateCode(code);
	}
}
