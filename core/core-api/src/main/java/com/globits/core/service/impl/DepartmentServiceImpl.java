package com.globits.core.service.impl;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;

import javax.persistence.Query;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.globits.core.domain.Department;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.dto.DepartmentSearchDto;
import com.globits.core.dto.DepartmentTreeDto;
import com.globits.core.repository.DepartmentRepository;
import com.globits.core.service.DepartmentService;

@Transactional
@Service
public class DepartmentServiceImpl extends GenericServiceImpl<Department, Long> implements DepartmentService {
	@Autowired
	DepartmentRepository departmentRepository;

	private List<Department> getListSub(Department dep, int level) {
		ArrayList<Department> retList = new ArrayList<Department>();
		dep.setLevel(level);
		retList.add(dep);
		if (dep.getSubDepartments() != null && dep.getSubDepartments().size() > 0) {
			Iterator<Department> iter = dep.getSubDepartments().iterator();
			while (iter.hasNext()) {
				Department d = iter.next();
				retList.addAll(getListSub(d, level + 1));
			}
		}
		return retList;
	}

	public Page<Department> getListDepartmentByTree() {
		List<Department> list = departmentRepository.getListDepartmentByTree();
		ArrayList<Department> retList = new ArrayList<Department>();
		for (int i = 0; i < list.size(); i++) {
			// retList.add(list.get(i));
			if (list.get(i) != null) {
				List<Department> childs = getListSub(list.get(i), 0);
				if (childs != null && childs.size() > 0) {
					retList.addAll(childs);
				}
			}
		}
		int pageSize = 1;
		if (retList.size() > 0) {
			pageSize = retList.size();
		}
		Pageable pageable = new PageRequest(0, pageSize);
		Page<Department> page = new PageImpl<Department>(retList, pageable, pageSize);
		return page;
	}
	
	public Page<DepartmentDto> findTreeDepartment(int pageIndex, int pageSize){
		Pageable pageable = new PageRequest(pageIndex-1, pageSize);
		List<Department>  list = departmentRepository.findTreeDepartment(pageable);
		Long numberElement = departmentRepository.countRootDepartment();
		List<DepartmentDto> retList = new ArrayList<DepartmentDto>();
		for(int i=0;i<list.size();i++) {
			DepartmentDto dto = new DepartmentDto(list.get(i));
			retList.add(dto);
		}
		Page<DepartmentDto> page = new PageImpl<DepartmentDto>(retList, pageable,numberElement);
		return page;
	}
	
	@Override
	public List<DepartmentDto> findTreeFacultiesNoneChild(){
//		Pageable pageable = new PageRequest(0, 1000);
		List<Department>  list = departmentRepository.findFaculties();		
		List<DepartmentDto> retList = new ArrayList<DepartmentDto>();		
		for(int i=0;i<list.size();i++) {
			DepartmentDto dto = new DepartmentDto(list.get(i));
			retList.add(dto);
//			retList.addAll(buildTreeByChild(dto,""));
		}
		return retList;
	}
	
	@Override
	public List<DepartmentDto> findTreeDepartmentNoneChild(){
		Pageable pageable = new PageRequest(0, 1000);
		List<Department>  list = departmentRepository.findTreeDepartment(pageable);		
		List<DepartmentDto> retList = new ArrayList<DepartmentDto>();		
		for(int i=0;i<list.size();i++) {
			DepartmentDto dto = new DepartmentDto(list.get(i));
			retList.add(dto);
			retList.addAll(buildTreeByChild(dto,""));
		}
		return retList;
	}
	
	public List<DepartmentDto> buildTreeByChild(DepartmentDto dto,String prefix){
		List<DepartmentDto> retList = new ArrayList<DepartmentDto>();		
		if(dto.getSubDepartments()!=null && dto.getSubDepartments().size()>0) {
			for (DepartmentDto subDto : dto.getSubDepartments()) {
				subDto.setName(prefix+"..."+subDto.getName());
				subDto.setCode(prefix+"..."+subDto.getCode());
				retList.add(subDto);
				retList.addAll(buildTreeByChild(subDto,prefix+"..."));				
			}
			dto.setSubDepartments(null);
		}
		return retList;
	}
	
