package com.globits.core.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.core.domain.Department;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.dto.DepartmentSearchDto;
import com.globits.core.dto.DepartmentTreeDto;

public interface DepartmentService extends GenericService<Department, Long> {
	
	Department saveDepartment(Department department);

	Department updateDepartment(Department department, Long departmentId);

	Page<Department> getListDepartmentByTree();

	Page<Department> getListDepartmentByDepartmentType(int departmentType);

	/**
	 * Tuan Anh added for Calendar
	 * 
	 * @return
	 */
	public List<DepartmentDto> getAll();
	public List<DepartmentTreeDto> getTreeData();
	
	public Page<DepartmentDto> findTreeDepartment(int pageIndex, int pageSize);
	public int deleteDepartments(List<DepartmentDto> deparments);

	List<DepartmentDto> findTreeDepartmentNoneChild();
	
	DepartmentDto checkDuplicateCode(String code);
	
	DepartmentDto getDepartmentById(Long departmentId);
	
	public Page<DepartmentDto> searchDepartment(DepartmentSearchDto dto, int pageSize, int pageIndex);
	
	public boolean updateLinePath();
	
	DepartmentDto updateDepartmentDto(DepartmentDto department, Long departmentId);
	
	List<DepartmentDto> findTreeFacultiesNoneChild();
}
