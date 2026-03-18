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
import com.globits.core.dto.TrainingBaseDto;
import com.globits.core.service.RoomService;
import com.globits.core.service.TrainingBaseService;

@RestController
@RequestMapping("/api/trainingbase")
public class RestTrainingBaseController {
	@PersistenceContext
	private EntityManager manager;
	@Autowired
	private TrainingBaseService trainingBaseService;

	@RequestMapping(value = "/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT" })
	public Page<TrainingBaseDto> getList(@PathVariable int pageIndex, @PathVariable int pageSize) {
		Page<TrainingBaseDto> page = trainingBaseService.getListByPage(pageIndex, pageSize);
		return page;
	}

	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT" })
	@RequestMapping(value = "/{trainingBaseId}", method = RequestMethod.GET)
	public TrainingBaseDto getRoom(@PathVariable("trainingBaseId") String trainingBaseId) {
		TrainingBaseDto trainingBase = trainingBaseService.getTrainingBase(new Long(trainingBaseId));
		return trainingBase;
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(method = RequestMethod.POST)
	public TrainingBaseDto saveRoom(@RequestBody TrainingBaseDto dto) {
		return trainingBaseService.saveTrainingBase(dto);
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/{trainingBaseId}", method = RequestMethod.PUT)
	public TrainingBaseDto updateRoom(@RequestBody TrainingBaseDto dto, @PathVariable("trainingBaseId") Long trainingBaseId) {
		return trainingBaseService.saveTrainingBase(dto);
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/{trainingBaseId}", method = RequestMethod.DELETE)
	public TrainingBaseDto removeRoom(@PathVariable("trainingBaseId") String trainingBaseId) {
		return trainingBaseService.deleteTrainingBase(new Long(trainingBaseId));
	}

	/**
	 * Get all TrainingBase
	 * 
	 * @author Hoang Quoc Dung
	 */
	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT" })
	@RequestMapping(value = "/all", method = RequestMethod.GET)
	public ResponseEntity<List<TrainingBaseDto>> getAllTrainingBases() {

		List<TrainingBaseDto> trainingBases = trainingBaseService.getAllTrainingBases();

		return new ResponseEntity<List<TrainingBaseDto>>(trainingBases, HttpStatus.OK);
	}
	
	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT" })
	@RequestMapping(value = "/checkCode/{code}",method = RequestMethod.GET)
	public TrainingBaseDto checkDuplicateCode(@PathVariable("code") String code) {
		return trainingBaseService.checkDuplicateCode(code);
	}
}
