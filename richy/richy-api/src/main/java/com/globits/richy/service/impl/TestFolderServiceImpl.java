package com.globits.richy.service.impl;

import com.globits.richy.domain.TestFolder;
import com.globits.richy.dto.TestFolderDto;
import com.globits.richy.repository.TestFolderRepository;
import com.globits.security.domain.User;
import java.util.*;
import org.joda.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class TestFolderServiceImpl {
    @Autowired private TestFolderRepository repository;

    public List<TestFolderDto> list(boolean allTeachers) {
        List<TestFolderDto> result = new ArrayList<TestFolderDto>();
        User user = currentUser();
        for (TestFolder folder : repository.findAll()) {
            if (!allTeachers && (folder.getOwner() == null || !folder.getOwner().getId().equals(user.getId()))) { continue; }
            TestFolderDto dto = new TestFolderDto(folder); dto.setCanManage(canManage(folder)); result.add(dto);
        }
        return result;
    }

    private User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof User)) { throw new AccessDeniedException("Cần đăng nhập để sử dụng folder."); }
        return (User) auth.getPrincipal();
    }

    private boolean canManage(TestFolder folder) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && (auth.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()))
                || (folder.getOwner() != null && folder.getOwner().getId().equals(currentUser().getId())));
    }

    public TestFolderDto save(TestFolderDto dto) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) { throw new AccessDeniedException("Cần đăng nhập để tạo folder."); }
        String name = dto == null || dto.getName() == null ? "" : dto.getName().trim();
        if (name.isEmpty() || name.length() > 200) { throw new IllegalArgumentException("Tên folder cần từ 1 đến 200 ký tự."); }
        TestFolder folder = dto.getId() == null ? new TestFolder() : repository.findOne(dto.getId());
        if (folder == null) { throw new IllegalArgumentException("Folder không còn tồn tại."); }
        if (folder.getId() != null && !canManage(folder)) { throw new AccessDeniedException("Bạn không có quyền sửa folder này."); }
        User owner = folder.getId() == null ? currentUser() : folder.getOwner();
        TestFolder parent = dto.getParentId() == null ? null : repository.findOne(dto.getParentId());
        if (dto.getParentId() != null && parent == null) { throw new IllegalArgumentException("Folder cha không còn tồn tại."); }
        if (parent != null && (parent.getOwner() == null || !parent.getOwner().getId().equals(owner.getId()))) {
            throw new IllegalArgumentException("Folder cha phải thuộc cùng giáo viên.");
        }
        Set<Long> ancestors = new HashSet<Long>();
        for (TestFolder node = parent; node != null; node = node.getParent()) {
            if (!ancestors.add(node.getId()) || (folder.getId() != null && folder.getId().equals(node.getId()))) {
                throw new IllegalArgumentException("Không thể đặt folder vào chính nó hoặc folder con của nó.");
            }
        }
        for (TestFolder sibling : repository.findAll()) {
            Long parentId = sibling.getParent() == null ? null : sibling.getParent().getId();
            if (sibling.getOwner() != null && sibling.getOwner().getId().equals(owner.getId())
                    && !Objects.equals(sibling.getId(), folder.getId()) && Objects.equals(parentId, dto.getParentId())
                    && name.equalsIgnoreCase(sibling.getName())) {
                throw new IllegalArgumentException("Đã có folder cùng tên trong folder cha này.");
            }
        }
        LocalDateTime now = LocalDateTime.now();
        if (folder.getId() == null) { folder.setCreatedBy(auth.getName()); folder.setCreateDate(now); }
        folder.setModifiedBy(auth.getName()); folder.setModifyDate(now);
        folder.setName(name); folder.setParent(parent); folder.setOwner(owner);
        TestFolderDto result = new TestFolderDto(repository.save(folder)); result.setCanManage(true); return result;
    }

    public List<Long> descendantIds(Long id, boolean includeChildren) {
        List<Long> result = new ArrayList<Long>();
        if (id == null || repository.findOne(id) == null) { return result; }
        result.add(id);
        if (!includeChildren) { return result; }
        List<TestFolder> folders = repository.findAll();
        Set<Long> seen = new HashSet<Long>(); seen.add(id);
        for (int index = 0; index < result.size(); index++) {
            Long parent = result.get(index);
            for (TestFolder folder : folders) {
                if (folder.getParent() != null && parent.equals(folder.getParent().getId()) && seen.add(folder.getId())) { result.add(folder.getId()); }
            }
        }
        return result;
    }
}
