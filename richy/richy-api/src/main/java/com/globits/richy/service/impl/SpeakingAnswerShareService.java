package com.globits.richy.service.impl;

import com.globits.richy.domain.*;
import com.globits.richy.dto.SpeakingStudentAnswerDto.*;
import com.globits.security.domain.User;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import javax.persistence.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class SpeakingAnswerShareService {
    @PersistenceContext private EntityManager em;
    @Autowired private SpeakingServiceImpl speaking;
    @Autowired private SpeakingStudentAnswerService answers;
    private final SecureRandom random=new SecureRandom();
    private SecretKeySpec copyKey;
    public static class Request { public Long setId,studentId; public String permission; }

    @Value("${speaking.share.copy-key:${SPEAKING_SHARE_COPY_KEY:}}")
    void configureCopyKey(String encodedKey) {
        if (encodedKey.trim().isEmpty()) { return; }
        byte[] key = Base64.getDecoder().decode(encodedKey.trim());
        if (key.length != 32) {
            throw new IllegalArgumentException("Speaking link copy key must be 32 bytes encoded as Base64.");
        }
        copyKey = new SecretKeySpec(key, "HmacSHA256");
    }

    private String tokenForNonce(String nonce) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(copyKey);
            byte[] signature = mac.doFinal(("speaking-answer-share:" + nonce).getBytes(StandardCharsets.US_ASCII));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(signature);
        } catch (GeneralSecurityException error) {
            throw new IllegalStateException(error);
        }
    }
    private User authorize(Long setId,Long studentId){
        SpeakingSet set=speaking.readableSet(setId);User student=speaking.reviewableStudent(set,studentId);
        if(student==null||!Boolean.TRUE.equals(student.getActive()))throw new AccessDeniedException("Tài khoản không còn hoạt động.");return student;
    }
    public static String hash(String token){
        try{byte[] bytes=MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.US_ASCII));StringBuilder out=new StringBuilder();for(byte b:bytes)out.append(String.format(Locale.ROOT,"%02x",b&255));return out.toString();}
        catch(NoSuchAlgorithmException error){throw new IllegalStateException(error);}
    }
    private Map<String,Object> metadata(SpeakingAnswerShare link){return SpeakingServiceImpl.map("id",link.getId(),"permission",link.getPermission(),"createdAt",link.getCreateDate()==null?null:link.getCreateDate().toString(),"creatorId",link.getCreatorId(),"revoked",link.isRevoked(),"copyable",copyKey!=null&&link.getCopyNonce()!=null&&!link.isRevoked());}
    private Map<String,Object> withToken(SpeakingAnswerShare link, String token) {
        Map<String,Object> result = metadata(link);
        result.put("setId", link.getSetId());
        result.put("studentId", link.getStudentId());
        result.put("token", token);
        return result;
    }
    public List<Map<String,Object>> list(Long setId,Long studentId){
        User student=authorize(setId,studentId);List<Map<String,Object>> result=new ArrayList<Map<String,Object>>();
        for(SpeakingAnswerShare link:em.createQuery("select s from SpeakingAnswerShare s where s.setId=:set and s.studentId=:student and s.revoked=false order by s.id desc",SpeakingAnswerShare.class).setParameter("set",setId).setParameter("student",student.getId()).getResultList())result.add(metadata(link));return result;
    }
    public Map<String,Object> create(Request request){
        if(request==null||!Arrays.asList("VIEW","EDIT").contains(request.permission))throw new IllegalArgumentException("Chọn link chỉ xem hoặc chỉnh sửa.");
        User student=authorize(request.setId,request.studentId);
        long count=em.createQuery("select count(s) from SpeakingAnswerShare s where s.setId=:set and s.studentId=:student and s.revoked=false",Long.class).setParameter("set",request.setId).setParameter("student",student.getId()).getSingleResult();
        if(count>=40)throw new IllegalArgumentException("Đã có nhiều link đang bật. Thu hồi link không còn dùng trước khi tạo thêm.");
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String value = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        String nonce = copyKey == null ? null : value;
        String token = nonce == null ? value : tokenForNonce(nonce);
        SpeakingAnswerShare link=new SpeakingAnswerShare();link.setSetId(request.setId);link.setStudentId(student.getId());link.setCreatorId(speaking.currentUser().getId());link.setPermission(request.permission);link.setCopyNonce(nonce);link.setTokenHash(hash(token));em.persist(link);em.flush();
        return withToken(link, token);
    }
    public Map<String,Object> copy(Long id) {
        SpeakingAnswerShare link = id == null ? null : em.find(SpeakingAnswerShare.class, id, LockModeType.PESSIMISTIC_READ);
        if (link == null || link.isRevoked()) {
            throw new AccessDeniedException("Link không còn khả dụng.");
        }
        authorize(link.getSetId(), link.getStudentId());
        if (copyKey == null || link.getCopyNonce() == null) {
            throw new IllegalArgumentException("Không có link để sao chép lại. Hãy tạo link mới sau khi bật cấu hình sao chép.");
        }
        String token = tokenForNonce(link.getCopyNonce());
        if (!hash(token).equals(link.getTokenHash())) {
            throw new IllegalArgumentException("Cấu hình sao chép đã đổi. Hãy tạo link mới để sao chép.");
        }
        User creator = em.find(User.class, link.getCreatorId());
        if (creator == null || !Boolean.TRUE.equals(creator.getActive())) {
            throw new AccessDeniedException("Link không còn khả dụng.");
        }
        return withToken(link, token);
    }
    public Map<String,Object> revoke(Long id){
        SpeakingAnswerShare link=id==null?null:em.find(SpeakingAnswerShare.class,id,LockModeType.PESSIMISTIC_WRITE);
        if(link==null)throw new AccessDeniedException("Không tìm thấy link chia sẻ.");authorize(link.getSetId(),link.getStudentId());link.setRevoked(true);em.flush();return metadata(link);
    }
    private SpeakingAnswerShare resolve(String token,boolean write){
        if(token==null||!token.matches("[A-Za-z0-9_-]{43}"))throw new AccessDeniedException("Link không còn khả dụng.");
        TypedQuery<SpeakingAnswerShare> query=em.createQuery("select s from SpeakingAnswerShare s where s.tokenHash=:hash and s.revoked=false",SpeakingAnswerShare.class).setParameter("hash",hash(token));
        // A successful revocation waits for an in-flight write; a later write cannot revive it.
        if(write)query.setLockMode(LockModeType.PESSIMISTIC_WRITE);List<SpeakingAnswerShare> rows=query.getResultList();
        if(rows.isEmpty())throw new AccessDeniedException("Link không còn khả dụng.");SpeakingAnswerShare link=rows.get(0);
        User creator=em.find(User.class,link.getCreatorId()),student=em.find(User.class,link.getStudentId());SpeakingSet set=em.find(SpeakingSet.class,link.getSetId());
        if(creator==null||student==null||set==null||!Boolean.TRUE.equals(creator.getActive())||!Boolean.TRUE.equals(student.getActive())||Boolean.TRUE.equals(set.getVoided()))throw new AccessDeniedException("Link không còn khả dụng.");
        if(write&&!"EDIT".equals(link.getPermission()))throw new AccessDeniedException("Link này chỉ cho phép xem.");return link;
    }
    public Map<String,Object> bank(String token){
        SpeakingAnswerShare link=resolve(token,false);SpeakingSet set=em.find(SpeakingSet.class,link.getSetId());User student=em.find(User.class,link.getStudentId());List<Map<String,Object>> questions=new ArrayList<Map<String,Object>>();
        Set<Long> answered=new HashSet<Long>(em.createQuery("select a.questionId from SpeakingStudentAnswer a where a.studentId=:student and a.questionId in (select e.questionId from SpeakingSetEntry e where e.setId=:set)",Long.class).setParameter("student",student.getId()).setParameter("set",set.getId()).getResultList());
        for(Object[] pair:em.createQuery("select e,q from SpeakingSetEntry e, SpeakingQuestion q where e.setId=:set and q.id=e.questionId and q.ownerId=:owner order by e.id",Object[].class).setParameter("set",set.getId()).setParameter("owner",set.getOwnerId()).getResultList()){
            SpeakingSetEntry entry=(SpeakingSetEntry)pair[0];SpeakingQuestion question=(SpeakingQuestion)pair[1];
            questions.add(SpeakingServiceImpl.map("id",question.getId(),"entryId",entry.getId(),"part",question.getPart(),"topic",question.getTopic(),"prompt",question.getPrompt(),"linkedPart2Id",entry.getLinkedPart2Id(),"hasAnswer",answered.contains(question.getId())));
        }
        return SpeakingServiceImpl.map("shareId",link.getId(),"setId",set.getId(),"setName",set.getName(),"studentId",student.getId(),"studentName",speaking.displayName(student),"canEdit","EDIT".equals(link.getPermission()),"questions",questions);
    }
    public Map<String,Object> answer(String token,Long questionId,Long revision){return answers.sharedAnswer(resolve(token,false),questionId,revision);}
    public Map<String,Object> notebook(String token,Long questionId,Long revision){return answers.sharedNotebook(resolve(token,false),questionId,revision);}
    public Map<String,Object> save(String token,WriteRequest request){return answers.saveSharedAnswer(resolve(token,true),request);}
    public Map<String,Object> saveNotebook(String token,NotebookRequest request){return answers.saveSharedNotebook(resolve(token,true),request);}
}
