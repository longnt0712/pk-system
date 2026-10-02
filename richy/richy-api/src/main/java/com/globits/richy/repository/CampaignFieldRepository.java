package com.globits.richy.repository;

import java.util.*;
import javax.persistence.*;
import org.springframework.stereotype.Repository;

/** Scalar, bounded reads: never hydrate User or its eager roles/groups per garden. */
@Repository
public class CampaignFieldRepository {
    @PersistenceContext private EntityManager entityManager;
    private static final String MANAGERS = "'ROLE_ADMIN','ROLE_EDUCATION_MANAGERMENT','ROLE_STUDENT_MANAGERMENT'";
    private static String role(String names) {
        return "exists (select 1 from tbl_user_role ur join tbl_role r on r.id=ur.role_id where ur.user_id=u.id and r.role_name in (" + names + "))";
    }
    private static String membership(String school) {
        return "exists (select 1 from tbl_enrolment_class c where c.school_id=" + school
                + " and (c.id=p.class_id or exists (select 1 from tbl_user_enrolment_class uc where uc.user_id=u.id and uc.enrolment_class_id=c.id)))";
    }
    private static String scope(boolean managers) {
        // Unassigned TNTT students/managers remain visible; IELTS-only membership is excluded.
        String school = "(" + membership("2") + " or (not " + membership("1") + " and not " + role("'ROLE_VIEWER'") + "))";
        String roles = managers ? "(" + role("'ROLE_STUDENT'") + " or " + role(MANAGERS) + ")"
                : "(" + role("'ROLE_STUDENT'") + " and not " + role(MANAGERS) + ")";
        return "u.active=1 and u.account_non_locked=1 and u.account_non_expired=1 and " + school + " and " + roles;
    }

    @SuppressWarnings("unchecked")
    public List<Object[]> page(Long campaignId, List<String> keys, String start, String end, Long classId,
            String search, Long afterCount, Long afterId, int limit, boolean managers) {
        StringBuilder keyParams = new StringBuilder();
        for (int i=0; i<keys.size(); i++) { if (i>0) { keyParams.append(','); } keyParams.append(":key").append(i); }
        String sql = "select top " + limit + " u.id as participant_id, p.patron as saint_name, p.last_name as last_name,"
                + " p.first_name as first_name, p.display_name as display_name, coalesce(scores.earned,0) as earned"
                + " from tbl_user u left join tbl_person p on p.user_id=u.id"
                + " left join (select student_id,count(*) as earned from tbl_campaign_flower_entry"
                + " where campaign_id=:campaign and entry_date between :start and :end and completed=1"
                + " and item_key in (" + keyParams + ") group by student_id) scores on scores.student_id=u.id"
                + " where " + scope(managers);
        if (classId != null) {
            sql += " and (p.class_id=:classId or exists (select 1 from tbl_user_enrolment_class uc where uc.user_id=u.id and uc.enrolment_class_id=:classId))";
        }
        if (!search.isEmpty()) {
            sql += " and (coalesce(p.patron,'')+' '+coalesce(p.last_name,'')+' '+coalesce(p.first_name,'')+' '+coalesce(p.display_name,''))"
                    + " collate Latin1_General_CI_AI like :search escape '\\'";
        }
        if (afterId != null) {
            sql += " and (coalesce(scores.earned,0)<:afterCount or (coalesce(scores.earned,0)=:afterCount and u.id>:afterId))";
        }
        sql += " order by coalesce(scores.earned,0) desc,u.id asc";
        Query query = entityManager.createNativeQuery(sql);
        query.setParameter("campaign",campaignId).setParameter("start",start).setParameter("end",end);
        for (int i=0; i<keys.size(); i++) { query.setParameter("key"+i,keys.get(i)); }
        if (classId != null) { query.setParameter("classId",classId); }
        if (!search.isEmpty()) { query.setParameter("search","%" + search.replace("\\","\\\\").replace("%","\\%").replace("_","\\_").replace("[","\\[") + "%"); }
        if (afterId != null) { query.setParameter("afterCount",afterCount).setParameter("afterId",afterId); }
        return query.getResultList();
    }

    @SuppressWarnings("unchecked")
    public List<Object[]> classes() {
        return entityManager.createNativeQuery("select id as class_id,cast(name as nvarchar(200)) as class_name from tbl_enrolment_class where school_id=2").getResultList();
    }
    @SuppressWarnings("unchecked")
    public List<Object[]> participantClasses(List<Long> ids) {
        // One batched read handles both legacy primary classes and multiple class membership.
        StringBuilder params=new StringBuilder();
        for (int i=0;i<ids.size();i++) { if(i>0){params.append(',');} params.append(":id").append(i); }
        Query query=entityManager.createNativeQuery("select distinct u.id as participant_id,c.id as class_id,cast(c.name as nvarchar(200)) as class_name"
                + " from tbl_user u left join tbl_person p on p.user_id=u.id join tbl_enrolment_class c on"
                + " (c.id=p.class_id or exists (select 1 from tbl_user_enrolment_class uc where uc.user_id=u.id and uc.enrolment_class_id=c.id))"
                + " where c.school_id=2 and u.id in (" + params + ")");
        for(int i=0;i<ids.size();i++){query.setParameter("id"+i,ids.get(i));}
        return query.getResultList();
    }
}
