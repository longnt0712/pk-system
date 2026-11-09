package com.globits.richy.service.impl;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import javax.persistence.EntityManager;
import javax.persistence.Query;
import javax.persistence.TypedQuery;

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
import org.springframework.security.access.AccessDeniedException;
import com.globits.richy.question.VocabularyPolicy;

import com.globits.richy.test;
import com.globits.richy.domain.Topic;
import com.globits.richy.domain.TopicCategory;
import com.globits.richy.dto.TopicDto;
import com.globits.richy.dto.TopicForListAllDto;
import com.globits.richy.dto.VocabularyLessonBulkActionDto;
import com.globits.richy.repository.TopicCategoryRepository;
import com.globits.richy.repository.TopicRepository;
import com.globits.richy.service.TopicService;
import com.globits.security.domain.User;
import com.globits.security.repository.UserRepository;

@Service
public class TopicServiceImpl implements TopicService {
	@Autowired
	EntityManager manager;
	@Autowired
	TopicRepository topicRepository;
	@Autowired
	TopicCategoryRepository topicCategoryRepository;
	@Autowired
	UserRepository userRepository;
	@Autowired
	TopicCategoryVisibilityService topicCategoryVisibilityService;
	
	@Override
	public Page<TopicDto> getPageObject(TopicDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();
		String contentSearch = searchDto.getContentSearch();
		
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User modifiedUser = null;
		if (authentication != null) {
			modifiedUser = (User) authentication.getPrincipal();
		}

		String sql = "select new com.globits.richy.dto.TopicDto(s) from Topic s where (1=1)";
		String sqlCount = "select count(s.id) from Topic s where (1=1)";
		String whereClause = "";
		Set<Long> allowedCategoryIds = topicCategoryVisibilityService.getAllowedCategoryIdsForCurrentStudent();
		if (allowedCategoryIds != null) {
			whereClause += allowedCategoryIds.isEmpty()
					? " and (1=0)"
					: " and s.topicCategory.id in (:allowedCategoryIds)";
		}
		
		if(modifiedUser!= null && modifiedUser.getId() != null) {
			whereClause += " and s.user.id = :userId ";
		}

		if (textSearch != null && textSearch.length() > 0) {
			whereClause += " and (s.name like :textSearch)";
		}
		
		if (contentSearch != null && contentSearch.length() > 0) {
			whereClause += " and (s.content like :contentSearch or s.contentHtml like :contentSearch)";
		}
		
		if(searchDto.getTopicCategory() != null && searchDto.getTopicCategory().getId() != null ){
			whereClause += " and s.topicCategory.id = :topicCategoryId ";
		}
		if (searchDto.isWithoutCategory()) { whereClause += " and s.topicCategory is null"; }
//		if(searchDto.getWebsite() != null) {
//			whereClause += " and (s.website = :website) ";
//		}

		sql += whereClause;
		sqlCount += whereClause;
		
		sql += " order by s.createDate DESC, s.id DESC ";

		Query q = manager.createQuery(sql, TopicDto.class);
		Query qCount = manager.createQuery(sqlCount);
		if (allowedCategoryIds != null && !allowedCategoryIds.isEmpty()) {
			q.setParameter("allowedCategoryIds", allowedCategoryIds);
			qCount.setParameter("allowedCategoryIds", allowedCategoryIds);
		}

		if (textSearch != null && textSearch.length() > 0) {
			q.setParameter("textSearch", '%' + textSearch + '%');
			qCount.setParameter("textSearch", '%' + textSearch + '%');
		}
		
		if (contentSearch != null && contentSearch.length() > 0) {
			q.setParameter("contentSearch", '%' + contentSearch + '%');
			qCount.setParameter("contentSearch", '%' + contentSearch + '%');
		}
		
		if(modifiedUser!= null && modifiedUser.getId() != null) {
			q.setParameter("userId",  modifiedUser.getId() );
			qCount.setParameter("userId",  modifiedUser.getId());
		}
		
		if(searchDto.getTopicCategory() != null && searchDto.getTopicCategory().getId() != null ){
			q.setParameter("topicCategoryId",  searchDto.getTopicCategory().getId() );
			qCount.setParameter("topicCategoryId",  searchDto.getTopicCategory().getId());
		}
		
//		if(searchDto.getWebsite() != null) {
//			q.setParameter("website",searchDto.getWebsite());
//			qCount.setParameter("website",searchDto.getWebsite());
//		}
		
		if(searchDto.getUserId() != null) {
			q.setParameter("userId", searchDto.getUserId());
			qCount.setParameter("userId", searchDto.getUserId());
		}
		

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<TopicDto> page = new PageImpl<TopicDto>(q.getResultList(), pageable, numberResult);
		return page;
	}
	
