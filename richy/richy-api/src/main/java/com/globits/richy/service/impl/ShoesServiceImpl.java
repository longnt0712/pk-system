package com.globits.richy.service.impl;

import java.util.HashSet;
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
import com.globits.richy.domain.Shoes;
import com.globits.richy.domain.ShoesImageUrls;
import com.globits.richy.domain.ShoesSizes;
import com.globits.richy.dto.ArchitectureDisplayDto;
import com.globits.richy.dto.BrandDto;
import com.globits.richy.dto.ShoesDisplayDto;
import com.globits.richy.dto.ShoesDto;
import com.globits.richy.dto.ShoesImageUrlsDto;
import com.globits.richy.dto.ShoesSizesDto;
import com.globits.richy.repository.AllSizesRepository;
import com.globits.richy.repository.BrandRepository;
import com.globits.richy.repository.ImageUrlsRepository;
import com.globits.richy.repository.ShoesImageUrlsRepository;
import com.globits.richy.repository.ShoesRepository;
import com.globits.richy.repository.ShoesSizesRepository;
import com.globits.richy.service.ShoesService;
import com.globits.security.domain.User;

@Service
public class ShoesServiceImpl implements ShoesService {
	@Autowired
	EntityManager manager;
	@Autowired
	ShoesRepository shoesRepository;
	@Autowired
	ShoesSizesRepository shoesSizesRepository;
	@Autowired
	ShoesImageUrlsRepository shoesImageUrlsRepository;
	@Autowired
	AllSizesRepository allSizesRepository;
	@Autowired
	ImageUrlsRepository imageUrlsRepository;
	@Autowired
	BrandRepository brandRepository;
	
	@Override
	public Page<ShoesDto> getPageObject(ShoesDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.ShoesDto(s) from Shoes s where (1=1)";
		String sqlCount = "select count(s.id) from Shoes s where (1=1)";
		String whereClause = "";

		if (textSearch != null && textSearch.length() > 0) {
			whereClause += " and (s.name like :textSearch or s.code like :textSearch)";
		}
		
		if(searchDto.getType() != null) {
			whereClause += " and (s.type = :type)";
		}
		
		if(searchDto.getWebsite() != null) {
			whereClause += " and (s.website = :website)";
		}
		
		if(searchDto.getImportant() != null) {
			whereClause += " and (s.important = :important)";
		}
		
		BrandDto brandDto = null;
		if(searchDto.getBrand() != null && searchDto.getBrand().getUrl() != null) {
			brandDto = brandRepository.findByUrl(searchDto.getBrand().getUrl());
			if(brandDto != null) {
				whereClause += " and (s.brand.id = :brandId)";
			}
			
		}
		
		sql += whereClause + " order by s.important";
		sqlCount += whereClause;
		

		Query q = manager.createQuery(sql, ShoesDto.class);
		Query qCount = manager.createQuery(sqlCount);

		if (textSearch != null && textSearch.length() > 0) {
			q.setParameter("textSearch", '%' + textSearch + '%');
			qCount.setParameter("textSearch", '%' + textSearch + '%');
		}
		
		if(searchDto.getType() != null) {
			q.setParameter("type",searchDto.getType());
			qCount.setParameter("type",searchDto.getType());
		}
		
		if(searchDto.getImportant() != null) {
			q.setParameter("brandId",searchDto.getImportant());
			qCount.setParameter("brandId",searchDto.getImportant());
		}
		
		if(searchDto.getWebsite() != null) {
			q.setParameter("website",searchDto.getWebsite());
			qCount.setParameter("website",searchDto.getWebsite());
		}
		
		if(searchDto.getBrand() != null && searchDto.getBrand().getUrl() != null) {
			brandDto = brandRepository.findByUrl(searchDto.getBrand().getUrl());
			if(brandDto != null) {
				q.setParameter("brandId",brandDto.getId());
				qCount.setParameter("brandId",brandDto.getId());
			}
			
		}
		

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<ShoesDto> page = new PageImpl<ShoesDto>(q.getResultList(), pageable, numberResult);
		return page;
	}
	
