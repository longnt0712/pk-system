package com.globits.core.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.globits.core.domain.AdministrativeUnit;
import com.globits.core.dto.AdministrativeUnitDto;

@Repository
public interface AdministrativeUnitRepository extends JpaRepository<AdministrativeUnit, Long> {
	@Query("select au from AdministrativeUnit au where au.parent=null")
	Page<AdministrativeUnit> getListRootAdministrativeUnit(Pageable pageable);

	@Query("select au from AdministrativeUnit au where au.level=1 and au.parent.id=?1")
	Page<AdministrativeUnit> getListdministrativeUnitbyCity(Long parentId, Pageable pageable);

	@Query("select e from AdministrativeUnit e   where  e.code=?1")
	AdministrativeUnit findByCode(String code);
	

    // pagination tree data //
	@Query("select COUNT(*) from AdministrativeUnit cs where cs.parent is null  order by cs.code ASC")
	Long countDadAdministrativeUnit();
	
	@Query("select cs from AdministrativeUnit cs left join fetch cs.subAdministrativeUnits where cs.parent is null  order by cs.code ASC")
	List<AdministrativeUnit> findTreeAdministrativeUnit(Pageable pageable);
	
	@Query("select new com.globits.core.dto.AdministrativeUnitDto(s) from AdministrativeUnit s")
	Page<AdministrativeUnitDto> findByPageBasicInfo(Pageable pageable);
	@Query("select au from AdministrativeUnit au where  au.parent.id=?1")
	List<AdministrativeUnit> getListdministrativeUnitbyParent(Long parentId);
}
