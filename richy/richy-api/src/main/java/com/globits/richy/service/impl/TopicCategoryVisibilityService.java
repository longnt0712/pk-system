package com.globits.richy.service.impl;

import java.util.LinkedHashSet;
import java.util.Set;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.globits.richy.domain.EnrolmentClass;
import com.globits.richy.domain.TopicCategory;
import com.globits.richy.repository.EnrolmentClassRepository;
import com.globits.richy.repository.TopicCategoryRepository;
import com.globits.security.domain.Role;
import com.globits.security.domain.User;
import com.globits.security.repository.UserRepository;

@Service
@Transactional(readOnly = true)
public class TopicCategoryVisibilityService {
    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EnrolmentClassRepository enrolmentClassRepository;

    @Autowired
    private TopicCategoryRepository topicCategoryRepository;

    /**
     * Returns null when category visibility is unrestricted. An empty set means
     * the student's class has explicitly hidden every category.
     */
    public Set<Long> getAllowedCategoryIdsForCurrentStudent() {
        User student = getCurrentUser();
        boolean learner = hasRole(student, "ROLE_STUDENT") || hasRole(student, "ROLE_VIEWER");
        if (!learner
                || hasRole(student, "ROLE_ADMIN")
                || hasRole(student, "ROLE_EDUCATION_MANAGERMENT")
                || hasRole(student, "ROLE_STUDENT_MANAGERMENT")
                || hasRole(student, "ROLE_STAFF")
                || hasRole(student, "ROLE_STAFF_MANAGEMENT")) {
            return null;
        }

        Set<Long> directClassIds = new LinkedHashSet<Long>();
        if (student.getPerson() != null && student.getPerson().getEnrollmentClassId() != null) {
            directClassIds.add(student.getPerson().getEnrollmentClassId().longValue());
        }
        if (student.getEnrollmentClassIds() != null) {
            directClassIds.addAll(student.getEnrollmentClassIds());
        }
        if (directClassIds.isEmpty()) {
            return null;
        }

        Set<Long> rootClassIds = new LinkedHashSet<Long>();
        for (Long classId : directClassIds) {
            EnrolmentClass root = findRootClass(classId);
            if (root != null && root.getId() != null) {
                rootClassIds.add(root.getId());
            }
        }
        if (rootClassIds.isEmpty()) {
            return null;
        }

        Set<Long> hiddenForEveryClass = null;
        for (Long rootClassId : rootClassIds) {
            EnrolmentClass root = enrolmentClassRepository.findOne(rootClassId);
            if (root == null || root.getHiddenTopicCategories() == null || root.getHiddenTopicCategories().isEmpty()) {
                return null;
            }
            Set<Long> hiddenInClass = new LinkedHashSet<Long>();
            for (TopicCategory category : root.getHiddenTopicCategories()) {
                if (category != null && category.getId() != null) {
                    hiddenInClass.add(category.getId());
                }
            }
            if (hiddenForEveryClass == null) {
                hiddenForEveryClass = hiddenInClass;
            } else {
                hiddenForEveryClass.retainAll(hiddenInClass);
            }
            if (hiddenForEveryClass.isEmpty()) { return null; }
        }

        Set<Long> allowed = new LinkedHashSet<Long>();
        for (TopicCategory category : topicCategoryRepository.findAll()) {
            if (category != null && category.getId() != null && !hiddenForEveryClass.contains(category.getId())) {
                allowed.add(category.getId());
            }
        }
        return allowed;
    }

    private EnrolmentClass findRootClass(Long classId) {
        EnrolmentClass current = classId == null ? null : enrolmentClassRepository.findOne(classId);
        Set<Long> visited = new LinkedHashSet<Long>();
        while (current != null && current.getId() != null && visited.add(current.getId())
                && current.getParent() != null) {
            current = current.getParent();
        }
        return current;
    }

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            return null;
        }
        return userRepository.findByUsername(authentication.getName());
    }

    private boolean hasRole(User user, String roleName) {
        if (user == null || user.getRoles() == null) {
            return false;
        }
        for (Role role : user.getRoles()) {
            if (role != null && roleName.equals(role.getName())) {
                return true;
            }
        }
        return false;
    }
}
