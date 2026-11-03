package com.globits.richy.service.impl;

import static com.globits.richy.service.impl.TnttDocumentPayload.*;

import com.globits.core.domain.BaseObject;
import com.globits.richy.domain.*;
import com.globits.richy.dto.TnttDocumentRequest;
import com.globits.security.domain.User;
import java.util.*;
import java.util.function.LongSupplier;
import javax.persistence.*;
import org.joda.time.LocalDateTime;
import org.springframework.beans.factory.annotation.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class TnttDocumentService {
    @PersistenceContext private EntityManager em;
    @Autowired private TnttDocumentMail mail;

    @Value("${tntt.documents.enabled:false}")
    private boolean enabled;

    private LongSupplier clock = System::currentTimeMillis;

    public static class Conflict extends RuntimeException {
        public Conflict() {
            super("Tài liệu đã được người khác cập nhật. Bản đang viết được giữ để đối chiếu.");
        }
    }

    private static boolean role(User u, String name) {
        return u != null
                && u.getRoles() != null
                && u.getRoles().stream().anyMatch(r -> name.equals(r.getName()));
    }

    public static boolean editor(User u) {
        return role(u, "ROLE_ADMIN") || role(u, "ROLE_EDUCATION_MANAGEMENT");
    }

    public static boolean student(User u) {
        return role(u, "ROLE_STUDENT")
                || (u != null
                        && u.getPerson() != null
                        && "DOAN_SINH".equals(u.getPerson().getTnttMemberType()));
    }

    private User actor() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !a.isAuthenticated() || !(a.getPrincipal() instanceof User))
            throw new AccessDeniedException("Cần đăng nhập.");
        User u = em.find(User.class, ((User) a.getPrincipal()).getId());
        if (u == null || !Boolean.TRUE.equals(u.getActive()))
            throw new AccessDeniedException("Tài khoản không hoạt động.");
        return u;
    }

    private User requireEditor() {
        requireEnabled();
        User u = actor();
        if (!editor(u))
            throw new AccessDeniedException(
                    "Chỉ Admin và Quản lý đào tạo được sửa tài liệu chung.");
        return u;
    }

    private void requireEnabled() {
        if (!enabled)
            throw new IllegalArgumentException("Mục Tài liệu TNTT chưa được bật trên máy chủ.");
    }

    private String title(String s) {
        if (s == null || s.trim().isEmpty() || s.trim().length() > 200)
            throw new IllegalArgumentException("Tên cần từ 1 đến 200 ký tự.");
        return s.trim();
    }

    private void stamp(BaseObject obj, User u) {
        LocalDateTime now = LocalDateTime.now();
        if (obj.getId() == null) {
            obj.setCreatedBy(u.getUsername());
            obj.setCreateDate(now);
        }
        obj.setModifiedBy(u.getUsername());
        obj.setModifyDate(now);
    }

    private TnttDocumentEntry entry(Long id, boolean lock) {
        if (id == null || id < 1) throw new IllegalArgumentException("Thiếu tài liệu.");
        TnttDocumentEntry v =
                lock
                        ? em.find(TnttDocumentEntry.class, id, LockModeType.PESSIMISTIC_WRITE)
                        : em.find(TnttDocumentEntry.class, id);
        if (v == null) throw new IllegalArgumentException("Tài liệu không còn tồn tại.");
        if (lock) em.refresh(v, LockModeType.PESSIMISTIC_WRITE);
        return v;
    }

    private void revision(TnttDocumentEntry v, Long expected) {
        if (expected == null || !expected.equals(v.revision)) throw new Conflict();
    }

    private void folderLock() {
        em.createQuery(
                        "select e from TnttDocumentEntry e where e.kind='FOLDER' order by e.id",
                        TnttDocumentEntry.class)
                .setLockMode(LockModeType.PESSIMISTIC_WRITE)
                .getResultList();
    }

    private void parent(Long parent, Long own) {
        Set<Long> seen = new HashSet<>();
        while (parent != null) {
            if (!seen.add(parent) || Objects.equals(parent, own))
                throw new IllegalArgumentException(
                        "Không thể chuyển thư mục vào chính nó hoặc thư mục con.");
            TnttDocumentEntry p = entry(parent, false);
            if (p.archived || !"FOLDER".equals(p.kind))
                throw new IllegalArgumentException("Thư mục đích không hợp lệ.");
            parent = p.parentId;
        }
    }

    private List<String> groups(User u, RecipientScope schoolClasses) {
        List<String> out = new ArrayList<>();
        if (u == null || student(u) || !Boolean.TRUE.equals(u.getActive())) return out;
        if (role(u, "ROLE_ADMIN")) out.add("ADMIN");
        if (role(u, "ROLE_EDUCATION_MANAGEMENT")) out.add("EDUCATION");
        if (role(u, "ROLE_STUDENT_MANAGEMENT")) out.add("STUDENT_MANAGEMENT");
        boolean member =
                u.getPerson() != null
                        && Arrays.asList(
                                        "DU_TRUONG", "HUYNH_TRUONG", "TRO_TA", "TRO_UY", "TUYEN_UY")
                                .contains(u.getPerson().getTnttMemberType());
        boolean inSchool =
                u.getPerson() != null
                        && u.getPerson().getEnrollmentClassId() != null
                        && schoolClasses.classes.contains(
                                u.getPerson().getEnrollmentClassId().longValue());
        if (u.getEnrollmentClassIds() != null)
            for (Long id : u.getEnrollmentClassIds())
                if (schoolClasses.classes.contains(id)) inSchool = true;
        if (member
                || (role(u, "ROLE_USER") && inSchool)
                || schoolClasses.teachers.contains(u.getId())) out.add("LEADERS");
        return out;
    }

    private static class RecipientScope {
        Set<Long> classes, teachers;
    }

    private RecipientScope classes() {
        RecipientScope scope = new RecipientScope();
        scope.classes =
                new HashSet<>(
                        em.createQuery(
                                        "select e.id from EnrolmentClass e where e.schoolId=2",
                                        Long.class)
                                .getResultList());
        scope.teachers =
                new HashSet<>(
                        em.createQuery(
                                        "select distinct u.id from EnrolmentClass e join e.teachers u where e.schoolId=2 and e.parent is null",
                                        Long.class)
                                .getResultList());
        return scope;
    }

    private void requireRecipient(User u) {
        if (student(u) || groups(u, classes()).isEmpty())
            throw new AccessDeniedException("Bạn không thuộc nhóm tài khoản nhận tài liệu TNTT.");
    }

    private String name(User u) {
        if (u.getPerson() != null) {
            String s =
                    ((u.getPerson().getLastName() == null ? "" : u.getPerson().getLastName())
                                    + " "
                                    + (u.getPerson().getFirstName() == null
                                            ? ""
                                            : u.getPerson().getFirstName()))
                            .trim();
            if (!s.isEmpty()) return s;
        }
        return u.getUsername();
    }

    public Map<String, Object> capabilities() {
        User u = actor();
        return map(
                "enabled",
                enabled,
                "canEdit",
                editor(u),
                "canReceive",
                enabled && !student(u) && !groups(u, classes()).isEmpty(),
                "emailConfigured",
                mail.configured(),
                "zaloConfigured",
                false,
                "userId",
                u.getId(),
                "serverNow",
                clock.getAsLong());
    }

    public List<Map<String, Object>> recipients() {
        requireEditor();
        RecipientScope ids = classes();
        List<Map<String, Object>> out = new ArrayList<>();
        for (User u :
                em.createQuery("select u from User u where u.active=true order by u.id", User.class)
                        .getResultList()) {
            List<String> g = groups(u, ids);
            if (!g.isEmpty())
                out.add(
                        map(
                                "id",
                                u.getId(),
                                "name",
                                name(u),
                                "groups",
                                g,
                                "hasEmail",
                                TnttDocumentMail.validEmail(u.getEmail())));
        }
        return out;
    }

    private Map<String, Object> metadata(TnttDocumentEntry e) {
        return map(
                "id",
                e.getId(),
                "title",
                e.title,
                "kind",
                e.kind,
                "parentId",
                e.parentId,
                "revision",
                e.revision,
                "updatedAt",
                e.updatedAt,
                "archived",
                e.archived,
                "shared",
                e.shared,
                "noticeId",
                e.noticeId);
    }

    private boolean recipient(Long notice, Long user) {
        return notice != null
                && !em.createQuery(
                                "select r.id from TnttDocumentRecipient r where r.noticeId=:n and r.userId=:u",
                                Long.class)
                        .setParameter("n", notice)
                        .setParameter("u", user)
                        .setMaxResults(1)
                        .getResultList()
                        .isEmpty();
    }

    private TnttDocumentNotice readableNotice(TnttDocumentEntry e, User u) {
        if (e.archived || !e.shared || e.noticeId == null || student(u))
            throw new AccessDeniedException(
                    "Tài liệu đang được ẩn hoặc bạn không thuộc nhóm nhận.");
        TnttDocumentNotice n = em.find(TnttDocumentNotice.class, e.noticeId);
        if (n == null
                || n.disabled
                || n.startsAt > clock.getAsLong()
                || !recipient(n.getId(), u.getId()))
            throw new AccessDeniedException("Bạn không có quyền xem tài liệu này.");
        return n;
    }

    public List<Map<String, Object>> list(boolean trash, String query) {
        requireEnabled();
        User u = actor();
        if (!editor(u) && student(u))
            throw new AccessDeniedException("Tài liệu không dành cho tài khoản học sinh.");
        boolean edit = editor(u);
        if (!edit) requireRecipient(u);
        List<Map<String, Object>> out = new ArrayList<>();
        String term = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        // Metadata only: never load every document's handwriting into the directory.
        List<Object[]> rows =
                em.createQuery(
                                "select e.id,e.title,e.kind,e.parentId,e.revision,e.updatedAt,e.archived,e.shared,e.noticeId from TnttDocumentEntry e where e.archived=:a order by e.updatedAt desc",
                                Object[].class)
                        .setParameter("a", trash && edit)
                        .getResultList();
        Map<Long, Object[]> publishedInfo = new HashMap<>();
        if (!edit)
            for (Object[] row :
                    em.createQuery(
                                    "select e.id,n.title,n.publishedAt,n.id from TnttDocumentEntry e,TnttDocumentNotice n,TnttDocumentRecipient r where n.id=e.noticeId and r.noticeId=n.id and r.userId=:u and e.shared=true and e.archived=false and n.disabled=false and n.startsAt<=:now",
                                    Object[].class)
                            .setParameter("u", u.getId())
                            .setParameter("now", clock.getAsLong())
                            .getResultList()) publishedInfo.put((Long) row[0], row);
        Set<Long> visible = new HashSet<>();
        Set<Long> folders = new HashSet<>();
        Map<Long, Object[]> byId = new HashMap<>();
        for (Object[] r : rows) byId.put((Long) r[0], r);
        for (Object[] r : rows) {
            if (!"DOCUMENT".equals(r[2])) continue;
            if (!edit) {
                Object[] published = publishedInfo.get((Long) r[0]);
                if (published == null) continue;
                r[1] = published[1];
                r[5] = published[2];
                r[4] = published[3];
            }
            boolean matches =
                    term.isEmpty() || ((String) r[1]).toLowerCase(Locale.ROOT).contains(term);
            if (!matches) {
                TnttDocumentEntry e = entry((Long) r[0], false);
                String body = edit ? e.notebookJson : readableNotice(e, u).notebookJson;
                matches =
                        String.valueOf(decode(body).get("text"))
                                .toLowerCase(Locale.ROOT)
                                .contains(term);
            }
            if (matches) {
                visible.add((Long) r[0]);
                Long p = (Long) r[3];
                while (p != null && folders.add(p) && byId.containsKey(p))
                    p = (Long) byId.get(p)[3];
            }
        }
        for (Object[] r : rows)
            if (edit && term.isEmpty() || visible.contains(r[0]) || folders.contains(r[0]))
                out.add(
                        map(
                                "id",
                                r[0],
                                "title",
                                r[1],
                                "kind",
                                r[2],
                                "parentId",
                                r[3],
                                "revision",
                                r[4],
                                "updatedAt",
                                r[5],
                                "archived",
                                r[6],
                                "shared",
                                r[7],
                                "noticeId",
                                r[8]));
        return out;
    }

    public Map<String, Object> read(Long id, Long known) {
        requireEnabled();
        User u = actor();
        TnttDocumentEntry e = entry(id, false);
        if (!"DOCUMENT".equals(e.kind) || e.archived)
            throw new IllegalArgumentException("Không mở được tài liệu này.");
        Map<String, Object> out = metadata(e);
        boolean edit = editor(u);
        if (!edit) requireRecipient(u);
        TnttDocumentNotice n = edit ? null : readableNotice(e, u);
        if (!edit) {
            out.put("title", n.title);
            out.put("updatedAt", n.publishedAt);
        }
        long rev = edit ? e.revision : n.getId();
        out.put("canEdit", edit);
        out.put("revision", rev);
        out.put("changed", known == null || known != rev);
        if (known == null || known != rev)
            out.put("document", decode(edit ? e.notebookJson : n.notebookJson));
        return out;
    }

    public Map<String, String> publicLink(Long id) {
        requireEditor();
        return Collections.singletonMap("token", publicLinkEntry(id, false).publicViewToken);
    }

    public Map<String, String> enablePublicLink(Long id) {
        requireEditor();
        TnttDocumentEntry e = publicLinkEntry(id, true);
        if (e.publicViewToken == null) {
            e.publicViewToken = UUID.randomUUID().toString().replace("-", "");
            em.flush();
        }
        return Collections.singletonMap("token", e.publicViewToken);
    }

    public void revokePublicLink(Long id) {
        requireEditor();
        TnttDocumentEntry e = publicLinkEntry(id, true);
        if (e.publicViewToken != null) {
            e.publicViewToken = null;
            em.flush();
        }
    }

    private TnttDocumentEntry publicLinkEntry(Long id, boolean lock) {
        TnttDocumentEntry e = entry(id, lock);
        if (!"DOCUMENT".equals(e.kind) || e.archived)
            throw new IllegalArgumentException("Không mở được tài liệu này.");
        return e;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> readPublicLink(String token) {
        if (!enabled || token == null || !token.matches("[a-f0-9]{32}")) return null;
        List<TnttDocumentEntry> entries = em.createQuery(
                "select e from TnttDocumentEntry e where e.publicViewToken=:token and e.archived=false and e.kind='DOCUMENT'",
                TnttDocumentEntry.class)
                .setParameter("token", token)
                .setMaxResults(1)
                .getResultList();
        if (entries.isEmpty()) return null;
        TnttDocumentEntry e = entries.get(0);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("title", e.title);
        result.put("document", decode(e.notebookJson));
        return result;
    }

    public Map<String, Object> create(TnttDocumentRequest r) {
        User u = requireEditor();
        if (r == null || !Arrays.asList("FOLDER", "DOCUMENT").contains(r.kind))
            throw new IllegalArgumentException("Chọn thư mục hoặc tài liệu.");
        folderLock();
        parent(r.parentId, null);
        TnttDocumentEntry e = new TnttDocumentEntry();
        e.title = title(r.title);
        e.kind = r.kind;
        e.parentId = r.parentId;
        e.creatorId = u.getId();
        e.editorId = u.getId();
        e.updatedAt = clock.getAsLong();
        e.notebookJson =
                "DOCUMENT".equals(e.kind)
                        ? validate(r.document == null ? blank() : r.document)
                        : null;
        stamp(e, u);
        em.persist(e);
        em.flush();
        if ("DOCUMENT".equals(e.kind)) checkpoint(e, u, false);
        return metadata(e);
    }

    public Map<String, Object> save(Long id, TnttDocumentRequest r) {
        User u = requireEditor();
        if (r == null) throw new IllegalArgumentException("Thiếu nội dung.");
        TnttDocumentEntry e = entry(id, true);
        if (e.archived || !"DOCUMENT".equals(e.kind))
            throw new IllegalArgumentException("Không sửa được tài liệu này.");
        String data = validate(r.document);
        if (!Objects.equals(e.revision, r.revision)) {
            if (Objects.equals(data, e.notebookJson)) return read(id, null);
            throw new Conflict();
        }
        if (!Objects.equals(data, e.notebookJson)) {
            e.notebookJson = data;
            e.editorId = u.getId();
            e.updatedAt = clock.getAsLong();
            stamp(e, u);
            em.flush();
            checkpoint(e, u, true);
        }
        return read(id, null);
    }

    public Map<String, Object> update(Long id, TnttDocumentRequest r) {
        User u = requireEditor();
        if (r == null) throw new IllegalArgumentException("Thiếu thông tin.");
        folderLock();
        TnttDocumentEntry e = entry(id, true);
        revision(e, r.revision);
        parent(r.parentId, e.getId());
        if (Boolean.TRUE.equals(r.archived)
                && "FOLDER".equals(e.kind)
                && !em.createQuery(
                                "select c.id from TnttDocumentEntry c where c.parentId=:id and c.archived=false",
                                Long.class)
                        .setParameter("id", id)
                        .setMaxResults(1)
                        .getResultList()
                        .isEmpty())
            throw new IllegalArgumentException(
                    "Hãy chuyển tài liệu ra ngoài trước khi xóa thư mục.");
        e.title = title(r.title);
        e.parentId = r.parentId;
        e.archived = Boolean.TRUE.equals(r.archived);
        if (e.archived) {
            e.shared = false;
            e.publicViewToken = null;
            cancel(e.noticeId);
        }
        e.editorId = u.getId();
        e.updatedAt = clock.getAsLong();
        stamp(e, u);
        em.flush();
        return metadata(e);
    }

    private void checkpoint(TnttDocumentEntry e, User u, boolean coalesce) {
        List<TnttDocumentVersion> rows =
                em.createQuery(
                                "select v from TnttDocumentVersion v where v.entryId=:id order by v.id desc",
                                TnttDocumentVersion.class)
                        .setParameter("id", e.getId())
                        .getResultList();
        TnttDocumentVersion v =
                !rows.isEmpty()
                                && coalesce
                                && rows.get(0).entryRevision > 0
                                && Objects.equals(rows.get(0).actorId, u.getId())
                                && clock.getAsLong() - rows.get(0).savedAt < 600000
                        ? rows.get(0)
                        : new TnttDocumentVersion();
        v.entryId = e.getId();
        v.entryRevision = e.revision;
        v.actorId = u.getId();
        v.savedAt = clock.getAsLong();
        v.title = e.title;
        v.notebookJson = e.notebookJson;
        stamp(v, u);
        if (v.getId() == null) em.persist(v);
        em.flush();
        List<Long> old =
                em.createQuery(
                                "select v.id from TnttDocumentVersion v where v.entryId=:id order by v.id desc",
                                Long.class)
                        .setParameter("id", e.getId())
                        .setFirstResult(30)
                        .getResultList();
        if (!old.isEmpty())
            em.createQuery("delete from TnttDocumentVersion v where v.id in :ids")
                    .setParameter("ids", old)
                    .executeUpdate();
    }

    public List<Map<String, Object>> history(Long id) {
        requireEditor();
        entry(id, false);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object[] r :
                em.createQuery(
                                "select v.id,v.entryRevision,v.actorId,v.savedAt,v.title from TnttDocumentVersion v where v.entryId=:id order by v.id desc",
                                Object[].class)
                        .setParameter("id", id)
                        .getResultList())
            out.add(
                    map(
                            "id",
                            r[0],
                            "revision",
                            r[1],
                            "actorId",
                            r[2],
                            "savedAt",
                            r[3],
                            "title",
                            r[4]));
        return out;
    }

    public Map<String, Object> version(Long id, Long version) {
        requireEditor();
        TnttDocumentVersion v = em.find(TnttDocumentVersion.class, version);
        if (v == null || !Objects.equals(id, v.entryId))
            throw new AccessDeniedException("Phiên bản không thuộc tài liệu.");
        return map(
                "id",
                v.getId(),
                "title",
                v.title,
                "savedAt",
                v.savedAt,
                "document",
                decode(v.notebookJson));
    }

    public Map<String, Object> restore(Long id, TnttDocumentRequest r) {
        User u = requireEditor();
        TnttDocumentEntry e = entry(id, true);
        revision(e, r == null ? null : r.revision);
        if (e.archived)
            throw new IllegalArgumentException("Hãy khôi phục tài liệu từ thùng rác trước.");
        TnttDocumentVersion v = em.find(TnttDocumentVersion.class, r.versionId);
        if (v == null || !Objects.equals(id, v.entryId))
            throw new AccessDeniedException("Phiên bản không thuộc tài liệu.");
        e.title = v.title;
        e.notebookJson = v.notebookJson;
        e.editorId = u.getId();
        e.updatedAt = clock.getAsLong();
        stamp(e, u);
        em.flush();
        checkpoint(e, u, false);
        return read(id, null);
    }

    public Map<String, Object> publish(Long id, TnttDocumentRequest r) {
        User u = requireEditor();
        if (r == null || r.requestKey == null || !r.requestKey.matches("[a-fA-F0-9-]{36}"))
            throw new IllegalArgumentException("Thiếu mã đợt thông báo.");
        TnttDocumentEntry e = entry(id, true);
        List<TnttDocumentNotice> prior =
                em.createQuery(
                                "select n from TnttDocumentNotice n where n.requestKey=:k",
                                TnttDocumentNotice.class)
                        .setParameter("k", r.requestKey)
                        .getResultList();
        if (!prior.isEmpty()) {
            if (!Objects.equals(prior.get(0).entryId, id)
                    || !Objects.equals(prior.get(0).publisherId, u.getId()))
                throw new AccessDeniedException("Mã thông báo đã được sử dụng.");
            return notice(prior.get(0));
        }
        revision(e, r.revision);
        if (e.archived || !"DOCUMENT".equals(e.kind))
            throw new IllegalArgumentException("Chỉ chia sẻ tài liệu đang hoạt động.");
        if (r.startsAt == null
                || r.endsAt == null
                || r.startsAt < 0
                || r.endsAt <= r.startsAt
                || r.endsAt <= clock.getAsLong())
            throw new IllegalArgumentException("Chọn thời gian bắt đầu, kết thúc hợp lệ (UTC+7).");
        String summary = r.summary == null ? "" : r.summary.trim();
        if (summary.length() > 1000)
            throw new IllegalArgumentException("Tóm tắt tối đa 1.000 ký tự.");
        if (Boolean.TRUE.equals(r.email) && !mail.configured())
            throw new IllegalArgumentException(
                    "Chưa cấu hình hộp thư gửi. Bạn vẫn có thể thông báo trên website.");
        Set<String> selected = new HashSet<>(r.groups == null ? Collections.emptyList() : r.groups);
        if (!Arrays.asList("ADMIN", "EDUCATION", "STUDENT_MANAGEMENT", "LEADERS")
                .containsAll(selected))
            throw new IllegalArgumentException("Nhóm nhận không hợp lệ.");
        Set<Long> explicit = new HashSet<>(r.userIds == null ? Collections.emptyList() : r.userIds);
        List<User> chosen = new ArrayList<>();
        RecipientScope schools = classes();
        for (User candidate :
                em.createQuery("select u from User u where u.active=true order by u.id", User.class)
                        .getResultList()) {
            List<String> g = groups(candidate, schools);
            if (!g.isEmpty()
                    && (g.stream().anyMatch(selected::contains)
                            || explicit.contains(candidate.getId()))) chosen.add(candidate);
        }
        if (chosen.isEmpty())
            throw new IllegalArgumentException("Chọn ít nhất một người nhận không phải học sinh.");
        cancel(e.noticeId);
        TnttDocumentNotice n = new TnttDocumentNotice();
        n.entryId = id;
        n.requestKey = r.requestKey;
        n.title = e.title;
        n.summary = summary;
        n.startsAt = r.startsAt;
        n.endsAt = r.endsAt;
        n.publisherId = u.getId();
        n.publishedAt = clock.getAsLong();
        n.notebookJson = e.notebookJson;
        stamp(n, u);
        em.persist(n);
        em.flush();
        for (User person : chosen) {
            TnttDocumentRecipient recipient = new TnttDocumentRecipient();
            recipient.noticeId = n.getId();
            recipient.userId = person.getId();
            recipient.email =
                    person.getEmail() == null
                            ? null
                            : person.getEmail().trim().toLowerCase(Locale.ROOT);
            recipient.emailStatus =
                    !Boolean.TRUE.equals(r.email)
                            ? "NOT_REQUESTED"
                            : TnttDocumentMail.validEmail(recipient.email) ? "PENDING" : "MISSING";
            stamp(recipient, u);
            em.persist(recipient);
        }
        e.shared = true;
        e.noticeId = n.getId();
        e.updatedAt = clock.getAsLong();
        stamp(e, u);
        em.flush();
        return notice(n);
    }

    private void cancel(Long id) {
        if (id == null) return;
        TnttDocumentNotice n = em.find(TnttDocumentNotice.class, id);
        if (n != null) n.disabled = true;
        em.createQuery(
                        "update TnttDocumentRecipient r set r.emailStatus='CANCELLED' where r.noticeId=:id and r.emailStatus='PENDING'")
                .setParameter("id", id)
                .executeUpdate();
    }

    public Map<String, Object> sharing(Long id, TnttDocumentRequest r) {
        requireEditor();
        TnttDocumentEntry e = entry(id, true);
        revision(e, r == null ? null : r.revision);
        if (e.archived || e.noticeId == null)
            throw new IllegalArgumentException("Hãy tạo đợt chia sẻ trước.");
        e.shared = Boolean.TRUE.equals(r.shared);
        TnttDocumentNotice n = em.find(TnttDocumentNotice.class, e.noticeId);
        if (n != null) n.disabled = !e.shared;
        if (!e.shared) cancel(e.noticeId);
        em.flush();
        return metadata(e);
    }

    private Map<String, Object> notice(TnttDocumentNotice n) {
        return map(
                "id",
                n.getId(),
                "entryId",
                n.entryId,
                "title",
                n.title,
                "summary",
                n.summary,
                "startsAt",
                n.startsAt,
                "endsAt",
                n.endsAt,
                "publishedAt",
                n.publishedAt,
                "disabled",
                n.disabled);
    }

    public List<Map<String, Object>> notifications(boolean unreadOnly) {
        requireEnabled();
        User u = actor();
        if (student(u) || groups(u, classes()).isEmpty()) return Collections.emptyList();
        long now = clock.getAsLong();
        // Poll only metadata. Handwriting snapshots are fetched when the recipient opens a
        // document.
        String hql =
                "select n.id,n.entryId,n.title,n.summary,n.startsAt,n.endsAt,n.publishedAt,n.disabled,r.readAt,e.noticeId "
                        + "from TnttDocumentNotice n,TnttDocumentRecipient r,TnttDocumentEntry e,TnttDocumentNotice c "
                        + "where r.noticeId=n.id and r.userId=:u and e.id=n.entryId and e.archived=false and e.shared=true "
                        + "and c.id=e.noticeId and c.disabled=false and c.startsAt<=:now and n.startsAt<=:now "
                        + "and exists(select cr.id from TnttDocumentRecipient cr where cr.noticeId=c.id and cr.userId=:u)";
        if (unreadOnly)
            hql +=
                    " and e.noticeId=n.id and n.disabled=false and n.endsAt>:now and r.readAt is null";
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object[] row :
                em.createQuery(hql + " order by n.publishedAt desc,n.id desc", Object[].class)
                        .setParameter("u", u.getId())
                        .setParameter("now", now)
                        .getResultList()) {
            boolean active =
                    !Boolean.TRUE.equals(row[7])
                            && Objects.equals(row[0], row[9])
                            && now < (Long) row[5];
            out.add(
                    map(
                            "id",
                            row[0],
                            "entryId",
                            row[1],
                            "title",
                            row[2],
                            "summary",
                            row[3],
                            "startsAt",
                            row[4],
                            "endsAt",
                            row[5],
                            "publishedAt",
                            row[6],
                            "disabled",
                            row[7],
                            "readAt",
                            row[8],
                            "active",
                            active));
        }
        return out;
    }

    public Map<String, Object> notificationDocument(Long id) {
        requireEnabled();
        User u = actor();
        requireRecipient(u);
        TnttDocumentNotice n = em.find(TnttDocumentNotice.class, id);
        if (n == null || n.startsAt > clock.getAsLong())
            throw new AccessDeniedException("Thông báo chưa được công bố.");
        TnttDocumentEntry e = entry(n.entryId, false);
        readableNotice(e, u);
        if (!recipient(id, u.getId()))
            throw new AccessDeniedException("Bạn không thuộc nhóm nhận.");
        Map<String, Object> out = notice(n);
        out.put("document", decode(n.notebookJson));
        out.put("canEdit", false);
        out.put("revision", n.getId());
        return out;
    }

    public void markRead(Long id) {
        notificationDocument(id);
        User u = actor();
        TnttDocumentRecipient r =
                em.createQuery(
                                "select r from TnttDocumentRecipient r where r.noticeId=:n and r.userId=:u",
                                TnttDocumentRecipient.class)
                        .setParameter("n", id)
                        .setParameter("u", u.getId())
                        .setLockMode(LockModeType.PESSIMISTIC_WRITE)
                        .getSingleResult();
        if (r.readAt == null) r.readAt = clock.getAsLong();
        em.flush();
    }

    public Map<String, Object> delivery(Long id) {
        requireEditor();
        entry(id, false);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object[] row :
                em.createQuery(
                                "select r,n from TnttDocumentRecipient r,TnttDocumentNotice n where r.noticeId=n.id and n.entryId=:id order by n.id desc,r.id",
                                Object[].class)
                        .setParameter("id", id)
                        .setMaxResults(2000)
                        .getResultList()) {
            TnttDocumentRecipient r = (TnttDocumentRecipient) row[0];
            User u = em.find(User.class, r.userId);
            out.add(
                    map(
                            "id",
                            r.getId(),
                            "noticeId",
                            r.noticeId,
                            "name",
                            u == null ? "Tài khoản đã ngừng hoạt động" : name(u),
                            "readAt",
                            r.readAt,
                            "emailStatus",
                            r.emailStatus,
                            "emailError",
                            r.emailError,
                            "emailSentAt",
                            r.emailSentAt));
        }
        return map("recipients", out, "emailConfigured", mail.configured());
    }

    public void testEmail(Long id) {
        User u = requireEditor();
        TnttDocumentEntry e = entry(id, false);
        if (!mail.configured() || !TnttDocumentMail.validEmail(u.getEmail()))
            throw new IllegalArgumentException("Cần cấu hình hộp thư gửi và email hợp lệ của bạn.");
        mail.send(
                u.getEmail(),
                "[Gửi thử] " + e.title,
                "Đây là email gửi thử. Tài liệu: " + e.title,
                "test-" + UUID.randomUUID());
    }

    public List<Map<String, Object>> claimEmails() {
        if (!enabled || !mail.configured()) return Collections.emptyList();
        long now = clock.getAsLong();
        List<TnttDocumentRecipient> candidates =
                em.createQuery(
                                "select r from TnttDocumentRecipient r,TnttDocumentNotice n,TnttDocumentEntry e where r.noticeId=n.id and e.id=n.entryId and e.noticeId=n.id and e.shared=true and e.archived=false and n.disabled=false and n.startsAt<=:now and n.endsAt>:now and r.emailStatus='PENDING' order by r.id",
                                TnttDocumentRecipient.class)
                        .setParameter("now", now)
                        .setMaxResults(10)
                        .getResultList();
        List<Map<String, Object>> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        RecipientScope school = classes();
        for (TnttDocumentRecipient candidate : candidates) {
            String key = candidate.noticeId + ":" + candidate.email;
            if (!seen.add(key)) continue;
            List<TnttDocumentRecipient> same =
                    em.createQuery(
                                    "select r from TnttDocumentRecipient r where r.noticeId=:n and r.email=:e order by r.id",
                                    TnttDocumentRecipient.class)
                            .setParameter("n", candidate.noticeId)
                            .setParameter("e", candidate.email)
                            .setLockMode(LockModeType.PESSIMISTIC_WRITE)
                            .getResultList();
            boolean sent = false, pending = false;
            for (TnttDocumentRecipient r : same) {
                em.refresh(r);
                if (Arrays.asList("SENT", "SENDING").contains(r.emailStatus)) sent = true;
                User u = em.find(User.class, r.userId);
                boolean allowed =
                        u != null
                                && !groups(u, school).isEmpty()
                                && candidate.email != null
                                && candidate.email.equalsIgnoreCase(
                                        u.getEmail() == null ? "" : u.getEmail().trim());
                if (!allowed && "PENDING".equals(r.emailStatus)) r.emailStatus = "CANCELLED";
                if ("PENDING".equals(r.emailStatus)) pending = true;
            }
            if (!pending) continue;
            for (TnttDocumentRecipient r : same)
                if ("PENDING".equals(r.emailStatus)) r.emailStatus = sent ? "DUPLICATE" : "SENDING";
            if (!sent) {
                TnttDocumentNotice n = em.find(TnttDocumentNotice.class, candidate.noticeId);
                out.add(
                        map(
                                "noticeId",
                                candidate.noticeId,
                                "email",
                                candidate.email,
                                "title",
                                n.title,
                                "summary",
                                n.summary));
            }
        }
        em.flush();
        return out;
    }

    public void emailResult(Long id, String email, boolean success) {
        em.createQuery(
                        "update TnttDocumentRecipient r set r.emailStatus=:s,r.emailSentAt=:t,r.emailError=:e where r.noticeId=:n and r.email=:mail and r.emailStatus='SENDING'")
                .setParameter("s", success ? "SENT" : "FAILED")
                .setParameter("t", success ? clock.getAsLong() : null)
                .setParameter(
                        "e",
                        success
                                ? null
                                : "Chưa xác nhận gửi được. Kiểm tra hộp thư trước khi gửi lại.")
                .setParameter("n", id)
                .setParameter("mail", email)
                .executeUpdate();
    }

    public boolean emailStillAllowed(Long id) {
        if (!enabled || !mail.configured()) return false;
        TnttDocumentNotice n = em.find(TnttDocumentNotice.class, id);
        if (n == null) return false;
        em.refresh(n);
        TnttDocumentEntry e = entry(n.entryId, false);
        em.refresh(e);
        return !n.disabled
                && !e.archived
                && e.shared
                && Objects.equals(e.noticeId, id)
                && n.startsAt <= clock.getAsLong()
                && clock.getAsLong() < n.endsAt;
    }
}