	@Override
	public Page<TopicDto> getPageObjectForGames(TopicDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();
		String contentSearch = searchDto.getContentSearch();
		
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User modifiedUser = null;
		if (authentication != null) {
			modifiedUser = (User) authentication.getPrincipal();
		}

		String sql = "select new com.globits.richy.dto.TopicDto(s) from Topic s where (1=1)";
		String sqlCount = "select count(s.id) from Topic s where (1=1)";
		String whereClause = "";
		Set<Long> allowedCategoryIds = topicCategoryVisibilityService.getAllowedCategoryIdsForCurrentStudent();
		if (allowedCategoryIds != null) {
			whereClause += allowedCategoryIds.isEmpty()
					? " and (1=0)"
					: " and s.topicCategory.id in (:allowedCategoryIds)";
		}
		
		if(modifiedUser!= null && modifiedUser.getId() != null) {
			whereClause += " and s.user.id = :userId ";
		}

		if (textSearch != null && textSearch.length() > 0) {
			whereClause += " and (s.name like :textSearch)";
		}
		
		if (contentSearch != null && contentSearch.length() > 0) {
			whereClause += " and (s.content like :contentSearch or s.contentHtml like :contentSearch)";
		}
		
		if(searchDto.getTopicCategory() != null && searchDto.getTopicCategory().getId() != null ){
			whereClause += " and s.topicCategory.id = :topicCategoryId ";
		}
		
		whereClause += " and (s.isShow = true or s.isShow is null) ";
//		if(searchDto.getWebsite() != null) {
//			whereClause += " and (s.website = :website) ";
//		}

		sql += whereClause;
		sqlCount += whereClause;
		
		sql += " order by s.createDate DESC ";

		Query q = manager.createQuery(sql, TopicDto.class);
		Query qCount = manager.createQuery(sqlCount);
		if (allowedCategoryIds != null && !allowedCategoryIds.isEmpty()) {
			q.setParameter("allowedCategoryIds", allowedCategoryIds);
			qCount.setParameter("allowedCategoryIds", allowedCategoryIds);
		}

		if (textSearch != null && textSearch.length() > 0) {
			q.setParameter("textSearch", '%' + textSearch + '%');
			qCount.setParameter("textSearch", '%' + textSearch + '%');
		}
		
		if (contentSearch != null && contentSearch.length() > 0) {
			q.setParameter("contentSearch", '%' + contentSearch + '%');
			qCount.setParameter("contentSearch", '%' + contentSearch + '%');
		}
		
		if(modifiedUser!= null && modifiedUser.getId() != null) {
			q.setParameter("userId",  modifiedUser.getId() );
			qCount.setParameter("userId",  modifiedUser.getId());
		}
		
		if(searchDto.getTopicCategory() != null && searchDto.getTopicCategory().getId() != null ){
			q.setParameter("topicCategoryId",  searchDto.getTopicCategory().getId() );
			qCount.setParameter("topicCategoryId",  searchDto.getTopicCategory().getId());
		}
		
//		if(searchDto.getWebsite() != null) {
//			q.setParameter("website",searchDto.getWebsite());
//			qCount.setParameter("website",searchDto.getWebsite());
//		}
		
		if(searchDto.getUserId() != null) {
			q.setParameter("userId", searchDto.getUserId());
			qCount.setParameter("userId", searchDto.getUserId());
		}
		

		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();

		Page<TopicDto> page = new PageImpl<TopicDto>(q.getResultList(), pageable, numberResult);
		return page;
	}

