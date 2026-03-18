package com.globits.core.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.core.domain.Room;
import com.globits.core.dto.RoomDto;


@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {

	@Query("select new com.globits.core.dto.RoomDto(r) from Room r where r.name like ?1 or r.code like ?1")
	Page<RoomDto> searchRoom(String keyword, Pageable pageable);
	
	@Query("select new com.globits.core.dto.RoomDto(r) from Room r")
	Page<RoomDto> getByPage(Pageable pageable);
	
	@Query("select e from Room e where  e.code=?1")
	Room findByCode(String code);
	
	@Query("select e from Room e where  e.code=?1")
	List<Room> findListByCode(String code);
	
}
