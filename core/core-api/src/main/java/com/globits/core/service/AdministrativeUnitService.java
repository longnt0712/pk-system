package com.globits.core.service;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.globits.core.domain.AdministrativeUnit;
import com.globits.core.dto.AdministrativeUnitDto;

public interface AdministrativeUnitService extends GenericService<AdministrativeUnit, Long> {
	AdministrativeUnit saveAdministrativeUnit(AdministrativeUnit department);

	AdministrativeUnit updateAdministrativeUnit(AdministrativeUnit department, Long departmentId);

	Page<AdministrativeUnit> getListAdministrativeUnitByTree(int pageIndex, int pageSize);

	Page<AdministrativeUnit> getListAdministrativeUnitbyProvince(int pageIndex, int pageSize);

	Page<AdministrativeUnit> getListAdministrativeUnitbyCity(Long parentId, int pageIndex, int pageSize);
	int deleteAdministrativeUnits(List<AdministrativeUnitDto> dtos);
	Page<AdministrativeUnitDto> getListTree(Integer pageIndex, Integer pageSize);
	Page<AdministrativeUnitDto> findByPageBasicInfo(int pageIndex, int pageSize);
	AdministrativeUnitDto deleteAdministrativeUnit(Long id);
}
