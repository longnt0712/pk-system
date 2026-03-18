package com.globits.richy.service.impl;

import java.util.ArrayList;
import java.util.List;

import javax.persistence.EntityManager;
import javax.persistence.Query;

import org.joda.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import com.globits.richy.domain.Brand;
import com.globits.richy.dto.BrandDto;
import com.globits.richy.dto.BrandWithChildrenDto;
import com.globits.richy.repository.BrandRepository;
import com.globits.richy.service.BrandService;
import com.globits.security.domain.User;

@Service
public class BrandServiceImpl implements BrandService {
	@Autowired
	EntityManager manager;
	@Autowired
	BrandRepository brandRepository;

	@Override
	public Page<BrandDto> getPageObject(BrandDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.BrandDto(s) from Brand s where (1=1)";
		String sqlCount = "select count(s.id) from Brand s where (1=1)";
		String whereClause = "";

		if (textSearch != null && textSearch.length() > 0) {
			whereClause += " and (s.text like :textSearch)";
		}
		
		if(searchDto.getWebsite() != null) {
			whereClause += " and (s.website = :website)";
		}

		sql += whereClause;
		sqlCount += whereClause;

		Query q = manager.createQuery(sql, BrandDto.class);
		Query qCount = manager.createQuery(sqlCount);

		if (textSearch != null && textSearch.length() > 0) {
			q.setParameter("textSearch", '%' + textSearch + '%');
			qCount.setParameter("textSearch", '%' + textSearch + '%');
		}
		
		if(searchDto.getWebsite() != null) {
			q.setParameter("website",searchDto.getWebsite());
			qCount.setParameter("website",searchDto.getWebsite());
		}

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<BrandDto> page = new PageImpl<BrandDto>(q.getResultList(), pageable, numberResult);
		return page;
	}

	@Override
	public List<BrandDto> getListObject(BrandDto searchDto, int pageIndex, int pageSize) {
		return null;
	}

	@Override
	public BrandDto getObjectById(Long id) {
		return new BrandDto(brandRepository.getOne(id));
	}

	@Override
	public BrandDto getObjectByUrl(String url) {
		return brandRepository.findByUrl(url);
	}
	
//	
//	public BrandDto findByUrl(String url) {
//		return brandRepository.findByUrl(url);
//	}
	
	@Override
	public boolean saveObject(BrandDto dto) {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User modifiedUser = null;
		LocalDateTime currentDate = LocalDateTime.now();
		String currentUserName = "Unknown User";
		if (authentication != null) {
			modifiedUser = (User) authentication.getPrincipal();
			currentUserName = modifiedUser.getUsername();
		}
		if(dto == null) {
			return false;
		}
		Brand domain = null;
		if(dto.getId() != null) {
			domain = brandRepository.getOne(dto.getId());
		}
		if(domain != null) {
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(currentDate);
		}
		if(domain == null) {
			domain = new Brand();
			domain.setCreateDate(currentDate);
			domain.setCreatedBy(currentUserName);
		}
		
		domain.setCode(dto.getCode());
		domain.setName(dto.getName());
		domain.setUrl(dto.getUrl());
		domain.setDescription(dto.getDescription());
		domain.setWebsite(dto.getWebsite());
		if(dto.getParent() != null && dto.getParent().getId() != null) {
			Brand f = brandRepository.getOne(dto.getParent().getId());
			if(f != null) {
				domain.setParent(f);
			}
		}
		
		domain = brandRepository.save(domain);
		
		return false;
	}

	@Override
	public boolean deleteObject(Long id) {
		if(id == null) {
			return false;
		}
		Brand domain = brandRepository.getOne(id);
		if(domain == null) {
			return false;
		}
		brandRepository.delete(domain);
		return true;
	}

	@Override
	public List<BrandWithChildrenDto> listAllBrandWithChildrens() {
		
		List<BrandWithChildrenDto> ret = new ArrayList<BrandWithChildrenDto>();
		
		List<BrandDto> brands = brandRepository.brandDtos();
		
		if(brands != null) {
			for (BrandDto brandDto : brands) {
				BrandWithChildrenDto b = new BrandWithChildrenDto();
				b.setBrand(brandDto);
				
				if(brandDto.getId() != null) {
					List<BrandDto> childrens = brandRepository.brandDtos(brandDto.getId());
					for (BrandDto child : childrens) {
						b.getChildren().add(child);
						
						BrandWithChildrenDto b2 = new BrandWithChildrenDto();
						b2.setBrand(child);
						
						if(child.getId() != null) {
							List<BrandDto> childrens2 = brandRepository.brandDtos(child.getId());
							
							for (BrandDto brandDto2 : childrens2) {
								b2.getChildren().add(child);
							}
						}
					}
				}
				ret.add(b);
			}
		}
		
		return ret;
	}

	@Override
	public List<BrandDto> listBrandDtoWithChildren(Integer website) {
		List<BrandDto> brands = brandRepository.brandParentDtosByWebsite(website);
		
		childrens(brands);
		
		return brands;
	}
	
	
	public List<BrandDto> childrens(List<BrandDto> brands){
		
		if(brands != null && brands.size() > 0) {
			for(int i = 0; i < brands.size(); i++) {
				BrandDto l0 = brands.get(i);
				List<BrandDto> listL1 = brandRepository.brandDtos(l0.getId());
				brands.get(i).setChildren(childrens(listL1));
			}
		}
		
		return brands;
	}
	
}