	public Department updateDepartment(Department department, Long departmentId) {
		Department updateDepartment = null;
		if (department.getId() != null) {
			updateDepartment = this.findById(department.getId());
		} else {
			updateDepartment = this.findById(departmentId);
		}

		updateDepartment.setCode(department.getCode());
		updateDepartment.setName(department.getName());
		updateDepartment.setDepartmentType(department.getDepartmentType());
		updateDepartment.setDisplayOrder(department.getDisplayOrder());

		if (department.getParent() != null && department.getParent().getId() != null) {
			Department parentDepartment = departmentRepository.findById(department.getParent().getId());
			if (parentDepartment != null && parentDepartment.getId() != updateDepartment.getId()) {
				updateDepartment.setParent(parentDepartment);
			}			
		} else if (updateDepartment.getParent() != null) {
			updateDepartment.setParent(null);
		}
		Department dep = updateDepartment;
		String linePath=updateDepartment.getCode();
		while (dep.getParent()!=null) {
			if(dep.getParent()!=null) {
				linePath =dep.getParent().getCode()+"/"+linePath; 
			}
			dep = dep.getParent();
		}
		updateDepartment.setLinePath(linePath);
		updateDepartment = this.save(updateDepartment);
		if (updateDepartment.getParent() != null) {
			updateDepartment.setParent(
					new Department(updateDepartment.getParent().getId(), updateDepartment.getParent().getName(),
							updateDepartment.getParent().getCode(), updateDepartment.getParent().getDepartmentType()));
		}
		return updateDepartment;
	}

	public Department saveDepartment(Department department) {
		Department newDepartment = new Department();
		newDepartment.setCode(department.getCode());
		newDepartment.setName(department.getName());
		newDepartment.setDepartmentType(department.getDepartmentType());
		newDepartment.setDisplayOrder(department.getDisplayOrder());

		if (department.getParent() != null && department.getParent().getId() != null) {
			Department parentDepartment = departmentRepository.findById(department.getParent().getId());
			if (parentDepartment != null && parentDepartment.getId() != newDepartment.getId()) {
				newDepartment.setParent(parentDepartment);
			}
		}
		
		Department dep = newDepartment;
		String linePath=newDepartment.getCode();
		while (dep.getParent()!=null) {
			if(dep.getParent()!=null) {
				linePath =dep.getParent().getCode()+"/"+linePath; 
			}
			dep = dep.getParent();
		}
		newDepartment.setLinePath(linePath);
		return this.save(newDepartment);
	}

	public Page<Department> getListDepartmentByDepartmentType(int departmentType) {
		List<Department> retList = departmentRepository.getListDepartmentByDepartmentType(departmentType);
		/*
		 * ArrayList<Department> retList = new ArrayList<Department>(); for(int
		 * i=0;i<list.size();i++){ //retList.add(list.get(i)); if(list.get(i)!=null){
		 * List<Department> childs = getListSub(list.get(i),0); if(childs!=null &&
		 * childs.size()>0){ retList.addAll(childs); } } }
		 */
		int pageSize = 1;
		if (retList.size() > 0) {
			pageSize = retList.size();
		}
		Pageable pageable = new PageRequest(0, pageSize);
		Page<Department> page = new PageImpl<Department>(retList, pageable, pageSize);
		return page;
	}

	@Override
	@Transactional(readOnly = true)
	public List<DepartmentDto> getAll() {

		Iterator<Department> itr = repository.findAll().iterator();
		List<DepartmentDto> list = new ArrayList<DepartmentDto>();

		while (itr.hasNext()) {
			list.add(new DepartmentDto(itr.next()));
		}

		return list;
	}
	
	@Override
	@Transactional(rollbackFor = Exception.class)
	public List<DepartmentTreeDto> getTreeData() {
		List<Department> list = departmentRepository.findAllDepartmentOrderByDisplayOrder();
		List<DepartmentTreeDto> dtos = new ArrayList<DepartmentTreeDto>();
		for (Department department : list) {
			dtos.add(new DepartmentTreeDto(department));
		}
		return dtos;
	}
	
	@Override
	@Transactional(rollbackFor = Exception.class)
	public int deleteDepartments(List<DepartmentDto> departments) {
		int ret =0;
		for (DepartmentDto dto : departments){
			departmentRepository.delete(dto.getId());
			ret++;
		}
		return ret;
		
	}
	
	@Override
	public DepartmentDto checkDuplicateCode(String code) {
		DepartmentDto viewCheckDuplicateCodeDto = new DepartmentDto();
		Department department = null;
		List<Department> list = departmentRepository.findByCode(code);
		if(list != null && list.size() > 0) {
			department = list.get(0);
		}
		if(list == null) {
			viewCheckDuplicateCodeDto.setDuplicate(false);
		}else if(list != null && list.size() > 0) {
			viewCheckDuplicateCodeDto.setDuplicate(true);
			viewCheckDuplicateCodeDto.setDupCode(department.getCode());
			viewCheckDuplicateCodeDto.setDupName(department.getName());
		}
		return viewCheckDuplicateCodeDto;
	}

	@Override
	public DepartmentDto getDepartmentById(Long departmentId) {
		DepartmentDto departmentDto = departmentRepository.getOneDtoBy(departmentId);
		return departmentDto;
	}

