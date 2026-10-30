package com.globits.richy.service.impl;

import com.globits.richy.dto.BattleOnlineExerciseTestDto;
import com.globits.richy.dto.QuestionDto;
import com.globits.richy.service.BattleExerciseCatalogService;
import com.globits.richy.service.BattleOnlineException;
import java.util.*;
import javax.persistence.EntityManager;
import javax.persistence.Query;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.annotation.Secured;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** A bounded scalar catalog: browsing tests must not load their nested exercises. */
@Service
@Transactional(readOnly = true)
public class BattleExerciseCatalogServiceImpl implements BattleExerciseCatalogService {
    private static final int MAX_PAGE_SIZE = 50;
    private static final int QUERY_TIMEOUT_MS = 5000;
    @Autowired private EntityManager manager;

    @Override
    @Secured({"ROLE_ADMIN", "ROLE_USER", "ROLE_VIEWER"})
    public Page<BattleOnlineExerciseTestDto> search(QuestionDto filters, int pageIndex, int pageSize) {
        requireCatalogAccess();
        int index = Math.max(1,pageIndex) - 1;
        int size = Math.max(1,Math.min(MAX_PAGE_SIZE,pageSize));
        if ((long)index * size > Integer.MAX_VALUE) { throw invalid("Trang danh sách đề không hợp lệ."); }
        PageRequest pageable = new PageRequest(index,size);
        QuestionDto request = filters == null ? new QuestionDto() : filters;
        Map<String,Object> parameters = new LinkedHashMap<String,Object>();
        StringBuilder where = new StringBuilder(" from Question s where s.questionType.id = 11 and s.status = 7")
                .append(" and s.testFormat = 'COMPREHENSIVE' and s.parent is null")
                .append(" and s.timeReviewd >= 0 and s.timeReviewd <= 100");
        if (request.getUserId() != null) { where.append(" and s.user.id = :userId"); parameters.put("userId",request.getUserId()); }
        if (request.isWithoutTestFolder()) { where.append(" and s.testFolder is null"); }
        else if (request.getTestFolderId() != null) {
            if (request.isIncludeSubfolders()) {
                List<Long> folders = folderIds(request.getTestFolderId());
                if (folders.isEmpty()) { return new PageImpl<BattleOnlineExerciseTestDto>(Collections.<BattleOnlineExerciseTestDto>emptyList(),pageable,0L); }
                where.append(" and s.testFolder.id in :folderIds"); parameters.put("folderIds",folders);
            } else {
                where.append(" and s.testFolder.id = :folderId and s.testFolder.testMode = 'COMPREHENSIVE'");
                parameters.put("folderId",request.getTestFolderId());
            }
        }
        if (request.isWithoutTopics()) {
            where.append(" and not exists (select qt.id from QuestionTopic qt where qt.question.id = s.id and qt.topic is not null)");
        } else if (request.getTopicOwnerUserId() != null || request.getTopicCategoryId() != null || request.getTopicId() != null) {
            where.append(" and exists (select qt.id from QuestionTopic qt where qt.question.id = s.id");
            if (request.getTopicOwnerUserId() != null) {
                where.append(" and qt.topic.user.id = :topicOwner"); parameters.put("topicOwner",request.getTopicOwnerUserId());
            }
            if (request.getTopicCategoryId() != null) {
                where.append(" and qt.topic.topicCategory.id = :topicCategory"); parameters.put("topicCategory",request.getTopicCategoryId());
            }
            if (request.getTopicId() != null) { where.append(" and qt.topic.id = :topicId"); parameters.put("topicId",request.getTopicId()); }
            where.append(')');
        }
        String search = request.getTextSearch() == null ? "" : request.getTextSearch().trim();
        if (search.length() > 200) { throw invalid("Tên đề tìm kiếm tối đa 200 ký tự."); }
        if (!search.isEmpty()) {
            where.append(" and lower(s.title) like :title escape '!'");
            parameters.put("title","%" + search.toLowerCase(Locale.ROOT).replace("!","!!").replace("%","!%").replace("_","!_") + "%");
        }
        Query count = manager.createQuery("select count(s.id)" + where);
        configure(count,parameters);
        long total = ((Number)count.getSingleResult()).longValue();
        if (total == 0L || (long)index * size >= total) {
            return new PageImpl<BattleOnlineExerciseTestDto>(Collections.<BattleOnlineExerciseTestDto>emptyList(),pageable,total);
        }
        Query rows = manager.createQuery("select new com.globits.richy.dto.BattleOnlineExerciseTestDto(s.id,s.title)" + where
                + " order by s.ordinalNumber, s.createDate DESC, s.id DESC",BattleOnlineExerciseTestDto.class);
        configure(rows,parameters);
        rows.setFirstResult(index * size); rows.setMaxResults(size);
        @SuppressWarnings("unchecked") List<BattleOnlineExerciseTestDto> content = rows.getResultList();
        return new PageImpl<BattleOnlineExerciseTestDto>(content,pageable,total);
    }

    private void configure(Query query, Map<String,Object> parameters) {
        query.setHint("javax.persistence.query.timeout",QUERY_TIMEOUT_MS);
        for (Map.Entry<String,Object> parameter : parameters.entrySet()) { query.setParameter(parameter.getKey(),parameter.getValue()); }
    }

    /** Only explicit recursive browsing reads the folder tree; no folder entities are hydrated. */
    private List<Long> folderIds(Long root) {
        Query query = manager.createQuery("select f.id, p.id from TestFolder f left join f.parent p where f.testMode = 'COMPREHENSIVE'");
        query.setHint("javax.persistence.query.timeout",QUERY_TIMEOUT_MS);
        @SuppressWarnings("unchecked") List<Object[]> rows = query.getResultList();
        Map<Long,List<Long>> children = new HashMap<Long,List<Long>>();
        boolean exists = false;
        for (Object[] row : rows) {
            Long id = (Long)row[0], parent = (Long)row[1];
            exists |= root.equals(id);
            List<Long> list = children.get(parent);
            if (list == null) { list = new ArrayList<Long>(); children.put(parent,list); }
            list.add(id);
        }
        if (!exists) { return Collections.emptyList(); }
        List<Long> result = new ArrayList<Long>(); Set<Long> seen = new HashSet<Long>();
        result.add(root); seen.add(root);
        for (int at = 0; at < result.size(); at++) {
            List<Long> next = children.get(result.get(at));
            if (next != null) { for (Long id : next) { if (seen.add(id)) { result.add(id); } } }
        }
        return result;
    }

    private void requireCatalogAccess() {
        Authentication user = SecurityContextHolder.getContext().getAuthentication();
        if (user == null || !user.isAuthenticated()) { throw new BattleOnlineException(HttpStatus.UNAUTHORIZED,"Bạn chưa đăng nhập."); }
        if (user.getAuthorities() != null) {
            for (GrantedAuthority role : user.getAuthorities()) {
                if (role != null && Arrays.asList("ROLE_ADMIN","ROLE_USER","ROLE_VIEWER").contains(role.getAuthority())) { return; }
            }
        }
        throw new BattleOnlineException(HttpStatus.FORBIDDEN,"Bạn không có quyền chọn đề Battle Online.");
    }
    private BattleOnlineException invalid(String message) { return new BattleOnlineException(HttpStatus.BAD_REQUEST,message); }
}