	@Override
	public Page<ShoesDisplayDto> getPageObjectDisplay(ShoesDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.ShoesDisplayDto(s) from Shoes s where (1=1)";
		String sqlCount = "select count(s.id) from Shoes s where (1=1)";
		String whereClause = "";

		if (textSearch != null && textSearch.length() > 0) {
			whereClause += " and (s.name like :textSearch or s.code like :textSearch)";
		}
		
		if(searchDto.getType() != null) {
			whereClause += " and (s.type = :type)";
		}
		
		if(searchDto.getImportant() != null) {
			whereClause += " and (s.important = :important)";
		}
		
		if(searchDto.getWebsite() != null) {
			whereClause += " and (s.website = :website)";
		}
		
		BrandDto brandDto = null;
		if(searchDto.getBrand() != null && searchDto.getBrand().getUrl() != null) {
			brandDto = brandRepository.findByUrl(searchDto.getBrand().getUrl());
			if(brandDto != null) {
				whereClause += " and (s.brand.id = :brandId)";
			}
			
		}
		
		sql += whereClause + " order by s.important";
		sqlCount += whereClause;
		

		Query q = manager.createQuery(sql, ShoesDisplayDto.class);
		Query qCount = manager.createQuery(sqlCount);

		if (textSearch != null && textSearch.length() > 0) {
			q.setParameter("textSearch", '%' + textSearch + '%');
			qCount.setParameter("textSearch", '%' + textSearch + '%');
		}
		
		if(searchDto.getWebsite() != null) {
			q.setParameter("website",searchDto.getWebsite());
			qCount.setParameter("website",searchDto.getWebsite());
		}
		
		if(searchDto.getType() != null) {
			q.setParameter("type",searchDto.getType());
			qCount.setParameter("type",searchDto.getType());
		}
		
		if(searchDto.getImportant() != null) {
			q.setParameter("brandId",searchDto.getImportant());
			qCount.setParameter("brandId",searchDto.getImportant());
		}
		
		if(searchDto.getBrand() != null && searchDto.getBrand().getUrl() != null) {
			brandDto = brandRepository.findByUrl(searchDto.getBrand().getUrl());
			if(brandDto != null) {
				q.setParameter("brandId",brandDto.getId());
				qCount.setParameter("brandId",brandDto.getId());
			}
			
		}
		

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<ShoesDisplayDto> page = new PageImpl<ShoesDisplayDto>(q.getResultList(), pageable, numberResult);
		return page;
	}
	
	@Override
	public Page<ShoesDisplayDto> getPageArchitectureDisplay(ShoesDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.ArchitectureDisplayDto(s) from Shoes s where (1=1)";
		String sqlCount = "select count(s.id) from Shoes s where (1=1)";
		String whereClause = "";

		if (textSearch != null && textSearch.length() > 0) {
			whereClause += " and (s.name like :textSearch or s.code like :textSearch)";
		}
		
		if(searchDto.getType() != null) {
			if(searchDto.getType() == 4) {
				whereClause += " and (s.type = :type)";	
			}else {
				whereClause += " and (s.type = :type or s.type = 3)";
			}
			
		}
		
		if(searchDto.getFlagShip() != null) {
			whereClause += " and (s.flagShip = :flagShip)";
		}
		
		if(searchDto.getImportant() != null) {
			whereClause += " and (s.important = :important)";
		}
		
		if(searchDto.getWebsite() != null) {
			whereClause += " and (s.website = :website)";
		}
		
		BrandDto brandDto = null;
		if(searchDto.getBrand() != null && searchDto.getBrand().getUrl() != null) {
			brandDto = brandRepository.findByUrl(searchDto.getBrand().getUrl());
			if(brandDto != null) {
				whereClause += " and (s.brand.id = :brandId)";
			}
			
		}
		
		sql += whereClause +  " order by s.important DESC, s.createDate DESC ";
		sqlCount += whereClause;
		

		Query q = manager.createQuery(sql, ArchitectureDisplayDto.class);
		Query qCount = manager.createQuery(sqlCount);

		if (textSearch != null && textSearch.length() > 0) {
			q.setParameter("textSearch", '%' + textSearch + '%');
			qCount.setParameter("textSearch", '%' + textSearch + '%');
		}
		
		if(searchDto.getWebsite() != null) {
			q.setParameter("website",searchDto.getWebsite());
			qCount.setParameter("website",searchDto.getWebsite());
		}
		
		if(searchDto.getType() != null) {
			q.setParameter("type",searchDto.getType());
			qCount.setParameter("type",searchDto.getType());
		}
		
		if(searchDto.getFlagShip() != null) {
			q.setParameter("flagShip",searchDto.getFlagShip());
			qCount.setParameter("flagShip",searchDto.getFlagShip());
		}
		
		if(searchDto.getImportant() != null) {
			q.setParameter("brandId",searchDto.getImportant());
			qCount.setParameter("brandId",searchDto.getImportant());
		}
		
		if(searchDto.getBrand() != null && searchDto.getBrand().getUrl() != null) {
			brandDto = brandRepository.findByUrl(searchDto.getBrand().getUrl());
			if(brandDto != null) {
				q.setParameter("brandId",brandDto.getId());
				qCount.setParameter("brandId",brandDto.getId());
			}
			
		}
		

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<ShoesDisplayDto> page = new PageImpl<ShoesDisplayDto>(q.getResultList(), pageable, numberResult);
		return page;
	}

	@Override
	public List<ShoesDto> getListObject(ShoesDto searchDto, int pageIndex, int pageSize) {
		return null;
	}

	@Override
	public ShoesDto getObjectById(Long id) {
		return new ShoesDto(shoesRepository.getOne(id));
	}