	@Override
	public List<TopicDto> getListObject() {
		return topicRepository.getListObject();
	}
	
	@Override
	public List<TopicForListAllDto> getAllTopics(TopicDto searchDto) {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User modifiedUser = null;
		if (authentication != null) {
			modifiedUser = (User) authentication.getPrincipal();
		}

		String sql = "select new com.globits.richy.dto.TopicForListAllDto(s) from Topic s where (1=1)";
		String whereClause = " and (s.isShow = true or s.isShow is null) ";
		Set<Long> allowedCategoryIds = topicCategoryVisibilityService.getAllowedCategoryIdsForCurrentStudent();
		if (allowedCategoryIds != null) {
			whereClause += allowedCategoryIds.isEmpty()
					? " and (1=0)"
					: " and s.topicCategory.id in (:allowedCategoryIds)";
		}
		
		if(modifiedUser!= null && modifiedUser.getId() != null) {
			whereClause += " and s.user.id = :userId ";
		}
		
//		if(searchDto.getWebsite() != null) {
//			whereClause += " and (s.website = :website) ";
//		}

		sql += whereClause;
		
		sql += " order by s.createDate DESC ";

		Query q = manager.createQuery(sql, TopicForListAllDto.class);
		if (allowedCategoryIds != null && !allowedCategoryIds.isEmpty()) {
			q.setParameter("allowedCategoryIds", allowedCategoryIds);
		}
		
		if(modifiedUser!= null && modifiedUser.getId() != null) {
			q.setParameter("userId",  modifiedUser.getId() );
		}
		
//		if(searchDto.getWebsite() != null) {
//			q.setParameter("website",searchDto.getWebsite());
//		}
		
		if(searchDto.getUserId() != null) {
			q.setParameter("userId", searchDto.getUserId());
		}

		return q.getResultList();
	}

	@Override
	public TopicDto getObjectById(Long id) {
		Topic topic = topicRepository.findOne(id);
		if (topic == null) { return null; }
		Set<Long> allowedCategoryIds = topicCategoryVisibilityService.getAllowedCategoryIdsForCurrentStudent();
		Long categoryId = topic.getTopicCategory() == null ? null : topic.getTopicCategory().getId();
		if (allowedCategoryIds != null && (categoryId == null || !allowedCategoryIds.contains(categoryId))) {
			return null;
		}
		return new TopicDto(topic,true);
	}

	@Override
	@Transactional
	public TopicDto saveObject(TopicDto dto) {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication == null || !authentication.isAuthenticated() || !(authentication.getPrincipal() instanceof User)) {
			throw new AccessDeniedException("Bạn cần đăng nhập để lưu bài từ vựng.");
		}
		User modifiedUser = (User) authentication.getPrincipal();
		boolean isAdmin = VocabularyPolicy.hasRole(authentication, "ROLE_ADMIN");
		VocabularyPolicy.role(authentication);
		LocalDateTime currentDate = LocalDateTime.now();
		String currentUserName = modifiedUser.getUsername();
		
		TopicDto ret = new TopicDto();
		String message = "Successfully";
		
