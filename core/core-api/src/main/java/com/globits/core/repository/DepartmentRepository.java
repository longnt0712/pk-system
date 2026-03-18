package com.globits.core.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.core.domain.Department;
import com.globits.core.dto.DepartmentDto;

@Repository
public interface DepartmentRepository extends JpaRepository<Department, Long> {
	@Query("select d from Department d order by d.code asc")
	List<Department> findAllDepartment();

	@Query("select d from Department d order by d.displayOrder asc")
	List<Department> findAllDepartmentOrderByDisplayOrder();
	
	@Query("select u from Department u where u.id = ?1")
	Department findById(Long id);
	
	@Query("select u from Department u left join fetch u.subDepartments where u.id = ?1")
	Department findFullDepartmentById(Long id);

	@Query("select d from Department d where d.parent=null")
	List<Department> getListDepartmentByTree();

	@Query("select d from Department d where d.departmentType=?1")
	// d.parent=null and
	List<Department> getListDepartmentByDepartmentType(int departmentType);
	
	@Query("select d from Department d left join fetch d.subDepartments where d.parent is null")
	List<Department> findTreeDepartment(Pageable pageable);
	
	@Query("select COUNT(*) from Department d where d.parent is null")
	Long countRootDepartment();
	
	@Query("select u from Department u where u.code = ?1")
	List<Department> findByCode(String code);
	
	@Query("select new com.globits.core.dto.DepartmentDto(d) from Department d where d.id = ?1")
	DepartmentDto getOneDtoBy(Long departmentId);
	
	@Query("select d from Department d where d.departmentType = 2 and d.level = 1")
	List<Department> findFaculties();
}
