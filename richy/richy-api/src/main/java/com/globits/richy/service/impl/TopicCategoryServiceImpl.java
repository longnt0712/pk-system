package com.globits.richy.service.impl;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

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
import org.springframework.transaction.annotation.Transactional;
import com.globits.richy.domain.TopicCategory;
import com.globits.richy.dto.TopicCategoryDto;
import com.globits.richy.repository.TopicCategoryRepository;
import com.globits.richy.service.TopicCategoryService;
import com.globits.security.domain.User;

@Service
public class TopicCategoryServiceImpl implements TopicCategoryService {
	@Autowired
	EntityManager manager;
	@Autowired
	TopicCategoryRepository topicCategoryRepository;
	@Autowired
	TopicCategoryVisibilityService topicCategoryVisibilityService;

	@Override
	public Page<TopicCategoryDto> getPageObject(TopicCategoryDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

//		String textSearch = searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.TopicCategoryDto(s) from TopicCategory s where (1=1)";
		String sqlCount = "select count(s.id) from TopicCategory s where (1=1)";
		String whereClause = "";
		Set<Long> allowedCategoryIds = topicCategoryVisibilityService.getAllowedCategoryIdsForCurrentStudent();
		if (allowedCategoryIds != null) {
			whereClause += allowedCategoryIds.isEmpty()
					? " and (1=0)"
					: " and s.id in (:allowedCategoryIds)";
		}

//		if (textSearch != null && textSearch.length() > 0) {
//			whereClause += " and (s.text like :textSearch)";
//		}

		sql += whereClause + " order by s.id";
		sqlCount += whereClause;

		Query q = manager.createQuery(sql, TopicCategoryDto.class);
		Query qCount = manager.createQuery(sqlCount);
		if (allowedCategoryIds != null && !allowedCategoryIds.isEmpty()) {
			q.setParameter("allowedCategoryIds", allowedCategoryIds);
			qCount.setParameter("allowedCategoryIds", allowedCategoryIds);
		}

//		if (textSearch != null && textSearch.length() > 0) {
//			q.setParameter("textSearch", '%' + textSearch + '%');
//			qCount.setParameter("textSearch", '%' + textSearch + '%');
//		}

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<TopicCategoryDto> page = new PageImpl<TopicCategoryDto>(q.getResultList(), pageable, numberResult);
		return page;
	}

//	@Override
//	public List<TopicCategoryDto> getListObject(TopicCategoryDto searchDto, int pageIndex, int pageSize) {
//		return null;
//	}

	@Override
	public TopicCategoryDto getObjectById(Long id) {
		TopicCategory category = topicCategoryRepository.findOne(id);
		if (category == null) { return null; }
		Set<Long> allowedCategoryIds = topicCategoryVisibilityService.getAllowedCategoryIdsForCurrentStudent();
		if (allowedCategoryIds != null && !allowedCategoryIds.contains(category.getId())) { return null; }
		return new TopicCategoryDto(category);
	}

	@Override
	@Transactional
	public boolean saveObject(TopicCategoryDto dto) {
		if (dto == null || dto.getName() == null || dto.getName().trim().isEmpty() || dto.getName().trim().length() > 200) {
			throw new IllegalArgumentException("Tên nhóm phải có từ 1 đến 200 ký tự.");
		}
		Map<Long, TopicCategory> categories = lockCategories();
		TopicCategory domain = dto.getId() == null ? new TopicCategory() : categories.get(dto.getId());
		if (domain == null) { throw new IllegalArgumentException("Nhóm bài không còn tồn tại."); }
		if (dto.isParentSpecified()) {
			TopicCategory parent = dto.getParentId() == null ? null : categories.get(dto.getParentId());
			if (dto.getParentId() != null && parent == null) { throw new IllegalArgumentException("Nhóm cha không còn tồn tại."); }
			Set<Long> visited = new HashSet<Long>();
			for (TopicCategory ancestor = parent; ancestor != null; ancestor = ancestor.getParent()) {
				if (ancestor.getId().equals(dto.getId()) || !visited.add(ancestor.getId())) {
					throw new IllegalArgumentException("Không thể chuyển nhóm vào chính nó hoặc nhóm con của nó.");
				}
			}
			domain.setParent(parent);
		}
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		LocalDateTime currentDate = LocalDateTime.now();
		String currentUserName = authentication == null ? "Unknown User" : authentication.getName();
		if (domain.getId() == null) {
			domain.setCreateDate(currentDate);
			domain.setCreatedBy(currentUserName);
		} else {
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(currentDate);
		}
		domain.setName(dto.getName().trim());
		topicCategoryRepository.save(domain);
		return true;
	}

	@Override
	@Transactional
	public boolean deleteObject(Long id) {
		Map<Long, TopicCategory> categories = lockCategories();
		TopicCategory domain = categories.get(id);
		if (domain == null) { return false; }
		for (TopicCategory category : categories.values()) {
			if (category.getParent() != null && id.equals(category.getParent().getId())) {
				throw new IllegalArgumentException("Hãy chuyển các nhóm con trước khi xóa nhóm này.");
			}
		}
		if (!manager.createQuery("select topic.id from Topic topic where topic.topicCategory.id = :id", Long.class)
				.setParameter("id", id).setMaxResults(1).getResultList().isEmpty()) {
			throw new IllegalArgumentException("Nhóm còn bài từ vựng. Hãy chuyển các bài sang nhóm khác trước khi xóa.");
		}
		topicCategoryRepository.delete(domain);
		return true;
	}

	private Map<Long, TopicCategory> lockCategories() {
		Map<Long, TopicCategory> categories = new LinkedHashMap<Long, TopicCategory>();
		for (TopicCategory category : topicCategoryRepository.lockHierarchy()) { categories.put(category.getId(), category); }
		return categories;
	}

}