		if(dto == null) {
			return ret;
		}
		if (dto.getName() == null || dto.getName().trim().isEmpty()) {
			ret.setMessage("Vui lòng nhập tên bài từ vựng."); return ret;
		}
		if (!isAdmin && (modifiedUser.getId() == null
				|| (dto.getUserId() != null && !modifiedUser.getId().equals(dto.getUserId())))) {
			throw new AccessDeniedException("Bạn chỉ được lưu bài từ vựng của chính mình.");
		}
		Topic domain = null;
		if(dto.getId() != null) {
			domain = topicRepository.getOne(dto.getId());
		}
		if (!isAdmin && dto.getId() != null && (domain == null || domain.getUser() == null
				|| !modifiedUser.getId().equals(domain.getUser().getId()))) {
			throw new AccessDeniedException("Bạn chỉ được sửa bài từ vựng do chính mình tạo.");
		}
		if (!isAdmin && dto.getTopicCategory() != null && dto.getTopicCategory().getId() != null) {
			Set<Long> allowed = topicCategoryVisibilityService.getAllowedCategoryIdsForCurrentStudent();
			if (allowed != null && !allowed.contains(dto.getTopicCategory().getId())) {
				throw new AccessDeniedException("Bạn không có quyền chọn nhóm bài từ vựng này.");
			}
		}
		User newOwner = null;
		if (domain == null && !isAdmin) {
			newOwner = userRepository.findForVocabularyUpdate(modifiedUser.getId());
			if (newOwner == null) { throw new AccessDeniedException("Không xác định được chủ sở hữu bài từ vựng."); }
			Long count = topicRepository.countByUserId(modifiedUser.getId());
			long limit = VocabularyPolicy.lessonLimit(authentication);
			if (count != null && count >= limit) { ret.setMessage(VocabularyPolicy.lessonLimitMessage(count, limit)); return ret; }
		}
		if(domain != null) {
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(currentDate);
		}
		if(domain == null) {
			domain = new Topic();
			domain.setCreateDate(currentDate);
			domain.setCreatedBy(currentUserName);
			
			if (!isAdmin) { domain.setUser(newOwner); domain.setIsShow(true); }
		}
		
		if(isAdmin && dto.getUserId() != null) {
			User user = userRepository.getOne(dto.getUserId());
			if(user != null) {
				domain.setUser(user);
			}
		}
		
		if(test.isShortEnoughString(dto.getName())) {
			domain.setName(dto.getName());
		}else {
			message = "The name of the topic should be less than 100 characters";
		}
		
//		domain.setWebsite(dto.getWebsite());
		if (isAdmin) {
			domain.setContent(dto.getContent());
			domain.setContentHtml(dto.getContentHtml());
			domain.setIsShow(dto.getIsShow());
		}
		
		if(dto.getTopicCategory() != null && dto.getTopicCategory().getId() != null) {
			TopicCategory topicCategory = topicCategoryRepository.getOne(dto.getTopicCategory().getId());
			if(topicCategory != null) {
				domain.setTopicCategory(topicCategory);
			}
		}
		
		domain = topicRepository.save(domain);
		
		ret = new TopicDto(domain);
		ret.setMessage(message);
		
