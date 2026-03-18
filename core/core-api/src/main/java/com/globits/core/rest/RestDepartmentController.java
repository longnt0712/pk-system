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

import com.globits.core.domain.Department;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.dto.DepartmentTreeDto;
import com.globits.core.service.DepartmentService;

@RestController
@RequestMapping("/api/department")
public class RestDepartmentController {
	@PersistenceContext
	private EntityManager manager;
	@Autowired
	private DepartmentService departmentService;

	@RequestMapping(value = "/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT"})
	public Page<Department> getList(@PathVariable int pageIndex, @PathVariable int pageSize) {
		// Page<Department> page = departmentService.getList(pageIndex,pageSize);
		Page<Department> page = departmentService.getListDepartmentByTree();
		return page;
	}

	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT"})
	@RequestMapping(value = "/{DepartmentId}", method = RequestMethod.GET)
	public Department getDepartment(@PathVariable("DepartmentId") String DepartmentId) {
		Department depart = departmentService.findById(new Long(DepartmentId));
//		depart = new Department(depart);
		return depart;
	}

	@Secured({"ROLE_ADMIN"})
	@RequestMapping(method = RequestMethod.POST)
	public Department saveDepartment(@RequestBody Department Department) {
		return departmentService.saveDepartment(Department);
	}

	@Secured({"ROLE_ADMIN"})
	@RequestMapping(value = "/{DepartmentId}", method = RequestMethod.PUT)
	public Department updateDepartment(@RequestBody Department Department,
			@PathVariable("DepartmentId") Long departmentId) {
		return departmentService.updateDepartment(Department, departmentId);
	}

	@Secured({"ROLE_ADMIN"})
	@RequestMapping(value = "/{DepartmentId}", method = RequestMethod.DELETE)
	public Department removeDepartment(@PathVariable("DepartmentId") String DepartmentId) {
		Department Department = departmentService.delete(new Long(DepartmentId));
		return Department;
	}
	
	@Secured({"ROLE_ADMIN"})
	@RequestMapping(method = RequestMethod.DELETE)
	public int removeDepartment(@RequestBody List<DepartmentDto> departments) {
		return departmentService.deleteDepartments(departments);
	}

	@RequestMapping(value = "/{type}/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	@Secured({"ROLE_ADMIN","ROLE_USER"})
	public Page<Department> getListByType(@PathVariable int type, @PathVariable int pageIndex,
			@PathVariable int pageSize) {
		// Page<Department> page = departmentService.getList(pageIndex,pageSize);
		Page<Department> page = departmentService.getListDepartmentByDepartmentType(type);
		return page;
	}

	/**
	 * Get a list of departments
	 * 
	 * @author Tuan Anh for Calendar
	 */
	@RequestMapping(value = "/all", method = RequestMethod.GET)
	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_STUDENT_MANAGERMENT"})
	public ResponseEntity<List<DepartmentDto>> getAllDepartments() {
		List<DepartmentDto> list = departmentService.getAll();

		return new ResponseEntity<List<DepartmentDto>>(list, HttpStatus.OK);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_STUDENT_MANAGERMENT"})
	@RequestMapping(path = "/tree/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	public ResponseEntity<Page<DepartmentDto>> getTreeData(@PathVariable("pageIndex")int pageIndex,@PathVariable("pageSize")int pageSize){
		
		Page<DepartmentDto> ret = departmentService.findTreeDepartment(pageIndex, pageSize);
		
		return new ResponseEntity<Page<DepartmentDto>>(ret, HttpStatus.OK);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_STUDENT_MANAGERMENT"})
	@RequestMapping(path = "/tree_none_child", method = RequestMethod.GET)
	List<DepartmentDto> findTreeDepartmentNoneChild(){
		return departmentService.findTreeDepartmentNoneChild();
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_STUDENT_MANAGERMENT"})
	@RequestMapping(path = "/tree_none_child/faculty", method = RequestMethod.GET)
	List<DepartmentDto> findTreeFacultiesNoneChild(){
		return departmentService.findTreeFacultiesNoneChild();
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_STUDENT_MANAGERMENT"})
	@RequestMapping(value = "/checkCode/{code}/",method = RequestMethod.GET)
	public DepartmentDto checkDuplicateCode(@PathVariable String code) {
		return departmentService.checkDuplicateCode(code);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT"})
	@RequestMapping(value = "/dto/{departmentId}", method = RequestMethod.GET)
	public DepartmentDto getDepartmentDto(@PathVariable("departmentId") String departmentId) {
		return departmentService.getDepartmentById(new Long(departmentId));
	}
	
	@Secured({"ROLE_ADMIN"})
	@RequestMapping(value = "/line_path", method = RequestMethod.PUT)
	public boolean updateLinePath() {
		return departmentService.updateLinePath();
	}
	
	@Secured({"ROLE_ADMIN"})
	@RequestMapping(value = "/dto/{DepartmentId}", method = RequestMethod.PUT)
	public DepartmentDto updateDepartmentDto(@RequestBody DepartmentDto Department,
			@PathVariable("DepartmentId") Long departmentId) {
		return departmentService.updateDepartmentDto(Department, departmentId);
	}
}
