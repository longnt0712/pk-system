package com.globits.richy.service.impl;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import javax.persistence.EntityManager;
import javax.persistence.TypedQuery;

import org.joda.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.globits.richy.domain.TopicCategory;
import com.globits.richy.dto.TopicCategoryDto;
import com.globits.richy.question.VocabularyPolicy;
import com.globits.richy.repository.TopicCategoryRepository;
import com.globits.richy.service.TopicCategoryService;
import com.globits.security.domain.User;
import com.globits.security.repository.UserRepository;

@Service
public class TopicCategoryServiceImpl implements TopicCategoryService {
	@Autowired
	EntityManager manager;
	@Autowired
	TopicCategoryRepository topicCategoryRepository;
	@Autowired
	TopicCategoryVisibilityService topicCategoryVisibilityService;
	@Autowired
	UserRepository userRepository;

	@Override
	@Transactional(readOnly = true)
	public Page<TopicCategoryDto> getPageObject(TopicCategoryDto searchDto, int pageIndex, int pageSize) {
		Pageable pageable = new PageRequest(Math.max(1, pageIndex) - 1, pageSize);
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User user = VocabularyPolicy.authenticatedUser(authentication);
		boolean ownOnly = searchDto != null && searchDto.isPersonalLibrary()
				&& !VocabularyPolicy.hasRole(authentication, "ROLE_ADMIN");
		String privateFolders = user == null ? "1=0" : "s.ownerId = :userId";
		Set<Long> allowed = ownOnly ? null : topicCategoryVisibilityService.getAllowedCategoryIdsForCurrentStudent();
		String sharedFolders = "s.ownerId is null";
		if (allowed != null) {
			sharedFolders = allowed.isEmpty() ? "1=0" : sharedFolders + " and s.id in (:allowed)";
		}
		String from = " from TopicCategory s where " + (ownOnly ? privateFolders : privateFolders + " or (" + sharedFolders + ")");
		TypedQuery<TopicCategoryDto> page = manager.createQuery(
				"select new com.globits.richy.dto.TopicCategoryDto(s)" + from + " order by s.id", TopicCategoryDto.class);
		TypedQuery<Long> count = manager.createQuery("select count(s.id)" + from, Long.class);
		if (user != null) {
			page.setParameter("userId", user.getId());
			count.setParameter("userId", user.getId());
		}
		if (allowed != null && !allowed.isEmpty()) {
			page.setParameter("allowed", allowed);
			count.setParameter("allowed", allowed);
		}
		return new PageImpl<>(page.setFirstResult(pageable.getOffset()).setMaxResults(pageSize).getResultList(),
				pageable, count.getSingleResult());
	}

	@Override
	@Transactional(readOnly = true)
	public TopicCategoryDto getObjectById(Long id) {
		TopicCategory category = topicCategoryRepository.findOne(id);
		if (category == null) { return null; }
		if (category.getOwnerId() != null) {
			User user = VocabularyPolicy.authenticatedUser(SecurityContextHolder.getContext().getAuthentication());
			return user != null && category.getOwnerId().equals(user.getId()) ? new TopicCategoryDto(category) : null;
		}
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
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User user = lockOwner(authentication);
		boolean admin = VocabularyPolicy.hasRole(authentication, "ROLE_ADMIN");
		Map<Long, TopicCategory> categories = lockCategories(user, admin);
		TopicCategory domain = dto.getId() == null ? new TopicCategory() : categories.get(dto.getId());
		if (domain == null) { throw new IllegalArgumentException("Nhóm bài không còn tồn tại."); }
		if (domain.getId() == null || dto.isParentSpecified()) {
			TopicCategory parent = dto.getParentId() == null ? null : categories.get(dto.getParentId());
			if (dto.getParentId() != null && parent == null) { throw new IllegalArgumentException("Nhóm cha không còn tồn tại."); }
			if (domain.getId() == null) {
				domain.setOwnerId(admin ? (parent == null ? null : parent.getOwnerId()) : user.getId());
			}
			if (parent != null && !Objects.equals(parent.getOwnerId(), domain.getOwnerId())) {
				throw new IllegalArgumentException("Nhóm cha phải thuộc cùng thư viện.");
			}
			Set<Long> visited = new HashSet<Long>();
			for (TopicCategory ancestor = parent; ancestor != null; ancestor = ancestor.getParent()) {
				if (ancestor.getId().equals(dto.getId()) || !visited.add(ancestor.getId())) {
					throw new IllegalArgumentException("Không thể chuyển nhóm vào chính nó hoặc nhóm con của nó.");
				}
			}
			domain.setParent(parent);
		}
		LocalDateTime currentDate = LocalDateTime.now();
		String currentUserName = user.getUsername();
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
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User user = lockOwner(authentication);
		Map<Long, TopicCategory> categories = lockCategories(user, VocabularyPolicy.hasRole(authentication, "ROLE_ADMIN"));
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

	private User lockOwner(Authentication authentication) {
		User user = VocabularyPolicy.authenticatedUser(authentication);
		if (user == null) { throw new AccessDeniedException("Bạn cần đăng nhập để quản lý nhóm bài."); }
		VocabularyPolicy.role(authentication);
		if (userRepository.findForVocabularyUpdate(user.getId()) == null) {
			throw new AccessDeniedException("Không xác định được chủ sở hữu thư viện từ vựng.");
		}
		return user;
	}

	private Map<Long, TopicCategory> lockCategories(User owner, boolean admin) {
		Map<Long, TopicCategory> categories = new LinkedHashMap<Long, TopicCategory>();
		if (admin) {
			for (TopicCategory category : topicCategoryRepository.lockSharedHierarchy()) { categories.put(category.getId(), category); }
		}
		for (TopicCategory category : topicCategoryRepository.lockPrivateHierarchy(owner.getId())) {
			categories.put(category.getId(), category);
		}
		return categories;
	}

}