	@Override
	public ShoesDto saveObject(ShoesDto dto) {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User modifiedUser = null;
		LocalDateTime currentDate = LocalDateTime.now();
		String currentUserName = "Unknown User";
		if (authentication != null) {
			modifiedUser = (User) authentication.getPrincipal();
			currentUserName = modifiedUser.getUsername();
		}
		
		ShoesDto rest = new ShoesDto();
		if(dto == null) {
			return rest;
		}
		Shoes domain = null;
		if(dto.getId() != null) {
			domain = shoesRepository.getOne(dto.getId());
		}
		if(domain != null) {
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(currentDate);
		}
		if(domain == null) {
			domain = new Shoes();
			domain.setCreateDate(currentDate);
			domain.setCreatedBy(currentUserName);
		}
		
		domain.setName(dto.getName());
		domain.setCode(dto.getCode());
		domain.setUrl(dto.getUrl());
		
		domain.setImportant(dto.getImportant());
		domain.setFirstPrice(dto.getFirstPrice());
		domain.setSecondPrice(dto.getSecondPrice());
		domain.setQuantity(dto.getQuantity());
		domain.setType(dto.getType());
		domain.setFlagShip(dto.getFlagShip());
		domain.setVideoUrl(dto.getVideoUrl());
		domain.setReduction(dto.getReduction());
		domain.setDescription(dto.getDescription());
		domain.setWebsite(dto.getWebsite());
		
		if(dto.getBrand() != null && dto.getBrand().getId() != null) {
			Brand brand = brandRepository.getOne(dto.getBrand().getId());
			if(brand != null) {
				domain.setBrand(brand);
			}
		}
		
		if(dto.getShoesSizes() !=null && dto.getShoesSizes().size()>0) {
			HashSet<ShoesSizes> childrens = new HashSet<ShoesSizes>();
			for(ShoesSizesDto q:dto.getShoesSizes()) {
				ShoesSizes children = null;
				if(q.getId()!=null) {
					children= shoesSizesRepository.getOne(q.getId());
				}
				if(children == null) {
					children = new ShoesSizes();
					children.setCreateDate(currentDate);
					children.setCreatedBy(currentUserName);
				}
				children.setShoes(domain);
				if(q.getAllSize() != null && q.getAllSize().getId() != null) {
					children.setAllSize(allSizesRepository.getOne(q.getAllSize().getId()));
				}
				children.setQuantity(q.getQuantity());
				childrens.add(children);
			}
			if(domain.getShoesSizes()!=null) {
				domain.getShoesSizes().clear();
				domain.getShoesSizes().addAll(childrens);
			}else {
				domain.setShoesSizes(childrens);
			}
		}else if(dto.getShoesSizes()==null || dto.getShoesSizes().size()<=0) {
			if(domain.getShoesSizes() != null && domain.getShoesSizes().size() > 0) {
				domain.getShoesSizes().clear();
			}
		}
		
		if(dto.getShoesImageUrls() !=null && dto.getShoesImageUrls().size()>0) {
			for (ShoesImageUrlsDto shoesImageUrlsDto : dto.getShoesImageUrls()) {
				if(shoesImageUrlsDto.getId() != null) {
					ShoesImageUrls s = shoesImageUrlsRepository.getOne(shoesImageUrlsDto.getId());
					if(s != null) {
						s.setOrdinalNumber(shoesImageUrlsDto.getOrdinalNumber());
						s.setImagePath(shoesImageUrlsDto.getImagePath());
						shoesImageUrlsRepository.save(s);
					}
				}
			}
		}
		
//		if(dto.getShoesImageUrls() !=null && dto.getShoesImageUrls().size()>0) {
//			HashSet<ShoesImageUrls> childrens = new HashSet<ShoesImageUrls>();
//			for(ShoesImageUrlsDto q:dto.getShoesImageUrls()) {
//				ShoesImageUrls children = null;
//				if(q.getId()!=null) {
//					children= shoesImageUrlsRepository.getOne(q.getId());
//				}
//				if(children == null) {
//					children = new ShoesImageUrls();
//					children.setCreateDate(currentDate);
//					children.setCreatedBy(currentUserName);
//				}
//				children.setShoes(domain);
////				if(q.getImageUrl() != null && q.getImageUrl().getId() != null) {
////					children.setImageUrl(imageUrlsRepository.getOne(q.getImageUrl().getId()));
////				}
//				children.setOrdinalNumber(q.getOrdinalNumber());
//				childrens.add(children);
//			}
//			if(domain.getShoesImageUrls()!=null) {
//				domain.getShoesImageUrls().clear();
//				domain.getShoesImageUrls().addAll(childrens);
//			}else {
//				domain.setShoesImageUrls(childrens);
//			}
//		}else if(dto.getShoesImageUrls()==null || dto.getShoesImageUrls().size()<=0) {
//			if(domain.getShoesImageUrls() != null && domain.getShoesImageUrls().size() > 0) {
//				domain.getShoesImageUrls().clear();
//			}
//		}
		
		domain = shoesRepository.save(domain);
		rest = new ShoesDto(domain);
		
		return rest;
	}

	@Override
	public boolean deleteObject(Long id) {
		if(id == null) {
			return false;
		}
		Shoes domain = shoesRepository.getOne(id);
		if(domain == null) {
			return false;
		}
		shoesRepository.delete(domain);
		return true;
	}

}