		return ret;
	}

	@Override
	@Transactional(readOnly = true)
	public List<Long> getLessonSelection(Long sourceCategoryId, String search) {
		User owner = lessonBulkOwner(sourceCategoryId, null);
		boolean searchByName = search != null && !search.isEmpty();
		TypedQuery<Long> ids = manager.createQuery("select s.id from Topic s" + TopicRepository.LESSON_SOURCE
				+ (searchByName ? " and s.name like :search" : ""), Long.class);
		ids.setParameter("owner", owner.getId()).setParameter("source", sourceCategoryId);
		if (searchByName) { ids.setParameter("search", "%" + search + "%"); }
		return ids.getResultList();
	}

	@Override
	@Transactional
	public int moveLessons(Long sourceCategoryId, VocabularyLessonBulkActionDto request) {
		if (request == null || request.targetCategoryId == null) {
			throw new IllegalArgumentException("Hãy chọn nhóm bài đích.");
		}
		if (request.targetCategoryId.equals(sourceCategoryId)) {
			throw new IllegalArgumentException("Hãy chọn nhóm đích khác với nhóm hiện tại.");
		}
		return changeLessons(sourceCategoryId, request, request.targetCategoryId);
	}

	@Override
	@Transactional
	public int deleteUncategorizedLessons(VocabularyLessonBulkActionDto request) {
		return changeLessons(null, request, null);
	}

	private int changeLessons(Long sourceCategoryId, VocabularyLessonBulkActionDto request, Long targetId) {
		User owner = lessonBulkOwner(sourceCategoryId, targetId);
		if (request == null || request.lessonIds == null || request.lessonIds.isEmpty()
				|| request.lessonIds.stream().anyMatch(id -> id == null || id < 1)) {
			throw new IllegalArgumentException("Hãy chọn ít nhất một bài hợp lệ.");
		}
		List<Long> ids = new ArrayList<Long>(new HashSet<Long>(request.lessonIds));
		if (userRepository.findForVocabularyUpdate(owner.getId()) == null) {
			throw new AccessDeniedException("Không xác định được chủ sở hữu bài từ vựng.");
		}
		TopicCategory category = targetId == null ? null : topicCategoryRepository.findOne(targetId);
		if (targetId != null && category == null) { throw new IllegalStateException("Nhóm đích đã thay đổi. Hãy tải lại danh sách nhóm."); }
		LocalDateTime now = LocalDateTime.now();
		// Match the source group in each update so a concurrent move cannot be overwritten.
		int batchSize = 500;
		for (int from = 0; from < ids.size(); from += batchSize) {
			List<Long> batch = ids.subList(from, Math.min(from + batchSize, ids.size()));
			int changed;
			if (category == null) {
				manager.createQuery("delete from QuestionTopic link where link.topic.id in (select s.id from Topic s"
						+ TopicRepository.UNCATEGORIZED_OWNER + " and s.id in :ids)")
						.setParameter("owner", owner.getId()).setParameter("ids", batch).executeUpdate();
				changed = topicRepository.deleteUncategorizedLessons(batch, owner.getId());
			} else {
				changed = topicRepository.moveLessons(batch, owner.getId(), sourceCategoryId, category, owner.getUsername(), now);
			}
			if (changed != batch.size()) {
				throw new IllegalStateException("Danh sách bài đã thay đổi. Hãy tải lại và chọn lại bài.");
			}
		}
		return ids.size();
	}

	private User lessonBulkOwner(Long sourceCategoryId, Long targetCategoryId) {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication == null || !authentication.isAuthenticated() || !(authentication.getPrincipal() instanceof User)
				|| ((User) authentication.getPrincipal()).getId() == null || "VIEWER".equals(VocabularyPolicy.role(authentication))) {
			throw new AccessDeniedException("Bạn không có quyền quản lý bài từ vựng.");
		}
		Set<Long> allowed = topicCategoryVisibilityService.getAllowedCategoryIdsForCurrentStudent();
		if (allowed != null && (sourceCategoryId == null || !allowed.contains(sourceCategoryId)
				|| (targetCategoryId != null && !allowed.contains(targetCategoryId)))) {
			throw new AccessDeniedException("Bạn không có quyền sử dụng nhóm bài này.");
		}
		return (User) authentication.getPrincipal();
	}

	@Override
	@Transactional
	public boolean deleteObject(Long id) {
		if(id == null) {
			return false;
		}
		Topic domain = topicRepository.getOne(id);
		if(domain == null) {
			return false;
		}
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication == null || !(authentication.getPrincipal() instanceof User)
				|| (!VocabularyPolicy.hasRole(authentication, "ROLE_ADMIN")
					&& (domain.getUser() == null || domain.getUser().getId() == null
						|| !domain.getUser().getId().equals(((User) authentication.getPrincipal()).getId())))) {
			throw new AccessDeniedException("Bạn chỉ được xóa bài từ vựng do chính mình tạo.");
		}
		// Removing a vocabulary lesson must never remove its flashcards.
		manager.createQuery("delete from QuestionTopic link where link.topic.id = :lesson")
				.setParameter("lesson", id).executeUpdate();
		topicRepository.delete(domain);
		return true;
	}

}
