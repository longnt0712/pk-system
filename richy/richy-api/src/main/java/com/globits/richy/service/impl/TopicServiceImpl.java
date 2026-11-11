package com.globits.richy.service.impl;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import javax.persistence.EntityManager;
import javax.persistence.LockModeType;
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
	@Transactional(readOnly = true)
	public Page<TopicDto> getPageObject(TopicDto searchDto, int pageIndex, int pageSize) {
		return getPage(searchDto, pageIndex, pageSize, false);
	}

	@Override
	@Transactional(readOnly = true)
	public Page<TopicDto> getPageObjectForGames(TopicDto searchDto, int pageIndex, int pageSize) {
		return getPage(searchDto, pageIndex, pageSize, true);
	}

	private Page<TopicDto> getPage(TopicDto searchDto, int pageIndex, int pageSize, boolean forGames) {
		Pageable pageable = new PageRequest(Math.max(1, pageIndex) - 1, pageSize);
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User user = VocabularyPolicy.authenticatedUser(authentication);
		boolean admin = VocabularyPolicy.hasRole(authentication, "ROLE_ADMIN");
		Map<String, Object> parameters = new LinkedHashMap<>();
		StringBuilder from = new StringBuilder(" from Topic s left join s.topicCategory category where ");
		if (forGames) {
			appendPlayableTopics(from, parameters, user, searchDto.getUserId());
		} else {
			if (user == null) { return new PageImpl<>(Collections.emptyList(), pageable, 0); }
			Long ownerId = admin && searchDto.getUserId() != null ? searchDto.getUserId() : user.getId();
			from.append("s.user.id = :lessonOwner and (category.ownerId is null or category.ownerId = :viewerId)");
			parameters.put("lessonOwner", ownerId);
			parameters.put("viewerId", user.getId());
			if (searchDto.isWithoutCategory()) {
				from.append(admin ? " and s.topicCategory is null" : " and category.ownerId is null");
			}
		}
		String textSearch = searchDto.getTextSearch();
		if (textSearch != null && !textSearch.isEmpty()) {
			from.append(" and s.name like :textSearch");
			parameters.put("textSearch", "%" + textSearch + "%");
		}
		String contentSearch = searchDto.getContentSearch();
		if (contentSearch != null && !contentSearch.isEmpty()) {
			from.append(" and (s.content like :contentSearch or s.contentHtml like :contentSearch)");
			parameters.put("contentSearch", "%" + contentSearch + "%");
		}
		if (searchDto.getTopicCategory() != null && searchDto.getTopicCategory().getId() != null) {
			from.append(" and category.id = :topicCategoryId");
			parameters.put("topicCategoryId", searchDto.getTopicCategory().getId());
			if (!admin && !forGames) { from.append(" and category.ownerId = :viewerId"); }
		}
		TypedQuery<TopicDto> page = manager.createQuery("select new com.globits.richy.dto.TopicDto(s)" + from
				+ " order by s.createDate desc, s.id desc", TopicDto.class);
		TypedQuery<Long> count = manager.createQuery("select count(s.id)" + from, Long.class);
		parameters.forEach(page::setParameter);
		parameters.forEach(count::setParameter);
		return new PageImpl<>(page.setFirstResult(pageable.getOffset()).setMaxResults(pageSize).getResultList(),
				pageable, count.getSingleResult());
	}

	@Override
	public List<TopicDto> getListObject() {
		return topicRepository.getListObject();
	}

	@Override
	@Transactional(readOnly = true)
	public List<TopicForListAllDto> getAllTopics(TopicDto searchDto) {
		User user = VocabularyPolicy.authenticatedUser(SecurityContextHolder.getContext().getAuthentication());
		Map<String, Object> parameters = new LinkedHashMap<>();
		StringBuilder from = new StringBuilder(" from Topic s left join s.topicCategory category where ");
		appendPlayableTopics(from, parameters, user, searchDto.getUserId());
		TypedQuery<TopicForListAllDto> query = manager.createQuery("select new com.globits.richy.dto.TopicForListAllDto(s)"
				+ from + " order by s.createDate desc, s.id desc", TopicForListAllDto.class);
		parameters.forEach(query::setParameter);
		return query.getResultList();
	}

	private void appendPlayableTopics(StringBuilder from, Map<String, Object> parameters, User user, Long sourceId) {
		Set<Long> allowed = topicCategoryVisibilityService.getAllowedCategoryIdsForCurrentStudent();
		String shared = "category.ownerId is null";
		if (allowed != null) {
			shared = allowed.isEmpty() ? "1=0" : shared + " and category.id in (:allowed)";
			if (!allowed.isEmpty()) { parameters.put("allowed", allowed); }
		}
		from.append("(s.isShow = true or s.isShow is null) and ((").append(shared).append(")");
		if (user != null) {
			from.append(" or category.ownerId = :viewerId");
			parameters.put("viewerId", user.getId());
		}
		from.append(")");
		Long owner = sourceId != null ? sourceId : user == null ? null : user.getId();
		if (owner != null) {
			from.append(" and s.user.id = :lessonOwner");
			parameters.put("lessonOwner", owner);
		}
	}

	@Override
	@Transactional(readOnly = true)
	public TopicDto getObjectById(Long id) {
		Topic topic = topicRepository.findOne(id);
		if (topic == null) { return null; }
		User user = VocabularyPolicy.authenticatedUser(SecurityContextHolder.getContext().getAuthentication());
		Long userId = user == null ? null : user.getId();
		TopicCategory category = topic.getTopicCategory();
		if (category != null && category.getOwnerId() != null && !category.getOwnerId().equals(userId)) { return null; }
		if (userId != null && topic.getUser() != null && userId.equals(topic.getUser().getId())) {
			return new TopicDto(topic, true);
		}
		Set<Long> allowed = topicCategoryVisibilityService.getAllowedCategoryIdsForCurrentStudent();
		return allowed == null || (category != null && allowed.contains(category.getId())) ? new TopicDto(topic, true) : null;
	}

	@Override
	@Transactional
	public TopicDto saveObject(TopicDto dto) {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User modifiedUser = VocabularyPolicy.authenticatedUser(authentication);
		if (modifiedUser == null) {
			throw new AccessDeniedException("Bạn cần đăng nhập để lưu bài từ vựng.");
		}
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
		if (!isAdmin && dto.getUserId() != null && !modifiedUser.getId().equals(dto.getUserId())) {
			throw new AccessDeniedException("Bạn chỉ được lưu bài từ vựng của chính mình.");
		}
		User newOwner = null;
		if (!isAdmin) {
			newOwner = userRepository.findForVocabularyUpdate(modifiedUser.getId());
			if (newOwner == null) { throw new AccessDeniedException("Không xác định được chủ sở hữu bài từ vựng."); }
		}
		Topic domain = dto.getId() == null ? null : topicRepository.findOne(dto.getId());
		if (!isAdmin && dto.getId() != null && (domain == null || domain.getUser() == null
				|| !modifiedUser.getId().equals(domain.getUser().getId()))) {
			throw new AccessDeniedException("Bạn chỉ được sửa bài từ vựng do chính mình tạo.");
		}
		if (dto.getId() != null && domain == null) {
			ret.setMessage("Bài từ vựng không còn tồn tại.");
			return ret;
		}
		if (domain == null && !isAdmin) {
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
		
		Long categoryId = dto.getTopicCategory() == null ? null : dto.getTopicCategory().getId();
		TopicCategory category = domain.getTopicCategory();
		if (categoryId != null && (category == null || !categoryId.equals(category.getId()))) {
			category = requireLessonCategory(categoryId, modifiedUser, isAdmin);
			domain.setTopicCategory(category);
		}
		if (category != null && category.getOwnerId() != null
				&& (!category.getOwnerId().equals(modifiedUser.getId())
					|| domain.getUser() == null || !category.getOwnerId().equals(domain.getUser().getId()))) {
			throw new AccessDeniedException("Nhóm riêng chỉ chứa bài từ vựng của chủ sở hữu.");
		}
		
		domain = topicRepository.save(domain);
		
		ret = new TopicDto(domain);
		ret.setMessage(message);
		
		return ret;
	}

	@Override
	@Transactional(readOnly = true)
	public List<Long> getLessonSelection(Long sourceCategoryId, String search) {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User owner = lessonBulkOwner(authentication);
		boolean admin = VocabularyPolicy.hasRole(authentication, "ROLE_ADMIN");
		if (sourceCategoryId != null) { requireLessonCategory(sourceCategoryId, owner, admin); }
		boolean searchByName = search != null && !search.isEmpty();
		TypedQuery<Long> ids = manager.createQuery("select s.id from Topic s" + TopicRepository.LESSON_SOURCE
				+ (searchByName ? " and s.name like :search" : ""), Long.class);
		ids.setParameter("owner", owner.getId()).setParameter("source", sourceCategoryId).setParameter("includeShared", !admin);
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
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User owner = lessonBulkOwner(authentication);
		boolean admin = VocabularyPolicy.hasRole(authentication, "ROLE_ADMIN");
		if (request == null || request.lessonIds == null || request.lessonIds.isEmpty()
				|| request.lessonIds.stream().anyMatch(id -> id == null || id < 1)) {
			throw new IllegalArgumentException("Hãy chọn ít nhất một bài hợp lệ.");
		}
		List<Long> ids = new ArrayList<Long>(new HashSet<Long>(request.lessonIds));
		if (userRepository.findForVocabularyUpdate(owner.getId()) == null) {
			throw new AccessDeniedException("Không xác định được chủ sở hữu bài từ vựng.");
		}
		if (sourceCategoryId != null) { requireLessonCategory(sourceCategoryId, owner, admin); }
		TopicCategory category = targetId == null ? null : requireLessonCategory(targetId, owner, admin);
		LocalDateTime now = LocalDateTime.now();
		// Match the source group in each update so a concurrent move cannot be overwritten.
		int batchSize = 500;
		for (int from = 0; from < ids.size(); from += batchSize) {
			List<Long> batch = ids.subList(from, Math.min(from + batchSize, ids.size()));
			int changed;
			if (category == null) {
				manager.createQuery("delete from QuestionTopic link where link.topic.id in (select s.id from Topic s"
						+ TopicRepository.UNCATEGORIZED_OWNER + " and s.id in :ids)")
						.setParameter("owner", owner.getId()).setParameter("includeShared", !admin)
						.setParameter("ids", batch).executeUpdate();
				changed = topicRepository.deleteUncategorizedLessons(batch, owner.getId(), !admin);
			} else {
				changed = topicRepository.moveLessons(batch, owner.getId(), sourceCategoryId, !admin, category, owner.getUsername(), now);
			}
			if (changed != batch.size()) {
				throw new IllegalStateException("Danh sách bài đã thay đổi. Hãy tải lại và chọn lại bài.");
			}
		}
		return ids.size();
	}

	private User lessonBulkOwner(Authentication authentication) {
		User user = VocabularyPolicy.authenticatedUser(authentication);
		if (user == null || "VIEWER".equals(VocabularyPolicy.role(authentication))) {
			throw new AccessDeniedException("Bạn không có quyền quản lý bài từ vựng.");
		}
		return user;
	}

	private TopicCategory requireLessonCategory(Long id, User owner, boolean admin) {
		TopicCategory category = topicCategoryRepository.findOne(id);
		if (category == null || !(owner.getId().equals(category.getOwnerId()) || (admin && category.getOwnerId() == null))) {
			throw new AccessDeniedException("Bạn không có quyền sử dụng nhóm bài này.");
		}
		return category;
	}

	@Override
	@Transactional
	public boolean deleteObject(Long id) {
		if (id == null) { return false; }
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User actor = VocabularyPolicy.authenticatedUser(authentication);
		if (actor == null) {
			throw new AccessDeniedException("Bạn cần đăng nhập để xóa bài từ vựng.");
		}
		boolean admin = "ADMIN".equals(VocabularyPolicy.role(authentication));
		Topic domain = manager.find(Topic.class, id, LockModeType.PESSIMISTIC_WRITE);
		if (domain == null) { return false; }
		if (!admin && (domain.getUser() == null || !actor.getId().equals(domain.getUser().getId()))) {
			throw new AccessDeniedException("Bạn chỉ được xóa bài từ vựng do chính mình tạo.");
		}
		// Removing a vocabulary lesson must never remove its flashcards.
		manager.createQuery("delete from QuestionTopic link where link.topic.id = :lesson")
				.setParameter("lesson", id).executeUpdate();
		topicRepository.delete(domain);
		return true;
	}

}