	@Override
	public Page<DepartmentDto> searchDepartment(DepartmentSearchDto dto, int pageSize, int pageIndex) {
		String sql = "select new com.globits.core.dto.DepartmentDto(d) from Department d where (1=1)";
		String sqlCount = "select count(d.id) from Department d where (1=1)";
		if(dto.getCode()!=null) {
			sql +=" and d.code like :code";
			sqlCount +=" and d.code like :code";
		}
		if(dto.getName()!=null) {
			sql +=" and d.name like :name";
			sqlCount +=" and d.name like :name";
		}
		if(dto.getParentId()!=null) {
			sql +=" and d.parent.id=:parentId";
			sqlCount +=" and d.parent.id=:parentId";
		}
		if(dto.getOrderBy()==null || dto.getOrderBy().length()==0) {
			sql +=" order by d.displayOrder";
		}else {
			sql +=" order by "+ dto.getOrderBy();
		}
		Query q = manager.createQuery(sql);
		Query qCount = manager.createQuery(sqlCount);
		
		if(dto.getCode()!=null) {
			String code = "%"+ dto.getCode() +"%";
			q.setParameter("code",code);
			qCount.setParameter("code",code);
		}
		if(dto.getName()!=null) {
			String name = "%"+ dto.getName() +"%";
			q.setParameter("name",name);
			qCount.setParameter("name",name);
		}
		if(dto.getParentId()!=null) {
			q.setParameter("parentId",dto.getParentId());
			qCount.setParameter("parentId",dto.getParentId());
		}
		int startPosition = (pageIndex-1)*pageSize;
		q.setMaxResults(pageSize);
		q.setFirstResult(startPosition);
		List<DepartmentDto> content = q.getResultList();
		long count = (long)qCount.getSingleResult();
		Pageable pageable = new PageRequest(pageIndex-1,pageSize);
		Page<DepartmentDto> result = new PageImpl<>(content, pageable, count);
		
		return result;
	}

	private void updateLinePathChildrens(Department parent){
		if(parent != null && parent.getSubDepartments() != null && parent.getSubDepartments().size() > 0) {
			for (Department d : parent.getSubDepartments()) {
				String linePath=d.getCode();
				Department dep = d;
				while (dep.getParent()!=null) {
					if(dep.getParent()!=null) {
						linePath =dep.getParent().getCode()+"/"+linePath; 
					}
					dep = dep.getParent();
				}
				d.setLinePath(linePath);
				d = departmentRepository.save(d);
				updateLinePathChildrens(d);
			}
		}
	}
	
	@Override
	public boolean updateLinePath() {
		List<Department> rootDepartment = departmentRepository.getListDepartmentByTree();
		for (Department root : rootDepartment) {
			root = departmentRepository.save(root);
			updateLinePathChildrens(root);
		}
		return true;
	}
	
	@Override
	public DepartmentDto updateDepartmentDto(DepartmentDto department, Long departmentId) {
		Department updateDepartment = null;
		if (department.getId() != null) {
			updateDepartment = this.findById(department.getId());
		} else {
			updateDepartment = this.findById(departmentId);
		}

		updateDepartment.setCode(department.getCode());
		updateDepartment.setName(department.getName());
		updateDepartment.setDepartmentType(department.getDepartmentType());
		updateDepartment.setDisplayOrder(department.getDisplayOrder());

		if (department.getParent() != null && department.getParent().getId() != null) {
			Department parentDepartment = departmentRepository.findById(department.getParent().getId());
			if (parentDepartment != null && parentDepartment.getId() != updateDepartment.getId()) {
				updateDepartment.setParent(parentDepartment);
			}			
		} else if (updateDepartment.getParent() != null) {
			updateDepartment.setParent(null);
		}
		Department dep = updateDepartment;
		String linePath=updateDepartment.getCode();
		while (dep.getParent()!=null) {
			if(dep.getParent()!=null) {
				linePath =dep.getParent().getCode()+"/"+linePath; 
			}
			dep = dep.getParent();
		}
		updateDepartment.setLinePath(linePath);
		Department parent = null;
		if(department.getParent() != null && department.getParent().getId() != null) {
			parent = departmentRepository.findById(department.getParent().getId());
		}
		updateDepartment.setParent(parent);
		
		updateDepartment = departmentRepository.save(updateDepartment);
		//set displayOrder
		if(department.getSubDepartments() != null && department.getSubDepartments().size() > 0) {
			for (DepartmentDto dto : department.getSubDepartments()) {
				if(dto != null && dto.getId() != null) {
					Department domain = departmentRepository.findById(dto.getId());
					if(domain != null) {
						domain.setDisplayOrder(dto.getDisplayOrder());
						domain = departmentRepository.save(domain);
					}
				}
			}
		}
		return new DepartmentDto(updateDepartment);
	}
}
