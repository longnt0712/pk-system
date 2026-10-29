package com.globits.richy.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.globits.richy.domain.*;
import com.globits.richy.dto.SpeakingDto.*;
import com.globits.richy.repository.EnrolmentClassRepository;
import com.globits.security.domain.User;
import com.globits.security.repository.UserRepository;
import java.io.IOException;
import java.security.SecureRandom;
import java.util.*;
import javax.persistence.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class SpeakingServiceImpl {
    @PersistenceContext private EntityManager em;
    @Autowired private UserRepository users;
    @Autowired private EnrolmentClassRepository classes;
    private final ObjectMapper json = new ObjectMapper();
    private final SecureRandom random = new SecureRandom();
    private static final TypeReference<List<ImportRow>> ROWS = new TypeReference<List<ImportRow>>() {};
    private static final TypeReference<List<Long>> IDS = new TypeReference<List<Long>>() {};

    public static Map<String,Object> map(Object... pairs) {
        Map<String,Object> out = new LinkedHashMap<String,Object>();
        for (int i=0; i<pairs.length; i+=2) out.put(String.valueOf(pairs[i]), pairs[i+1]); return out;
    }
    public String encode(Object value) {
        try { return json.writeValueAsString(value); } catch (IOException error) { throw new IllegalStateException("Không mã hóa được dữ liệu Speaking.", error); }
    }
    private <T> T decode(String value, TypeReference<T> type, T empty) {
        if (value == null || value.trim().isEmpty()) return empty;
        try { return json.readValue(value, type); } catch (IOException error) { throw new IllegalStateException("Dữ liệu Speaking đã lưu không hợp lệ.", error); }
    }
    public User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof User)) throw new AccessDeniedException("Cần đăng nhập.");
        User user = users.findByUsernameAndPerson(((User)auth.getPrincipal()).getUsername());
        if (user == null || user.getId() == null) throw new AccessDeniedException("Tài khoản không còn tồn tại."); return user;
    }
    private boolean role(User user, String name) { return user.getRoles() != null && user.getRoles().stream().anyMatch(r -> name.equals(r.getName())); }
    public boolean teacher(User user) {
        return role(user,"ROLE_ADMIN") || role(user,"ROLE_USER") || role(user,"ROLE_EDUCATION_MANAGERMENT")
            || classes.findAll().stream().anyMatch(c -> c.getTeachers().stream().anyMatch(t -> user.getId().equals(t.getId())));
    }
    private void requireTeacher(User user) { if (!teacher(user)) throw new AccessDeniedException("Chỉ giáo viên được quản lý Speaking."); }
    private Set<Long> classScope(User user) {
        Set<Long> result = new HashSet<Long>();
        if (user.getEnrollmentClassIds() != null) result.addAll(user.getEnrollmentClassIds());
        if (user.getPerson() != null && user.getPerson().getEnrollmentClassId() != null) result.add(user.getPerson().getEnrollmentClassId().longValue());
        for (Long id : new ArrayList<Long>(result)) {
            EnrolmentClass c = classes.findOne(id); Set<Long> seen = new HashSet<Long>();
            while (c != null && seen.add(c.getId())) { result.add(c.getId()); c = c.getParent(); }
        }
        return result;
    }
    private boolean managesClass(User user, EnrolmentClass c) {
        if (role(user,"ROLE_ADMIN")) return true;
        Set<Long> seen = new HashSet<Long>();
        while (c != null && seen.add(c.getId())) {
            if (c.getTeachers().stream().anyMatch(t -> user.getId().equals(t.getId()))) return true; c = c.getParent();
        }
        return false;
    }
    public boolean canRead(SpeakingSet set, User user) {
        if (set.getOwnerId().equals(user.getId())) return true;
        if (decode(set.getStudentIdsJson(), IDS, new ArrayList<Long>()).contains(user.getId())) return true;
        Set<Long> memberships = classScope(user);
        return decode(set.getClassIdsJson(), IDS, new ArrayList<Long>()).stream().anyMatch(memberships::contains);
    }
    public SpeakingSet readableSet(Long id) {
        SpeakingSet set = id == null ? null : em.find(SpeakingSet.class,id);
        if (set == null || !canRead(set,currentUser())) throw new AccessDeniedException("Bạn chưa được chia sẻ bộ Speaking này."); return set;
    }
    private SpeakingSet ownedSet(Long id, boolean lock) {
        User user = currentUser(); requireTeacher(user);
        SpeakingSet set = id == null ? null : em.find(SpeakingSet.class,id,lock ? LockModeType.PESSIMISTIC_WRITE : LockModeType.NONE);
        if (set == null || !user.getId().equals(set.getOwnerId())) throw new AccessDeniedException("Đây không phải kho Speaking của bạn."); return set;
    }
    private List<SpeakingSetEntry> entries(Long setId) {
        return em.createQuery("select e from SpeakingSetEntry e where e.setId=:id order by e.id",SpeakingSetEntry.class).setParameter("id",setId).getResultList();
    }
    private Map<Long,SpeakingQuestion> questionMap(Long ownerId) {
        Map<Long,SpeakingQuestion> out = new LinkedHashMap<Long,SpeakingQuestion>();
        for (SpeakingQuestion q : em.createQuery("select q from SpeakingQuestion q where q.ownerId=:id order by q.id",SpeakingQuestion.class).setParameter("id",ownerId).getResultList()) out.put(q.getId(),q);
        return out;
    }
    private String displayName(User user) { return user.getPerson() != null && user.getPerson().getDisplayName() != null ? user.getPerson().getDisplayName() : user.getUsername(); }
    private Map<String,Object> setDto(SpeakingSet set, User user) {
        User owner = users.findOne(set.getOwnerId());
        return map("id",set.getId(),"ownerId",set.getOwnerId(),"ownerName",owner == null ? "Giáo viên" : displayName(owner),
            "year",set.getSeasonYear(),"number",set.getSetNumber(),"fromMonth",(set.getSetNumber()-1)*4+1,"toMonth",set.getSetNumber()*4,
            "name",set.getName(),"canManage",set.getOwnerId().equals(user.getId()),"classIds",set.getOwnerId().equals(user.getId())?decode(set.getClassIdsJson(),IDS,new ArrayList<Long>()):Collections.emptyList(),
            "studentIds",set.getOwnerId().equals(user.getId())?decode(set.getStudentIdsJson(),IDS,new ArrayList<Long>()):Collections.emptyList(),"questionCount",entries(set.getId()).size());
    }
    public Map<String,Object> bootstrap() {
        User user = currentUser(); List<Map<String,Object>> sets = new ArrayList<Map<String,Object>>(), classOptions = new ArrayList<Map<String,Object>>();
        for (SpeakingSet set : em.createQuery("select s from SpeakingSet s order by s.seasonYear desc,s.setNumber,s.id",SpeakingSet.class).getResultList()) if (canRead(set,user)) sets.add(setDto(set,user));
        if (teacher(user)) for (EnrolmentClass c : classes.findAll()) if (managesClass(user,c)) classOptions.add(map("id",c.getId(),"name",c.getName(),"code",c.getCode()));
        return map("userId",user.getId(),"canManage",teacher(user),"aiEnabled",false,"sets",sets,"classes",classOptions);
    }
    public Map<String,Object> createSet(SetRequest request) {
        User user = currentUser(); requireTeacher(user);
        if (request == null || request.year == null || request.year < 1900 || request.year > 2200 || request.number == null || request.number < 1 || request.number > 3) throw new IllegalArgumentException("Chọn năm và bộ từ 1 đến 3.");
        List<SpeakingSet> found = em.createQuery("select s from SpeakingSet s where s.ownerId=:owner and s.seasonYear=:year and s.setNumber=:number",SpeakingSet.class)
            .setParameter("owner",user.getId()).setParameter("year",request.year).setParameter("number",request.number).getResultList();
        SpeakingSet set;
        if (found.isEmpty()) {
            set = new SpeakingSet(); set.setOwnerId(user.getId()); set.setSeasonYear(request.year); set.setSetNumber(request.number);
            set.setName("Bộ " + request.number + " năm " + request.year); set.setClassIdsJson("[]"); set.setStudentIdsJson("[]"); em.persist(set); em.flush();
        } else set = found.get(0);
        return setDto(set,user);
    }
    public List<Map<String,Object>> students(Long setId, String query) {
        SpeakingSet set = ownedSet(setId,false); User owner = currentUser(); Set<Long> scope = new HashSet<Long>();
        for (EnrolmentClass c : classes.findAll()) if (managesClass(owner,c)) scope.add(c.getId());
        Map<Long,User> candidates = new LinkedHashMap<Long,User>();
        if (!scope.isEmpty()) for (User user : users.getUsersByEnrollmentClassIds(new ArrayList<Long>(scope))) candidates.put(user.getId(),user);
        for (Long id : decode(set.getStudentIdsJson(),IDS,new ArrayList<Long>())) { User user=users.findOne(id); if(user!=null)candidates.put(id,user); }
        String term = SpeakingImportSupport.normalized(query);
        if (term.length() >= 2) { User exact=users.findByUsernameAndPerson(SpeakingImportSupport.text(query)); if(exact!=null)candidates.put(exact.getId(),exact); }
        List<Map<String,Object>> result = new ArrayList<Map<String,Object>>();
        for(User user:candidates.values()) if(term.isEmpty() || SpeakingImportSupport.normalized(user.getUsername()+" "+displayName(user)).contains(term)) {
            result.add(map("id",user.getId(),"name",displayName(user),"username",user.getUsername(),"canAccess",canRead(set,user))); if(result.size()>=200)break;
        }
        return result;
    }
    public Map<String,Object> share(Long setId, SetRequest request) {
        SpeakingSet set=ownedSet(setId,true); User user=currentUser();
        List<Long> classIds=uniqueIds(request==null?null:request.classIds,200), studentIds=uniqueIds(request==null?null:request.studentIds,1000);
        for(Long id:classIds) { EnrolmentClass c=classes.findOne(id); if(c==null||!managesClass(user,c))throw new AccessDeniedException("Bạn không phụ trách lớp được chọn."); }
        for(Long id:studentIds) if(users.findOne(id)==null)throw new IllegalArgumentException("Học sinh không tồn tại.");
        set.setClassIdsJson(encode(classIds));set.setStudentIdsJson(encode(studentIds));return setDto(set,user);
    }
    private List<Long> uniqueIds(List<Long> values,int limit) {
        if(values==null)return new ArrayList<Long>(); if(values.size()>limit)throw new IllegalArgumentException("Chọn quá nhiều mục.");
        LinkedHashSet<Long> unique=new LinkedHashSet<Long>();for(Long id:values){if(id==null||id<=0)throw new IllegalArgumentException("Mã dữ liệu không hợp lệ.");unique.add(id);}return new ArrayList<Long>(unique);
    }
    private Map<Long,Boolean> passes(Long studentId) {
        Map<Long,Boolean> out=new HashMap<Long,Boolean>();
        for(SpeakingPass pass:em.createQuery("select p from SpeakingPass p where p.studentId=:id",SpeakingPass.class).setParameter("id",studentId).getResultList())out.put(pass.getQuestionId(),Boolean.TRUE.equals(pass.getPassed()));return out;
    }
    private String sample(SpeakingSetEntry entry,SpeakingQuestion question){return entry.getSample()==null?SpeakingImportSupport.text(question.getSample()):entry.getSample();}
    private Map<String,Object> questionDto(SpeakingSetEntry entry,SpeakingQuestion q,Map<Long,Boolean> passed) {
        return map("id",q.getId(),"entryId",entry.getId(),"code",entry.getImportCode(),"part",q.getPart(),"topic",q.getTopic(),"prompt",q.getPrompt(),
            "sample",sample(entry,q),"linkedPart2Id",entry.getLinkedPart2Id(),"linkedPart2Ids",entry.getLinkedPart2Id()==null?new ArrayList<Long>():new ArrayList<Long>(Collections.singletonList(entry.getLinkedPart2Id())),"passed",Boolean.TRUE.equals(passed.get(q.getId())));
    }
    public Map<String,Object> bank(Long setId,Long studentId) {
        SpeakingSet set=readableSet(setId);User actor=currentUser(),student=actor;boolean owner=set.getOwnerId().equals(actor.getId());
        if(studentId!=null&&!studentId.equals(actor.getId())){if(!owner)throw new AccessDeniedException("Không được xem tiến độ người khác.");student=users.findOne(studentId);if(student==null||!canRead(set,student))throw new AccessDeniedException("Học sinh chưa được chia sẻ bộ này.");}
        Map<Long,SpeakingQuestion> questions=questionMap(set.getOwnerId());Map<Long,Boolean> passed=passes(student.getId());List<Map<String,Object>> list=new ArrayList<Map<String,Object>>();
        for(SpeakingSetEntry entry:entries(setId)){SpeakingQuestion q=questions.get(entry.getQuestionId());if(q!=null)list.add(questionDto(entry,q,passed));}
        return map("set",setDto(set,actor),"studentId",student.getId(),"questions",list,"importPreview",owner?previewDto(set):null);
    }
    public Map<String,Object> markPass(Long setId,PassRequest request) {
        SpeakingSet set=ownedSet(setId,false);User actor=currentUser();
        if(request==null||request.studentId==null||request.passed==null)throw new IllegalArgumentException("Chọn học sinh và trạng thái Pass.");
        User student=users.findOne(request.studentId);if(student==null||!canRead(set,student))throw new AccessDeniedException("Học sinh chưa được chia sẻ bộ này.");
        List<Long> ids=uniqueIds(request.questionIds,500);if(ids.isEmpty())throw new IllegalArgumentException("Chưa chọn câu hỏi.");
        Set<Long> allowed=new HashSet<Long>();for(SpeakingSetEntry e:entries(setId))allowed.add(e.getQuestionId());if(!allowed.containsAll(ids))throw new AccessDeniedException("Câu hỏi không thuộc bộ đã chọn.");
        if(SpeakingImportSupport.text(request.note).length()>1000)throw new IllegalArgumentException("Nhận xét tối đa 1.000 ký tự.");
        // Lock the student so simultaneous teacher updates cannot create duplicate Pass rows across sets.
        em.find(User.class,student.getId(),LockModeType.PESSIMISTIC_WRITE);
        for(Long id:ids){List<SpeakingPass> found=em.createQuery("select p from SpeakingPass p where p.studentId=:student and p.questionId=:question",SpeakingPass.class).setParameter("student",student.getId()).setParameter("question",id).getResultList();
            SpeakingPass pass=found.isEmpty()?new SpeakingPass():found.get(0);pass.setStudentId(student.getId());pass.setQuestionId(id);pass.setTeacherId(actor.getId());pass.setPassed(request.passed);pass.setNote(SpeakingImportSupport.text(request.note));if(pass.getId()==null)em.persist(pass);}
        em.flush();return map("updated",ids.size(),"studentId",student.getId(),"passed",request.passed);
    }
    private SpeakingSetEntry existing(ImportRow row,List<SpeakingSetEntry> entries,Map<Long,SpeakingQuestion> questions) {
        for(SpeakingSetEntry entry:entries){SpeakingQuestion question=questions.get(entry.getQuestionId());
            if(question!=null&&question.getPart().equals(row.part)&&((!SpeakingImportSupport.text(row.code).isEmpty()&&SpeakingImportSupport.normalized(row.code).equals(SpeakingImportSupport.normalized(entry.getImportCode())))
                || SpeakingImportSupport.entryKey(row).equals(entry.getEntryKey())))return entry;}return null;
    }
    private Long linkedPart2(ImportRow row,List<SpeakingSetEntry> entries,Map<Long,SpeakingQuestion> questions) {
        if(row.part!=3||SpeakingImportSupport.text(row.linkedPart2).isEmpty())return null;
        Set<Long> found=new HashSet<Long>();String wanted=SpeakingImportSupport.normalized(row.linkedPart2);
        for(SpeakingSetEntry entry:entries){SpeakingQuestion q=questions.get(entry.getQuestionId());if(q!=null&&q.getPart()==2&&(wanted.equals(SpeakingImportSupport.normalized(q.getTopic()))||wanted.equals(SpeakingImportSupport.normalized(entry.getImportCode()))))found.add(q.getId());}
        if(found.size()!=1)throw new IllegalArgumentException("Part 3 "+row.rowId+": chưa tìm được duy nhất một Part 2 liên kết. Hãy nhập Part 2 trước hoặc sửa tên/mã liên kết.");return found.iterator().next();
    }
    public Map<String,Object> preview(Long setId,byte[] file) throws IOException {
        SpeakingSet set=ownedSet(setId,true);List<ImportRow> rows=SpeakingImportSupport.read(file,set.getSeasonYear(),set.getSetNumber());
        set.setImportRowsJson(encode(rows));set.setImportToken(UUID.randomUUID().toString());em.flush();return previewDto(set);
    }
    private Map<String,Object> previewDto(SpeakingSet set) {
        List<ImportRow> rows=decode(set.getImportRowsJson(),ROWS,new ArrayList<ImportRow>());List<SpeakingSetEntry> entries=entries(set.getId());Map<Long,SpeakingQuestion> questions=questionMap(set.getOwnerId());
        List<Map<String,Object>> result=new ArrayList<Map<String,Object>>();
        for(ImportRow row:rows){SpeakingSetEntry entry=existing(row,entries,questions);SpeakingQuestion old=entry==null?null:questions.get(entry.getQuestionId());String status="NEW",error=row.error;
            Long linked=null;boolean linkPending=false;
            if(error==null&&row.part==3&&!SpeakingImportSupport.text(row.linkedPart2).isEmpty()){
                try{linked=linkedPart2(row,entries,questions);}catch(IllegalArgumentException missing){
                    String wanted=SpeakingImportSupport.normalized(row.linkedPart2);Set<String> candidates=new HashSet<String>();
                    for(ImportRow cue:rows)if(cue.part==2&&cue.error==null&&(wanted.equals(SpeakingImportSupport.normalized(cue.topic))||wanted.equals(SpeakingImportSupport.normalized(cue.code))))candidates.add(SpeakingImportSupport.contentKey(cue,null));
                    if(candidates.size()==1)linkPending=true;else error="Part 2 liên kết chưa có hoặc không duy nhất trong bộ/file. Hãy kiểm tra tên hoặc mã.";
                }
            }
            if(error!=null)status="INVALID";
            else if(old!=null){boolean changed=old.getPart()!=row.part||!SpeakingImportSupport.normalized(old.getTopic()).equals(SpeakingImportSupport.normalized(row.topic))||!SpeakingImportSupport.normalized(old.getPrompt()).equals(SpeakingImportSupport.normalized(row.prompt));
                status=changed?"CHANGED":((!SpeakingImportSupport.text(row.sample).isEmpty()&&!SpeakingImportSupport.text(row.sample).equals(sample(entry,old)))||linkPending||!Objects.equals(linked,entry.getLinkedPart2Id())?"UPDATE_SAMPLE":"UNCHANGED");}
            result.add(map("row",row,"status",status,"error",error,"existingQuestionId",old==null?null:old.getId(),"oldPrompt",old==null?null:old.getPrompt(),"oldSample",old==null?null:sample(entry,old)));
        }
        return map("token",set.getImportToken(),"rows",result);
    }
    public Map<String,Object> confirm(Long setId,ConfirmImport request) {
        SpeakingSet set=ownedSet(setId,true);
        if(request==null||set.getImportToken()==null||!set.getImportToken().equals(request.token)||request.choices==null||request.choices.size()>10000)throw new IllegalArgumentException("File đối chiếu đã thay đổi. Hãy mở lại phần import.");
        Map<String,String> actions=new HashMap<String,String>();for(ImportChoice c:request.choices){if(c==null||c.rowId==null||actions.put(c.rowId,c.action)!=null)throw new IllegalArgumentException("Lựa chọn import bị trùng.");}
        List<ImportRow> rows=decode(set.getImportRowsJson(),ROWS,new ArrayList<ImportRow>());rows.sort(Comparator.comparingInt(r->r.part==2?0:r.part));
        List<SpeakingSetEntry> entries=entries(setId);Map<Long,SpeakingQuestion> questions=questionMap(set.getOwnerId());int imported=0;
        for(ImportRow row:rows){String action=actions.remove(row.rowId);if(action==null||"SKIP".equals(action))continue;
            if(!Arrays.asList("IMPORT","UPDATE_SAMPLE","NEW_VARIANT","MINOR_CORRECTION").contains(action)||row.error!=null)throw new IllegalArgumentException("Dòng "+row.rowId+" không hợp lệ.");
            Long linked=linkedPart2(row,entries,questions);SpeakingSetEntry entry=existing(row,entries,questions);SpeakingQuestion old=entry==null?null:questions.get(entry.getQuestionId());
            String key=SpeakingImportSupport.contentKey(row,linked);boolean changed=old!=null&&!key.equals(old.getContentKey());
            if(changed&&!"NEW_VARIANT".equals(action)&&!"MINOR_CORRECTION".equals(action))throw new IllegalArgumentException("Dòng "+row.rowId+" đã đổi cách hỏi. Chọn biến thể mới hoặc xác nhận sửa lỗi nhỏ.");
            SpeakingQuestion q=null;
            if(changed&&"MINOR_CORRECTION".equals(action)){q=old;for(SpeakingQuestion candidate:questions.values())if(!candidate.getId().equals(q.getId())&&key.equals(candidate.getContentKey()))throw new IllegalArgumentException("Câu đã tồn tại ở mã khác; cần đối chiếu lại.");}
            if(q==null)for(SpeakingQuestion candidate:questions.values())if(key.equals(candidate.getContentKey())){q=candidate;break;}
            if(q==null){q=new SpeakingQuestion();q.setOwnerId(set.getOwnerId());q.setSample(SpeakingImportSupport.text(row.sample));}
            q.setPart(row.part);q.setTopic(SpeakingImportSupport.text(row.topic));q.setPrompt(SpeakingImportSupport.text(row.prompt));q.setContentKey(key);
            if(q.getId()==null){em.persist(q);em.flush();questions.put(q.getId(),q);}
            if(entry==null){entry=new SpeakingSetEntry();entry.setSetId(setId);entry.setEntryKey(SpeakingImportSupport.entryKey(row));entry.setImportCode(SpeakingImportSupport.text(row.code).isEmpty()?"SP"+row.part+"-"+UUID.randomUUID().toString().replace("-",""):row.code);entries.add(entry);}
            entry.setQuestionId(q.getId());entry.setLinkedPart2Id(linked);if(entry.getSample()==null||!SpeakingImportSupport.text(row.sample).isEmpty())entry.setSample(SpeakingImportSupport.text(row.sample));
            if(entry.getId()==null)em.persist(entry);imported++;
        }
        if(!actions.isEmpty())throw new IllegalArgumentException("Dòng đã chọn không thuộc file import hiện tại.");
        em.flush();return map("imported",imported,"preview",previewDto(set));
    }
    private int count(Integer value,int fallback) { int result=value==null?fallback:value;if(result<1||result>30)throw new IllegalArgumentException("Mỗi Part chọn từ 1 đến 30 câu.");return result; }
    private List<Map<String,Object>> choose(List<Map<String,Object>> pool,int count) {
        List<Map<String,Object>> copy=new ArrayList<Map<String,Object>>(pool);Collections.shuffle(copy,random);return new ArrayList<Map<String,Object>>(copy.subList(0,Math.min(count,copy.size())));
    }
    public Map<String,Object> startPractice(PracticeRequest request) {
        User user=currentUser();if(request==null||request.clientKey==null||!request.clientKey.matches("[A-Za-z0-9_-]{8,80}"))throw new IllegalArgumentException("Mã lượt luyện không hợp lệ.");
        List<Long> setIds=uniqueIds(request.setIds,12);if(setIds.isEmpty())throw new IllegalArgumentException("Chọn ít nhất một bộ.");Collections.sort(setIds);
        if(request.parts!=null&&(request.parts.size()>3||request.parts.contains(null)))throw new IllegalArgumentException("Chọn Part hợp lệ.");
        Set<Integer> selectedParts=new TreeSet<Integer>(request.parts==null?Collections.<Integer>emptyList():request.parts);
        if(selectedParts.isEmpty()||!Arrays.asList(1,2,3).containsAll(selectedParts))throw new IllegalArgumentException("Chọn Part 1, 2 hoặc 3.");
        int count1=count(request.part1Count,5),count3=count(request.part3Count,4);Long ownerId=null;
        List<SpeakingSet> sets=new ArrayList<SpeakingSet>();
        for(Long id:setIds){SpeakingSet set=em.find(SpeakingSet.class,id,LockModeType.PESSIMISTIC_WRITE);if(set==null||!canRead(set,user))throw new AccessDeniedException("Bạn chưa được chia sẻ một bộ đã chọn.");
            if(ownerId!=null&&!ownerId.equals(set.getOwnerId()))throw new IllegalArgumentException("Chọn các bộ của cùng một giáo viên cho mỗi lượt luyện.");ownerId=set.getOwnerId();sets.add(set);}
        String requestKey=SpeakingImportSupport.hash(encode(map("sets",setIds,"parts",selectedParts,"part1",count1,"part3",count3,"onlyUnpassed",Boolean.TRUE.equals(request.onlyUnpassed))));
        List<SpeakingPractice> prior=em.createQuery("select p from SpeakingPractice p where p.studentId=:student and p.clientKey=:key",SpeakingPractice.class).setParameter("student",user.getId()).setParameter("key",request.clientKey).getResultList();
        if(!prior.isEmpty()){Map<String,Object> snapshot=snapshot(prior.get(0));if(!requestKey.equals(snapshot.get("requestKey")))throw new IllegalArgumentException("Mã lượt luyện đã được dùng với lựa chọn khác.");return practiceDto(prior.get(0),user);}
        Map<Long,SpeakingQuestion> questions=questionMap(ownerId);Map<Long,Boolean> passed=passes(user.getId());Map<Long,Map<String,Object>> unique=new LinkedHashMap<Long,Map<String,Object>>();
        for(SpeakingSet set:sets)for(SpeakingSetEntry entry:entries(set.getId())){SpeakingQuestion q=questions.get(entry.getQuestionId());if(q!=null&&(!Boolean.TRUE.equals(request.onlyUnpassed)||!Boolean.TRUE.equals(passed.get(q.getId())))){
            if(!unique.containsKey(q.getId()))unique.put(q.getId(),questionDto(entry,q,passed));
            else if(entry.getLinkedPart2Id()!=null){@SuppressWarnings("unchecked") List<Long> links=(List<Long>)unique.get(q.getId()).get("linkedPart2Ids");if(!links.contains(entry.getLinkedPart2Id()))links.add(entry.getLinkedPart2Id());}}}
        List<Map<String,Object>> picked=new ArrayList<Map<String,Object>>();Long part2Id=null;
        for(int part:selectedParts){List<Map<String,Object>> pool=new ArrayList<Map<String,Object>>();for(Map<String,Object> q:unique.values())if(Integer.valueOf(part).equals(q.get("part")))pool.add(q);
            if(part==3&&part2Id!=null){List<Map<String,Object>> linked=new ArrayList<Map<String,Object>>();for(Map<String,Object> q:pool)if(((List<?>)q.get("linkedPart2Ids")).contains(part2Id))linked.add(q);if(!linked.isEmpty())pool=linked;}
            if(pool.isEmpty())throw new IllegalArgumentException("Không có câu phù hợp ở Part "+part+". Hãy đổi bộ hoặc bỏ lọc Chưa Pass.");
            List<Map<String,Object>> chosen=choose(pool,part==1?count1:part==2?1:count3);picked.addAll(chosen);if(part==2)part2Id=((Number)chosen.get(0).get("id")).longValue();}
        List<Map<String,Object>> setNames=new ArrayList<Map<String,Object>>();for(SpeakingSet set:sets)setNames.add(map("id",set.getId(),"name",set.getName(),"year",set.getSeasonYear(),"number",set.getSetNumber()));
        SpeakingPractice practice=new SpeakingPractice();practice.setStudentId(user.getId());practice.setBankOwnerId(ownerId);practice.setClientKey(request.clientKey);practice.setStatus("ACTIVE");practice.setCurrentIndex(0);practice.setElapsedSeconds(0L);practice.setAiStatus("DISABLED");
        practice.setSnapshotJson(encode(map("requestKey",requestKey,"sets",setNames,"parts",selectedParts,"questions",picked)));em.persist(practice);em.flush();return practiceDto(practice,user);
    }
    private Map<String,Object> snapshot(SpeakingPractice practice) { return decode(practice.getSnapshotJson(),new TypeReference<Map<String,Object>>(){},new LinkedHashMap<String,Object>()); }
    public SpeakingPractice accessiblePractice(Long id,boolean lock) {
        SpeakingPractice practice=id==null?null:em.find(SpeakingPractice.class,id,lock?LockModeType.PESSIMISTIC_WRITE:LockModeType.NONE);User user=currentUser();
        if(practice!=null&&lock)em.refresh(practice,LockModeType.PESSIMISTIC_WRITE);
        if(practice==null||(!user.getId().equals(practice.getStudentId())&&!user.getId().equals(practice.getBankOwnerId())))throw new AccessDeniedException("Không được xem lượt Speaking này.");return practice;
    }
    private Map<String,Object> practiceDto(SpeakingPractice practice,User actor) {
        Map<String,Object> data=snapshot(practice);
        if(!"DONE".equals(practice.getStatus())&&actor.getId().equals(practice.getStudentId())){
            Object raw=data.get("questions");if(raw instanceof List)for(Object item:(List<?>)raw)if(item instanceof Map)((Map<?,?>)item).remove("sample");
        }
        List<Map<String,Object>> recordings=new ArrayList<Map<String,Object>>();
        for(SpeakingRecording r:em.createQuery("select r from SpeakingRecording r where r.practiceId=:id order by r.id",SpeakingRecording.class).setParameter("id",practice.getId()).getResultList())recordings.add(recordingDto(r));
        User student=users.findOne(practice.getStudentId());
        return map("id",practice.getId(),"studentId",practice.getStudentId(),"studentName",student==null?"Học sinh":displayName(student),"bankOwnerId",practice.getBankOwnerId(),"status",practice.getStatus(),"currentIndex",practice.getCurrentIndex(),
            "elapsedSeconds",practice.getElapsedSeconds(),"createdAt",practice.getCreateDate()==null?null:practice.getCreateDate().toString(),"snapshot",data,"recordings",recordings,"aiEnabled",false,"aiStatus","DISABLED");
    }
    public static Map<String,Object> recordingDto(SpeakingRecording r){return map("id",r.getId(),"uploadKey",r.getUploadKey(),"questionIndex",r.getQuestionIndex(),"contentType",r.getContentType(),"complete",r.getComplete(),"byteCount",r.getByteCount());}
    public Map<String,Object> getPractice(Long id){return practiceDto(accessiblePractice(id,false),currentUser());}
    public Map<String,Object> exportSet(Long id){ownedSet(id,false);return bank(id,null);}
    public int practiceQuestionCount(SpeakingPractice practice){Object value=snapshot(practice).get("questions");return value instanceof List?((List<?>)value).size():0;}
    public List<Map<String,Object>> history(Long setId,Long studentId) {
        User actor=currentUser();Long target=studentId==null?actor.getId():studentId;Long owner=null;
        if(!target.equals(actor.getId())){SpeakingSet set=ownedSet(setId,false);User student=users.findOne(target);if(student==null||!canRead(set,student))throw new AccessDeniedException("Học sinh chưa được chia sẻ bộ này.");owner=actor.getId();}
        List<SpeakingPractice> found=em.createQuery("select p from SpeakingPractice p where p.studentId=:student order by p.id desc",SpeakingPractice.class).setParameter("student",target).setMaxResults(100).getResultList();
        List<Map<String,Object>> out=new ArrayList<Map<String,Object>>();
        for(SpeakingPractice p:found)if(owner==null||owner.equals(p.getBankOwnerId())){
            Map<String,Object> data=snapshot(p);Object raw=data.get("questions");User student=users.findOne(p.getStudentId());
            out.add(map("id",p.getId(),"studentName",student==null?"Học sinh":displayName(student),"status",p.getStatus(),"createdAt",p.getCreateDate()==null?null:p.getCreateDate().toString(),
                "elapsedSeconds",p.getElapsedSeconds(),"questionCount",raw instanceof List?((List<?>)raw).size():0,"sets",data.get("sets")));
        }return out;
    }
    public Map<String,Object> progress(Long id,PracticeProgress request) {
        SpeakingPractice p=accessiblePractice(id,true);User actor=currentUser();if(!actor.getId().equals(p.getStudentId()))throw new AccessDeniedException("Chỉ học sinh cập nhật lượt luyện của mình.");
        if(request==null||request.currentIndex==null||request.elapsedSeconds==null||request.elapsedSeconds<0||request.elapsedSeconds>604800)throw new IllegalArgumentException("Tiến độ không hợp lệ.");
        Object raw=snapshot(p).get("questions");int size=raw instanceof List?((List<?>)raw).size():0;if(request.currentIndex<0||request.currentIndex>=size)throw new IllegalArgumentException("Câu hiện tại không hợp lệ.");
        if(!"DONE".equals(p.getStatus())){p.setCurrentIndex(request.currentIndex);p.setElapsedSeconds(Math.max(p.getElapsedSeconds(),request.elapsedSeconds));if(Boolean.TRUE.equals(request.finished))p.setStatus("DONE");}
        em.flush();return practiceDto(p,actor);
    }
}
