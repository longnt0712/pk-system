package com.globits.richy.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.globits.richy.domain.*;
import com.globits.richy.dto.SpeakingStudentAnswerDto.*;
import com.globits.security.domain.User;
import java.io.*;
import java.time.Clock;
import java.util.*;
import javax.persistence.*;
import javax.swing.text.MutableAttributeSet;
import javax.swing.text.html.*;
import javax.swing.text.html.parser.ParserDelegator;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Student responses are separate from every shared sample and are version checked on every write. */
@Service
@Transactional
public class SpeakingStudentAnswerService {
    @PersistenceContext private EntityManager em;
    @Autowired private SpeakingServiceImpl speaking;
    private final ObjectMapper json=new ObjectMapper();
    private Clock historyClock=Clock.systemUTC();
    private static final TypeReference<List<Note>> NOTES=new TypeReference<List<Note>>(){};
    private static final int MAX_HTML=100000, MAX_ROWS=1000;
    private static final int HISTORY_LIMIT=5, RETENTION_DAYS=14;
    private static final long CHECKPOINT_MILLIS=10L*60*1000;
    private static final TypeReference<Map<String,Object>> DOCUMENT=new TypeReference<Map<String,Object>>(){};
    private static final Set<String> TAGS=new HashSet<String>(Arrays.asList("b","strong","i","em","u","p","div","br","ul","ol","li","span"));
    private static final Set<String> BLOCKED=new HashSet<String>(Arrays.asList("script","style","iframe","object","svg","math"));
    private static final Set<String> CLASSES=new HashSet<String>(Arrays.asList("ielts-annotation","has-note","is-highlighted"));
    public static class Conflict extends RuntimeException { public Conflict(){super("Câu trả lời đã được cập nhật ở nơi khác. Bản đang sửa vẫn được giữ; tải bản mới để đối chiếu trước khi lưu lại.");} }
    public Map<String,Object> adminStudents(Long setId,Long classId,String query,int page,int pageSize){return speaking.adminStudents(setId,classId,query,page,pageSize);}
    public Map<String,Object> classStudents(Long setId,Long classId,String query,int page,int pageSize){return speaking.classStudents(setId,classId,query,page,pageSize);}
    private static class Context {
        Long setId; User student; Map<Long,Map<String,Object>> questions=new LinkedHashMap<Long,Map<String,Object>>();
    }
    private Context identityContext(Long setId,Long studentId) {
        if(setId==null||setId<=0)throw new IllegalArgumentException("Chọn bộ Speaking.");
        SpeakingSet set=speaking.readableSet(setId);Context c=new Context();c.setId=setId;c.student=speaking.reviewableStudent(set,studentId);
        return c;
    }
    private Context context(Long setId,Long studentId) {
        Context c=identityContext(setId,studentId);SpeakingSet set=speaking.readableSet(setId);
        for(Object[] pair:em.createQuery("select e,q from SpeakingSetEntry e, SpeakingQuestion q where e.setId=:id and q.id=e.questionId and q.ownerId=:owner order by e.id",Object[].class).setParameter("id",setId).setParameter("owner",set.getOwnerId()).getResultList()){
            SpeakingSetEntry entry=(SpeakingSetEntry)pair[0];SpeakingQuestion question=(SpeakingQuestion)pair[1];
            if(!c.questions.containsKey(question.getId()))
                c.questions.put(question.getId(),SpeakingServiceImpl.map("questionId",question.getId(),"code",entry.getImportCode(),"part",question.getPart(),"topic",question.getTopic(),"prompt",question.getPrompt()));
        }return c;
    }
    /** Polling one open editor must not enumerate the entire imported question bank. */
    private Context questionContext(Long setId,Long studentId,Long questionId) {
        Context c=identityContext(setId,studentId);if(questionId==null||questionId<=0)throw new AccessDeniedException("Câu hỏi không thuộc bộ Speaking được chọn.");
        SpeakingSet set=speaking.readableSet(setId);
        List<Integer> parts=em.createQuery("select distinct q.part from SpeakingSetEntry e, SpeakingQuestion q where e.setId=:set and e.questionId=:question and q.id=e.questionId and q.ownerId=:owner",Integer.class)
            .setParameter("set",setId).setParameter("question",questionId).setParameter("owner",set.getOwnerId()).getResultList();
        if(parts.isEmpty())throw new AccessDeniedException("Câu hỏi không thuộc bộ Speaking được chọn.");c.questions.put(questionId,SpeakingServiceImpl.map("part",parts.get(0)));return c;
    }
    private void requireQuestion(Context c,Long id){if(id==null||!c.questions.containsKey(id))throw new AccessDeniedException("Câu hỏi không thuộc bộ Speaking được chọn.");}
    private List<Note> notes(String value){try{return value==null?new ArrayList<Note>():json.readValue(value,NOTES);}catch(IOException error){throw new IllegalStateException("Không đọc được ghi chú đã lưu.",error);}}
    private String encode(Object value){try{return json.writeValueAsString(value);}catch(IOException error){throw new IllegalStateException("Không mã hóa được ghi chú.",error);}}
    private long version(SpeakingStudentAnswer answer){return answer==null?0:(answer.getRevision()==null?0:answer.getRevision())+1;}
    private long historyCutoff(){return historyClock.millis()-RETENTION_DAYS*24L*60*60*1000;}
    private Map<String,Object> dto(Context c,Long questionId,SpeakingStudentAnswer answer){return SpeakingServiceImpl.map("setId",c.setId,"studentId",c.student.getId(),"questionId",questionId,
        "html",answer==null||answer.getHtml()==null?"":answer.getHtml(),"notes",answer==null?new ArrayList<Note>():notes(answer.getNotesJson()),"revision",version(answer),
        "updatedAt",answer==null?null:(answer.getModifyDate()!=null?answer.getModifyDate().toString():(answer.getCreateDate()==null?null:answer.getCreateDate().toString())),"editorId",answer==null?null:answer.getEditorId());}
    private SpeakingStudentAnswer find(Long studentId,Long questionId,boolean refresh){
        List<SpeakingStudentAnswer> found=em.createQuery("select a from SpeakingStudentAnswer a where a.studentId=:student and a.questionId=:question",SpeakingStudentAnswer.class)
            .setParameter("student",studentId).setParameter("question",questionId).getResultList();
        SpeakingStudentAnswer answer=found.isEmpty()?null:found.get(0);if(answer!=null&&refresh)em.refresh(answer,LockModeType.PESSIMISTIC_WRITE);return answer;
    }
    private long[] currentRevisions(Long studentId,Long questionId){
        List<Object[]> rows=em.createQuery("select a.revision,a.notebookRevision from SpeakingStudentAnswer a where a.studentId=:student and a.questionId=:question",Object[].class).setParameter("student",studentId).setParameter("question",questionId).getResultList();
        if(rows.isEmpty())return new long[]{0,0};Object[] row=rows.get(0);return new long[]{(row[0]==null?0:((Number)row[0]).longValue())+1,row[1]==null?0:((Number)row[1]).longValue()};
    }
    private List<SpeakingStudentAnswer> savedForSet(Context c){return em.createQuery("select a from SpeakingStudentAnswer a where a.studentId=:student and a.questionId in (select e.questionId from SpeakingSetEntry e where e.setId=:set) order by a.id",SpeakingStudentAnswer.class).setParameter("student",c.student.getId()).setParameter("set",c.setId).getResultList();}
    public Map<String,Object> list(Long setId,Long studentId,Long questionId){
        Context c=questionId==null?context(setId,studentId):questionContext(setId,studentId,questionId);List<Map<String,Object>> rows=new ArrayList<Map<String,Object>>();
        if(questionId!=null){requireQuestion(c,questionId);rows.add(dto(c,questionId,find(c.student.getId(),questionId,false)));}
        else for(SpeakingStudentAnswer answer:savedForSet(c))rows.add(dto(c,answer.getQuestionId(),answer));
        return SpeakingServiceImpl.map("setId",setId,"studentId",c.student.getId(),"canEdit",true,"answers",rows);
    }
    public Map<String,Object> sync(Long setId,Long studentId,Long questionId,Long revision){
        if(revision==null||revision<0)throw new IllegalArgumentException("Thiếu phiên bản đang xem.");Context c=questionContext(setId,studentId,questionId);long current=currentRevisions(c.student.getId(),questionId)[0];
        Map<String,Object> out=SpeakingServiceImpl.map("setId",setId,"studentId",c.student.getId(),"questionId",questionId,"revision",current,"changed",current!=revision);
        if(current!=revision){SpeakingStudentAnswer answer=find(c.student.getId(),questionId,false);out.put("revision",version(answer));out.put("answer",dto(c,questionId,answer));}return out;
    }
    private SpeakingStudentAnswerVersion latestVersion(SpeakingStudentAnswer answer){
        if(answer==null)return null;
        List<SpeakingStudentAnswerVersion> values=em.createQuery("select v from SpeakingStudentAnswerVersion v where v.answerId=:answer and v.updatedAt>=:cutoff order by v.id desc",SpeakingStudentAnswerVersion.class).setParameter("answer",answer.getId()).setParameter("cutoff",historyCutoff()).setMaxResults(1).getResultList();return values.isEmpty()?null:values.get(0);
    }
    private boolean snapshotMatches(SpeakingStudentAnswerVersion saved,SpeakingStudentAnswer answer){return saved!=null&&Objects.equals(saved.getHtml(),answer.getHtml())&&Objects.equals(saved.getNotesJson(),answer.getNotesJson())&&Objects.equals(saved.getNotebookJson(),answer.getNotebookJson());}
    private boolean interactive(String source){return "EDIT".equals(source)||"NOTEBOOK".equals(source);}
    private SpeakingStudentAnswerVersion checkpoint(SpeakingStudentAnswer answer,String source,boolean group){
        SpeakingStudentAnswerVersion latest=latestVersion(answer);long now=historyClock.millis();
        boolean merge=group&&latest!=null&&interactive(source)&&interactive(latest.getSource())&&Objects.equals(latest.getEditorId(),answer.getEditorId())&&now>=latest.getStartedAt()&&now-latest.getStartedAt()<CHECKPOINT_MILLIS;
        SpeakingStudentAnswerVersion value=merge?latest:new SpeakingStudentAnswerVersion();
        if(!merge){value.setAnswerId(answer.getId());value.setStartedAt(now);}
        value.setAnswerRevision(version(answer));value.setEditorId(answer.getEditorId());value.setSource(source);value.setUpdatedAt(now);value.setHtml(answer.getHtml());value.setNotesJson(answer.getNotesJson());value.setNotebookJson(answer.getNotebookJson());
        if(!merge)em.persist(value);em.flush();
        em.createQuery("delete from SpeakingStudentAnswerVersion v where v.answerId=:answer and v.updatedAt<:cutoff").setParameter("answer",answer.getId()).setParameter("cutoff",historyCutoff()).executeUpdate();
        List<Long> expired=em.createQuery("select v.id from SpeakingStudentAnswerVersion v where v.answerId=:answer order by v.id desc",Long.class).setParameter("answer",answer.getId()).setFirstResult(HISTORY_LIMIT).getResultList();
        if(!expired.isEmpty())em.createQuery("delete from SpeakingStudentAnswerVersion v where v.id in :ids").setParameter("ids",expired).executeUpdate();return value;
    }
    private void preserveCurrent(SpeakingStudentAnswer answer){
        if(answer==null)return;SpeakingStudentAnswerVersion latest=latestVersion(answer);if(!snapshotMatches(latest,answer))checkpoint(answer,"BASELINE",false);
    }
    private String editorName(Long id){User user=id==null?null:em.find(User.class,id);return user==null?"Người dùng":speaking.displayName(user);}
    private Map<String,Object> versionDto(SpeakingStudentAnswerVersion value,boolean body){
        Map<String,Object> out=SpeakingServiceImpl.map("id",value.getId(),"revision",value.getAnswerRevision(),"editorId",value.getEditorId(),"editorName",editorName(value.getEditorId()),"source",value.getSource(),"startedAt",value.getStartedAt(),"updatedAt",value.getUpdatedAt());
        if(body){out.put("html",value.getHtml()==null?"":value.getHtml());out.put("notes",notes(value.getNotesJson()));out.put("notebook",document(value.getNotebookJson()));}return out;
    }
    public Map<String,Object> history(Long setId,Long studentId,Long questionId){
        Context c=questionContext(setId,studentId,questionId);SpeakingStudentAnswer answer=find(c.student.getId(),questionId,false);List<Map<String,Object>> rows=new ArrayList<Map<String,Object>>();
        // The picker needs metadata only; A4 snapshots can contain large drawings.
        if(answer!=null)for(Object[] value:em.createQuery("select v.id,v.answerRevision,v.editorId,v.source,v.startedAt,v.updatedAt from SpeakingStudentAnswerVersion v where v.answerId=:answer and v.updatedAt>=:cutoff order by v.id desc",Object[].class).setParameter("answer",answer.getId()).setParameter("cutoff",historyCutoff()).setMaxResults(HISTORY_LIMIT).getResultList())
            rows.add(SpeakingServiceImpl.map("id",value[0],"revision",value[1],"editorId",value[2],"editorName",editorName((Long)value[2]),"source",value[3],"startedAt",value[4],"updatedAt",value[5]));
        return SpeakingServiceImpl.map("setId",setId,"studentId",c.student.getId(),"questionId",questionId,"currentRevision",version(answer),"checkpointMinutes",10,"retainedLimit",HISTORY_LIMIT,"retentionDays",RETENTION_DAYS,"versions",rows);
    }
    private SpeakingStudentAnswerVersion ownedVersion(SpeakingStudentAnswer answer,Long id){
        if(answer==null||id==null)throw new AccessDeniedException("Phiên bản không thuộc câu trả lời đang mở.");
        List<SpeakingStudentAnswerVersion> values=em.createQuery("select v from SpeakingStudentAnswerVersion v where v.id=:id and v.answerId=:answer and v.updatedAt>=:cutoff",SpeakingStudentAnswerVersion.class).setParameter("id",id).setParameter("answer",answer.getId()).setParameter("cutoff",historyCutoff()).getResultList();
        if(values.isEmpty())throw new AccessDeniedException("Phiên bản không thuộc câu trả lời đang mở.");return values.get(0);
    }
    public Map<String,Object> historyVersion(Long setId,Long studentId,Long questionId,Long versionId){
        Context c=questionContext(setId,studentId,questionId);SpeakingStudentAnswer answer=find(c.student.getId(),questionId,false);
        return SpeakingServiceImpl.map("setId",setId,"studentId",c.student.getId(),"questionId",questionId,"version",versionDto(ownedVersion(answer,versionId),true));
    }
    private void lockStudent(Context c){em.find(User.class,c.student.getId(),LockModeType.PESSIMISTIC_WRITE);}
    private static String escape(String text){return text.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;");}
    private static boolean noteId(String id){return id!=null&&id.matches("[A-Za-z0-9_-]{1,80}");}
    private static class CleanHtml {
        String html;Set<String> markers=new HashSet<String>();
    }
    private static CleanHtml clean(String source){
        if(source==null)source="";if(source.length()>MAX_HTML)throw new IllegalArgumentException("Câu trả lời tối đa 100.000 ký tự HTML.");
        final CleanHtml cleaned=new CleanHtml();final StringBuilder out=new StringBuilder();final Deque<String> stack=new ArrayDeque<String>();
        try{new ParserDelegator().parse(new StringReader(source),new HTMLEditorKit.ParserCallback(){
            int blocked=0;
            private String attr(MutableAttributeSet a,String name){Enumeration<?> keys=a.getAttributeNames();while(keys.hasMoreElements()){Object key=keys.nextElement();if(name.equalsIgnoreCase(String.valueOf(key)))return String.valueOf(a.getAttribute(key));}return null;}
            @Override public void handleStartTag(HTML.Tag tag,MutableAttributeSet a,int pos){String name=tag.toString().toLowerCase(Locale.ROOT);if(BLOCKED.contains(name)){blocked++;return;}if(blocked>0||!TAGS.contains(name))return;
                out.append('<').append(name);if("span".equals(name)){
                    String className=attr(a,"class"),id=attr(a,"data-note-id"),group=attr(a,"data-annotation-group");List<String> allowed=new ArrayList<String>();
                    if(className!=null)for(String token:className.split("\\s+"))if(CLASSES.contains(token)&&!allowed.contains(token))allowed.add(token);
                    if(noteId(id)){cleaned.markers.add(id);if(!allowed.contains("ielts-annotation"))allowed.add("ielts-annotation");if(!allowed.contains("has-note"))allowed.add("has-note");out.append(" data-note-id=\"").append(id).append('"');}
                    else allowed.remove("has-note");
                    if(noteId(group))out.append(" data-annotation-group=\"").append(group).append('"');
                    if(!allowed.isEmpty())out.append(" class=\"").append(String.join(" ",allowed)).append('"');
                }out.append('>');stack.push(name);
            }
            @Override public void handleEndTag(HTML.Tag tag,int pos){String name=tag.toString().toLowerCase(Locale.ROOT);if(BLOCKED.contains(name)){if(blocked>0)blocked--;return;}if(blocked>0||!TAGS.contains(name)||!stack.contains(name))return;while(!stack.isEmpty()){String close=stack.pop();out.append("</").append(close).append('>');if(close.equals(name))break;}}
            @Override public void handleSimpleTag(HTML.Tag tag,MutableAttributeSet a,int pos){if(blocked==0&&"br".equals(tag.toString()))out.append("<br>");}
            @Override public void handleText(char[] text,int pos){if(blocked==0)out.append(escape(new String(text)));}
        },true);}catch(IOException error){throw new IllegalArgumentException("Không đọc được nội dung trả lời.");}
        while(!stack.isEmpty())out.append("</").append(stack.pop()).append('>');cleaned.html=out.toString();if(cleaned.html.length()>MAX_HTML)throw new IllegalArgumentException("Nội dung trả lời quá dài.");return cleaned;
    }
    /** Exposed to isolated regression tests as well as all editor/import writes. */
    public static String sanitizeHtml(String source){return clean(source).html;}
    private List<Note> validateNotes(List<Note> input,Set<String> markers){
        if(input==null)input=Collections.emptyList();if(input.size()>200)throw new IllegalArgumentException("Tối đa 200 ghi chú cho một câu trả lời.");
        Set<String> ids=new HashSet<String>();List<Note> result=new ArrayList<Note>();for(Note note:input){if(note==null||!noteId(note.id)||!ids.add(note.id)||note.text==null||note.text.length()>2000)throw new IllegalArgumentException("Ghi chú bị trùng mã hoặc vượt 2.000 ký tự.");result.add(new Note(note.id,note.text));}
        if(!ids.equals(markers))throw new IllegalArgumentException("Đoạn chữ gắn ghi chú không khớp danh sách ghi chú. Bản đang sửa vẫn được giữ; hãy kiểm tra lại.");return result;
    }
    private SpeakingStudentAnswer write(Context c,WriteRequest request,SpeakingStudentAnswer answer,CleanHtml content,List<Note> notes,String source){
        if(request.revision==null||request.revision<0)throw new IllegalArgumentException("Thiếu phiên bản câu trả lời. Hãy tải câu trước khi sửa.");if(version(answer)!=request.revision.longValue()){
            if(answer!=null&&Objects.equals(answer.getHtml(),content.html)&&Objects.equals(answer.getNotesJson(),encode(notes)))return answer;
            throw new Conflict();
        }
        if(answer!=null&&Objects.equals(answer.getHtml(),content.html)&&Objects.equals(answer.getNotesJson(),encode(notes)))return answer;
        preserveCurrent(answer);
        if(answer==null){answer=new SpeakingStudentAnswer();answer.setStudentId(c.student.getId());answer.setQuestionId(request.questionId);}
        answer.setHtml(content.html);answer.setNotesJson(encode(notes));answer.setEditorId(speaking.currentUser().getId());if(answer.getId()==null)em.persist(answer);em.flush();checkpoint(answer,source,true);return answer;
    }
    public Map<String,Object> save(WriteRequest request){
        if(request==null)throw new IllegalArgumentException("Thiếu câu trả lời.");Context c=questionContext(request.setId,request.studentId,request.questionId);
        CleanHtml html=clean(request.html);List<Note> notes=validateNotes(request.notes,html.markers);lockStudent(c);SpeakingStudentAnswer saved=write(c,request,find(c.student.getId(),request.questionId,true),html,notes,"EDIT");em.flush();return dto(c,request.questionId,saved);
    }
    private Map<String,Object> document(String value){try{return value==null?null:json.readValue(value,DOCUMENT);}catch(IOException error){throw new IllegalStateException("Không đọc được sổ ghi chú đã lưu.",error);}}
    private Map<String,Object> blankDocument(){return SpeakingServiceImpl.map("text","","orientation","portrait","pattern","lined","strokes",new ArrayList<Object>());}
    private boolean number(Object value,double min,double max){if(!(value instanceof Number))return false;double n=((Number)value).doubleValue();return !Double.isNaN(n)&&!Double.isInfinite(n)&&n>=min&&n<=max;}
    @SuppressWarnings("unchecked") private Map<String,Object> validateDocument(Map<String,Object> input){
        if(input==null||!(input.get("text") instanceof String)||((String)input.get("text")).length()>500000||!Arrays.asList("portrait","landscape").contains(input.get("orientation"))||!Arrays.asList("blank","lined","vertical","grid","squares","sketch").contains(input.get("pattern"))||!(input.get("strokes") instanceof List))throw new IllegalArgumentException("Nội dung sổ ghi chú không hợp lệ.");
        List<?> strokes=(List<?>)input.get("strokes");if(strokes.size()>10000)throw new IllegalArgumentException("Sổ ghi chú tối đa 10.000 nét vẽ.");List<Map<String,Object>> clean=new ArrayList<Map<String,Object>>();Set<String> ids=new HashSet<String>();long pointCount=0;
        for(Object raw:strokes){
            if(!(raw instanceof Map))throw new IllegalArgumentException("Nét vẽ không hợp lệ.");Map<?,?> stroke=(Map<?,?>)raw;
            Object id=stroke.get("id"),color=stroke.get("color");if(!(id instanceof String)||((String)id).isEmpty()||((String)id).length()>100||!ids.add((String)id)||!Arrays.asList("pen","highlighter").contains(stroke.get("tool"))||!(color instanceof String)||!((String)color).matches("#[0-9a-fA-F]{6}")||!number(stroke.get("width"),Double.MIN_VALUE,100)||!(stroke.get("points") instanceof List))throw new IllegalArgumentException("Nét vẽ không hợp lệ.");
            List<?> points=(List<?>)stroke.get("points");pointCount+=points.size();if(points.isEmpty()||pointCount>200000)throw new IllegalArgumentException("Sổ ghi chú tối đa 200.000 điểm vẽ.");List<List<Number>> copied=new ArrayList<List<Number>>();
            for(Object rawPoint:points){if(!(rawPoint instanceof List))throw new IllegalArgumentException("Tọa độ nét vẽ không hợp lệ.");List<?> point=(List<?>)rawPoint;if(point.size()<2||point.size()>3||!number(point.get(0),0,100000)||!number(point.get(1),0,100000)||(point.size()==3&&!number(point.get(2),0,1)))throw new IllegalArgumentException("Tọa độ nét vẽ không hợp lệ.");List<Number> copy=new ArrayList<Number>();for(Object n:point)copy.add((Number)n);copied.add(copy);}
            clean.add(SpeakingServiceImpl.map("id",id,"tool",stroke.get("tool"),"color",color,"width",stroke.get("width"),"points",copied));
        }
        Map<String,Object> out=SpeakingServiceImpl.map("text",input.get("text"),"orientation",input.get("orientation"),"pattern",input.get("pattern"),"strokes",clean);
        if(encode(out).getBytes(java.nio.charset.StandardCharsets.UTF_8).length>8*1024*1024)throw new IllegalArgumentException("Sổ ghi chú vượt dung lượng 8 MB.");return out;
    }
    private long notebookRevision(SpeakingStudentAnswer answer){return answer==null||answer.getNotebookRevision()==null?0:answer.getNotebookRevision();}
    private Map<String,Object> notebookDto(Context c,Long questionId,SpeakingStudentAnswer answer,Long known){
        long revision=notebookRevision(answer);boolean changed=known==null||known!=revision;Map<String,Object> out=SpeakingServiceImpl.map("setId",c.setId,"studentId",c.student.getId(),"questionId",questionId,"revision",revision,"changed",changed);
        if(changed){Map<String,Object> value=answer==null?null:document(answer.getNotebookJson());out.put("document",value==null?blankDocument():value);}return out;
    }
    public Map<String,Object> notebook(Long setId,Long studentId,Long questionId,Long known){
        if(known!=null&&known<0)throw new IllegalArgumentException("Phiên bản ghi chú không hợp lệ.");Context c=questionContext(setId,studentId,questionId);
        if(known!=null&&currentRevisions(c.student.getId(),questionId)[1]==known)return SpeakingServiceImpl.map("setId",setId,"studentId",c.student.getId(),"questionId",questionId,"revision",known,"changed",false);
        return notebookDto(c,questionId,find(c.student.getId(),questionId,false),known);
    }
    public Map<String,Object> saveNotebook(NotebookRequest request){
        if(request==null||request.revision==null||request.revision<0)throw new IllegalArgumentException("Thiếu phiên bản sổ ghi chú.");Context c=questionContext(request.setId,request.studentId,request.questionId);String data=encode(validateDocument(request.document));lockStudent(c);SpeakingStudentAnswer answer=find(c.student.getId(),request.questionId,true);
        if(notebookRevision(answer)!=request.revision){if(answer!=null&&Objects.equals(answer.getNotebookJson(),data))return notebookDto(c,request.questionId,answer,null);throw new Conflict();}
        if(answer!=null&&Objects.equals(answer.getNotebookJson(),data))return notebookDto(c,request.questionId,answer,null);
        preserveCurrent(answer);if(answer==null){answer=new SpeakingStudentAnswer();answer.setStudentId(c.student.getId());answer.setQuestionId(request.questionId);answer.setHtml("");answer.setNotesJson("[]");}
        answer.setNotebookJson(data);answer.setNotebookRevision(notebookRevision(answer)+1);answer.setEditorId(speaking.currentUser().getId());if(answer.getId()==null)em.persist(answer);em.flush();checkpoint(answer,"NOTEBOOK",true);return notebookDto(c,request.questionId,answer,null);
    }
    public Map<String,Object> restore(RestoreRequest request){
        if(request==null||request.revision==null||request.revision<0||request.versionRevision==null||request.versionRevision<1)throw new IllegalArgumentException("Thiếu phiên bản hiện tại hoặc phiên bản đã xem trước.");Context c=questionContext(request.setId,request.studentId,request.questionId);lockStudent(c);SpeakingStudentAnswer answer=find(c.student.getId(),request.questionId,true);
        SpeakingStudentAnswerVersion latest=latestVersion(answer);
        if(version(answer)!=request.revision&&latest!=null&&"RESTORE".equals(latest.getSource())&&Objects.equals(latest.getSourceVersionId(),request.versionId)&&Objects.equals(latest.getSourceVersionRevision(),request.versionRevision)&&snapshotMatches(latest,answer)){
            Map<String,Object> out=dto(c,request.questionId,answer);out.put("restoredVersionId",request.versionId);return out;
        }
        SpeakingStudentAnswerVersion selected=ownedVersion(answer,request.versionId);em.refresh(selected);
        if(!request.versionRevision.equals(selected.getAnswerRevision()))throw new Conflict();
        // Retried, already applied restores are safe even if their ACK was lost.
        boolean same=snapshotMatches(selected,answer);if(version(answer)!=request.revision&&!same)throw new Conflict();
        if(!same){String html=selected.getHtml(),noteData=selected.getNotesJson(),notebookData=selected.getNotebookJson();preserveCurrent(answer);
            answer.setHtml(html);answer.setNotesJson(noteData);if(!Objects.equals(answer.getNotebookJson(),notebookData))answer.setNotebookRevision(notebookRevision(answer)+1);answer.setNotebookJson(notebookData);answer.setEditorId(speaking.currentUser().getId());em.flush();SpeakingStudentAnswerVersion restored=checkpoint(answer,"RESTORE",false);restored.setSourceVersionId(request.versionId);restored.setSourceVersionRevision(request.versionRevision);em.flush();
        }
        Map<String,Object> out=dto(c,request.questionId,answer);out.put("restoredVersionId",request.versionId);return out;
    }
    private static void row(Sheet sheet,int index,Object...values){Row row=sheet.createRow(index);for(int col=0;col<values.length;col++)row.createCell(col).setCellValue(values[col]==null?"":String.valueOf(values[col]));}
    private User requireSelfImporter(Long suppliedStudentId){
        User actor=speaking.currentUser();
        if(!speaking.teacher(actor))throw new AccessDeniedException("Chỉ admin và giáo viên được import câu trả lời của chính mình.");
        if(suppliedStudentId!=null&&!actor.getId().equals(suppliedStudentId))throw new AccessDeniedException("Import bài của tôi chỉ áp dụng cho tài khoản đang đăng nhập.");
        return actor;
    }
    private Context classImportContext(Long setId,Long studentId){
        SpeakingSet set=speaking.readableSet(setId);User student=speaking.importableStudent(set,studentId);return context(setId,student.getId());
    }
    public byte[] classTemplate(Long setId,Long studentId)throws IOException{return templateForContext(classImportContext(setId,studentId));}
    public Map<String,Object> classPreview(Long setId,Long studentId,byte[] bytes)throws IOException{return previewForContext(classImportContext(setId,studentId),bytes);}
    public Map<String,Object> classConfirm(ImportRequest request){
        validateImport(request);return confirmForContext(request,classImportContext(request.setId,request.studentId));
    }
    public byte[] selfTemplate(Long setId,Long suppliedStudentId)throws IOException{
        User actor=requireSelfImporter(suppliedStudentId);return templateForContext(context(setId,actor.getId()));
    }
    public byte[] template(Long setId,Long studentId)throws IOException{
        speaking.requireAdmin();
        return templateForContext(context(setId,studentId));
    }
    private byte[] templateForContext(Context c)throws IOException{
        Long setId=c.setId;try(XSSFWorkbook book=new XSSFWorkbook();ByteArrayOutputStream out=new ByteArrayOutputStream()){
            Sheet guide=book.createSheet("HUONG_DAN");row(guide,0,"CÂU TRẢ LỜI SPEAKING RIÊNG CỦA HỌC SINH");row(guide,1,"1. File này thuộc đúng bộ và tài khoản ở THONG_TIN; không sửa mã bộ, mã học sinh hoặc mã câu.");row(guide,2,"2. Chỉ copy câu trả lời vào cột F của CAU_TRA_LOI. Có thể dùng đậm, nghiêng, gạch chân và xuống dòng.");row(guide,3,"3. Mỗi lần nhập tối đa 1.000 câu trả lời; ô trống được bỏ qua, không dùng để xóa bài đã lưu. Không nhập công thức.");row(guide,4,"4. Xem đối chiếu và chọn từng câu muốn nhập. Ghi chú cũ của câu được thay thế sẽ được gỡ; sample chung không đổi.");row(guide,5,"5. Sau import, học sinh và giáo viên có thể chỉnh sửa và gắn ghi chú trực tiếp trên website.");guide.setColumnWidth(0,120*256);
            Sheet info=book.createSheet("THONG_TIN");row(info,0,"SPEAKING_STUDENT_ANSWERS_V1");row(info,1,"Mã bộ đề",setId);row(info,2,"Mã học sinh",c.student.getId());row(info,3,"Tài khoản",c.student.getUsername());
            Sheet answers=book.createSheet("CAU_TRA_LOI");row(answers,0,"ID câu hỏi","Mã câu","Part","Topic / Tên bài","Câu hỏi","Câu trả lời");int index=1;
            CellStyle wrap=book.createCellStyle();wrap.setWrapText(true);wrap.setVerticalAlignment(VerticalAlignment.TOP);
            for(Map<String,Object> q:c.questions.values()){row(answers,index,q.get("questionId"),q.get("code"),q.get("part"),q.get("topic"),q.get("prompt"),"");for(Cell cell:answers.getRow(index)){cell.setCellStyle(wrap);}answers.getRow(index++).setHeightInPoints(56);}
            answers.createFreezePane(0,1);int[] widths={18,25,8,32,65,85};for(int col=0;col<widths.length;col++)answers.setColumnWidth(col,widths[col]*256);book.write(out);return out.toByteArray();
        }
    }
    private static String cell(Row row,int column){Cell c=row==null?null:row.getCell(column);if(c==null)return "";if(c.getCellTypeEnum()==CellType.FORMULA)throw new IllegalArgumentException("Không hỗ trợ ô công thức. Hãy dán giá trị văn bản.");return new DataFormatter(Locale.ROOT).formatCellValue(c).trim();}
    private static String richHtml(Cell cell){
        if(cell==null)return "";if(cell.getCellTypeEnum()==CellType.FORMULA)throw new IllegalArgumentException("Không hỗ trợ công thức trong câu trả lời.");
        if(cell.getCellTypeEnum()!=CellType.STRING)return escape(new DataFormatter(Locale.ROOT).formatCellValue(cell));
        RichTextString raw=cell.getRichStringCellValue();String text=raw.getString();if(text.length()>60000)throw new IllegalArgumentException("Câu trả lời Excel quá dài.");StringBuilder out=new StringBuilder();
        Font base=cell.getSheet().getWorkbook().getFontAt(cell.getCellStyle().getFontIndex());
        if(raw instanceof XSSFRichTextString&&raw.numFormattingRuns()>0){XSSFRichTextString rich=(XSSFRichTextString)raw;int first=rich.getIndexOfFormattingRun(0);if(first>0)formatted(out,text.substring(0,first),base);
            for(int run=0;run<rich.numFormattingRuns();run++){int start=rich.getIndexOfFormattingRun(run),end=run+1<rich.numFormattingRuns()?rich.getIndexOfFormattingRun(run+1):text.length();if(start<0||end<start||end>text.length())throw new IllegalArgumentException("Định dạng Excel không hợp lệ.");Font font=rich.getFontOfFormattingRun(run);formatted(out,text.substring(start,end),font==null?base:font);}
        }else formatted(out,text,base);return out.toString();
    }
    private static void formatted(StringBuilder out,String text,Font font){boolean bold=font!=null&&font.getBold(),italic=font!=null&&font.getItalic(),under=font!=null&&font.getUnderline()!=Font.U_NONE;if(bold)out.append("<strong>");if(italic)out.append("<em>");if(under)out.append("<u>");out.append(escape(text).replace("\r\n","\n").replace("\r","\n").replace("\n","<br>"));if(under)out.append("</u>");if(italic)out.append("</em>");if(bold)out.append("</strong>");}
    private static Long positiveId(String value){try{long id=Long.parseLong(value);if(id>0)return id;}catch(NumberFormatException ignored){}throw new IllegalArgumentException("Thiếu hoặc sai ID câu hỏi.");}
    public Map<String,Object> selfPreview(Long setId,Long suppliedStudentId,byte[] bytes)throws IOException{
        User actor=requireSelfImporter(suppliedStudentId);return previewForContext(context(setId,actor.getId()),bytes);
    }
    public Map<String,Object> preview(Long setId,Long studentId,byte[] bytes)throws IOException{
        speaking.requireAdmin();
        return previewForContext(context(setId,studentId),bytes);
    }
    private Map<String,Object> previewForContext(Context c,byte[] bytes)throws IOException{
        Long setId=c.setId;if(bytes==null||bytes.length==0||bytes.length>8L*1024*1024)throw new IllegalArgumentException("Chọn file .xlsx nhỏ hơn 8 MB.");
        List<Map<String,Object>> rows=new ArrayList<Map<String,Object>>();Map<Long,Map<String,Object>> previous=new HashMap<Long,Map<String,Object>>();Map<Long,SpeakingStudentAnswer> saved=new HashMap<Long,SpeakingStudentAnswer>();for(SpeakingStudentAnswer a:savedForSet(c))saved.put(a.getQuestionId(),a);
        try(XSSFWorkbook book=new XSSFWorkbook(new ByteArrayInputStream(bytes))){
            Sheet info=book.getSheet("THONG_TIN"),sheet=book.getSheet("CAU_TRA_LOI");
            if(info==null||sheet==null||!"SPEAKING_STUDENT_ANSWERS_V1".equals(cell(info.getRow(0),0))||!String.valueOf(setId).equals(cell(info.getRow(1),1))||!String.valueOf(c.student.getId()).equals(cell(info.getRow(2),1))||!c.student.getUsername().equals(cell(info.getRow(3),1)))throw new IllegalArgumentException("File không thuộc đúng bộ đề và học sinh đang chọn. Hãy tải mẫu đúng học sinh.");
            if(sheet.getLastRowNum()>10000)throw new IllegalArgumentException("File vượt 10.000 dòng. Hãy dùng đúng mẫu câu trả lời Speaking.");int populated=0;
            for(int index=1;index<=sheet.getLastRowNum();index++){
                Row source=sheet.getRow(index);if(source==null)continue;Cell answerCell=source.getCell(5);if(answerCell==null||answerCell.getCellTypeEnum()!=CellType.FORMULA&&cell(source,5).isEmpty())continue;if(++populated>MAX_ROWS)throw new IllegalArgumentException("Mỗi lần nhập tối đa 1.000 câu trả lời; các ô trống không tính.");
                Long id=null;String html="",error=null;Map<String,Object> question=null;SpeakingStudentAnswer old=null;
                try{id=positiveId(cell(source,0));requireQuestion(c,id);question=c.questions.get(id);if(previous.containsKey(id)){previous.get(id).put("status","INVALID");previous.get(id).put("error","Câu hỏi bị lặp trong file.");throw new IllegalArgumentException("Câu hỏi bị lặp trong file.");}if(!Objects.equals(String.valueOf(question.get("code")),cell(source,1)))throw new IllegalArgumentException("Mã câu không khớp ID câu hỏi.");html=sanitizeHtml(richHtml(answerCell));old=saved.get(id);}catch(IllegalArgumentException|AccessDeniedException invalid){error=invalid.getMessage();}
                String oldHtml=old==null||old.getHtml()==null?"":old.getHtml();String status=error!=null?"INVALID":old==null?"NEW":oldHtml.equals(html)?"UNCHANGED":"CHANGED";
                Map<String,Object> preview=SpeakingServiceImpl.map("rowId","CAU_TRA_LOI:"+(index+1),"questionId",id,"code",question==null?cell(source,1):question.get("code"),"part",question==null?null:question.get("part"),"topic",question==null?null:question.get("topic"),"prompt",question==null?null:question.get("prompt"),"html",html,"oldHtml",oldHtml,"notes",new ArrayList<Note>(),"revision",version(old),"status",status,"error",error);rows.add(preview);if(id!=null&&!previous.containsKey(id))previous.put(id,preview);
            }
        }catch(IllegalArgumentException error){throw error;}catch(RuntimeException invalid){throw new IllegalArgumentException("Không đọc được file Excel. Hãy dùng mẫu .xlsx câu trả lời Speaking.");}
        return SpeakingServiceImpl.map("setId",setId,"studentId",c.student.getId(),"rows",rows);
    }
    public Map<String,Object> confirm(ImportRequest request){
        speaking.requireAdmin();
        validateImport(request);return confirmForContext(request,context(request.setId,request.studentId));
    }
    public Map<String,Object> selfConfirm(ImportRequest request){
        User actor=requireSelfImporter(request==null?null:request.studentId);
        validateImport(request);return confirmForContext(request,context(request.setId,actor.getId()));
    }
    private void validateImport(ImportRequest request){
        if(request==null||request.rows==null||request.rows.isEmpty()||request.rows.size()>MAX_ROWS)throw new IllegalArgumentException("Chọn từ 1 đến 1.000 câu muốn nhập.");
    }
    private Map<String,Object> confirmForContext(ImportRequest request,Context c){
        Set<Long> seen=new HashSet<Long>();List<CleanHtml> contents=new ArrayList<CleanHtml>();List<List<Note>> noteLists=new ArrayList<List<Note>>();
        for(WriteRequest row:request.rows){if(row==null)throw new IllegalArgumentException("Dòng import không hợp lệ.");requireQuestion(c,row.questionId);if(!seen.add(row.questionId))throw new IllegalArgumentException("Không nhập trùng câu hỏi.");if(row.setId!=null&&!row.setId.equals(request.setId)||row.studentId!=null&&!row.studentId.equals(c.student.getId()))throw new IllegalArgumentException("Dòng import thuộc học sinh hoặc bộ đề khác.");CleanHtml html=clean(row.html);contents.add(html);noteLists.add(validateNotes(row.notes,html.markers));}
        lockStudent(c);List<SpeakingStudentAnswer> old=new ArrayList<SpeakingStudentAnswer>();
        for(int i=0;i<request.rows.size();i++){WriteRequest row=request.rows.get(i);SpeakingStudentAnswer answer=find(c.student.getId(),row.questionId,true);if(row.revision==null||row.revision<0)throw new IllegalArgumentException("Thiếu phiên bản câu trả lời.");if(version(answer)!=row.revision.longValue()&&(answer==null||!Objects.equals(answer.getHtml(),contents.get(i).html)||!Objects.equals(answer.getNotesJson(),encode(noteLists.get(i)))))throw new Conflict();old.add(answer);}
        List<SpeakingStudentAnswer> saved=new ArrayList<SpeakingStudentAnswer>();for(int i=0;i<request.rows.size();i++)saved.add(write(c,request.rows.get(i),old.get(i),contents.get(i),noteLists.get(i),"IMPORT"));em.flush();List<Map<String,Object>> answers=new ArrayList<Map<String,Object>>();for(SpeakingStudentAnswer answer:saved)answers.add(dto(c,answer.getQuestionId(),answer));
        return SpeakingServiceImpl.map("setId",c.setId,"studentId",c.student.getId(),"saved",saved.size(),"answers",answers);
    }
}
