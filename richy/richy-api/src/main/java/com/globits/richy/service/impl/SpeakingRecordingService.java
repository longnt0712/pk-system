package com.globits.richy.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.globits.richy.domain.SpeakingPractice;
import com.globits.richy.domain.SpeakingRecording;
import com.globits.richy.dto.SpeakingDto.RecordingRequest;
import com.globits.richy.dto.SpeakingDto.RecordingFinish;
import java.io.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.time.Clock;
import org.joda.time.LocalDateTime;
import com.globits.security.domain.User;
import java.util.*;
import javax.persistence.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(rollbackFor=IOException.class)
public class SpeakingRecordingService {
    @PersistenceContext private EntityManager em;
    @Autowired private SpeakingServiceImpl speaking;
    @Value("${speaking.storage.directory:}") private String storageDirectory;
    private final ObjectMapper json=new ObjectMapper();
    private Clock recordingClock=Clock.systemDefaultZone();
    private LocalDateTime now(){return SpeakingRecordingPolicy.now(recordingClock);}
    private static final long MAX_RECORDING=64L*1024*1024,MAX_PRACTICE=128L*1024*1024;
    private static final TypeReference<Map<String,Chunk>> MANIFEST=new TypeReference<Map<String,Chunk>>(){};
    public static class Chunk { public String sha256;public int bytes;public Chunk(){}public Chunk(String hash,int size){sha256=hash;bytes=size;} }
    private Map<String,Chunk> manifest(SpeakingRecording recording) throws IOException {
        return recording.getChunksJson()==null?new LinkedHashMap<String,Chunk>():json.readValue(recording.getChunksJson(),MANIFEST);
    }
    private Path directory(SpeakingRecording recording) throws IOException {
        return SpeakingRecordingFiles.directory(storageDirectory,recording,true);
    }
    public static String sha256(byte[] bytes) {
        try{MessageDigest digest=MessageDigest.getInstance("SHA-256");byte[] hashed=digest.digest(bytes);StringBuilder result=new StringBuilder();for(byte b:hashed)result.append(String.format(Locale.ROOT,"%02x",b&255));return result.toString();}
        catch(java.security.NoSuchAlgorithmException error){throw new IllegalStateException(error);}
    }
    private SpeakingRecording writable(Long id) {
        SpeakingRecording initial=id==null?null:em.find(SpeakingRecording.class,id);if(initial==null)throw new IllegalArgumentException("Không tìm thấy bản ghi âm.");
        SpeakingPractice practice=speaking.accessiblePractice(initial.getPracticeId(),true);
        if(!practice.getStudentId().equals(speaking.currentUser().getId()))throw new AccessDeniedException("Chỉ chủ bài được tải ghi âm lên.");
        SpeakingRecording locked=em.find(SpeakingRecording.class,id,LockModeType.PESSIMISTIC_WRITE);
        // The initial ownership lookup may predate another chunk's commit while
        // this request waited for the practice lock. Reload its latest manifest.
        em.refresh(locked,LockModeType.PESSIMISTIC_WRITE);
        SpeakingRecordingPolicy.requireAvailable(locked,now());return locked;
    }
    public Map<String,Object> create(Long practiceId,RecordingRequest request) {
        User actor=speaking.currentUser();
        // All practices and tabs of one student share this database lock. A practice
        // lock alone would permit parallel uploads to bypass the rolling quota.
        em.find(User.class,actor.getId(),LockModeType.PESSIMISTIC_WRITE);
        SpeakingPractice practice=speaking.accessiblePractice(practiceId,true);Long student=actor.getId();
        // A locally backed-up recording may arrive after the practice was finished offline.
        if(!student.equals(practice.getStudentId()))throw new AccessDeniedException("Chỉ chủ lượt luyện được gửi ghi âm.");
        if(request==null||request.uploadKey==null||!request.uploadKey.matches("[A-Za-z0-9_-]{8,80}"))throw new IllegalArgumentException("Mã ghi âm không hợp lệ.");
        String type=request.contentType==null?"":request.contentType.toLowerCase(Locale.ROOT).split(";",2)[0].trim();
        if(!Arrays.asList("audio/webm","audio/mp4","audio/ogg").contains(type))throw new IllegalArgumentException("Trình duyệt chưa hỗ trợ định dạng ghi âm phù hợp.");
        if(request.questionIndex==null||request.questionIndex<0||request.questionIndex>=speaking.practiceQuestionCount(practice))throw new IllegalArgumentException("Câu ghi âm không hợp lệ.");
        List<SpeakingRecording> prior=em.createQuery("select r from SpeakingRecording r where r.practiceId=:practice and r.uploadKey=:key",SpeakingRecording.class).setParameter("practice",practiceId).setParameter("key",request.uploadKey).getResultList();
        if(!prior.isEmpty()){SpeakingRecording r=prior.get(0);if(!type.equals(r.getContentType())||!request.questionIndex.equals(r.getQuestionIndex()))throw new IllegalArgumentException("Mã ghi âm đã dùng cho nội dung khác.");SpeakingRecordingPolicy.requireAvailable(r,now());return receipt(r,actor);}
        Map<String,Object> quota=speaking.recordingQuota(actor,now());
        if(!Boolean.TRUE.equals(quota.get("canRecord")))throw new SpeakingRecordingPolicy.Limit(quota);
        long count=em.createQuery("select count(r) from SpeakingRecording r where r.practiceId=:id",Long.class).setParameter("id",practiceId).getSingleResult();
        if(count>=64)throw new IllegalArgumentException("Một lượt luyện tối đa 64 bản ghi âm.");
        SpeakingRecording r=new SpeakingRecording();r.setPracticeId(practiceId);r.setStudentId(student);r.setUploadKey(request.uploadKey);r.setStorageKey(UUID.randomUUID().toString());r.setContentType(type);
        r.setQuestionIndex(request.questionIndex);r.setChunksJson("{}");r.setByteCount(0L);r.setComplete(false);em.persist(r);em.flush();return receipt(r,actor);
    }
    private Map<String,Object> receipt(SpeakingRecording recording,User actor){
        Map<String,Object> receipt=SpeakingServiceImpl.recordingDto(recording,now());
        receipt.put("recordingQuota",speaking.recordingQuota(actor,now()));return receipt;
    }
    public Map<String,Object> chunk(Long id,int index,byte[] bytes) throws IOException {
        if(index<0||index>=2048||bytes==null||bytes.length==0||bytes.length>512*1024)throw new IllegalArgumentException("Mỗi đoạn ghi âm tối đa 512 KB.");
        SpeakingRecording r=writable(id);Map<String,Chunk> chunks=manifest(r);String key=String.valueOf(index),hash=sha256(bytes);Chunk old=chunks.get(key);
        if(old!=null){if(!hash.equals(old.sha256)||bytes.length!=old.bytes)throw new IllegalArgumentException("Đoạn ghi âm đã được lưu với nội dung khác.");return SpeakingServiceImpl.map("saved",true,"index",index,"sha256",hash);}
        if(Boolean.TRUE.equals(r.getComplete()))throw new IllegalArgumentException("Bản ghi âm đã hoàn tất, không thể thêm đoạn.");
        long total=r.getByteCount()+bytes.length;if(total>MAX_RECORDING)throw new IllegalArgumentException("Một bản ghi âm tối đa 64 MB.");
        Long practiceBytes=em.createQuery("select sum(r.byteCount) from SpeakingRecording r where r.practiceId=:id",Long.class).setParameter("id",r.getPracticeId()).getSingleResult();
        if((practiceBytes==null?0:practiceBytes)+bytes.length>MAX_PRACTICE)throw new IllegalArgumentException("Một lượt luyện tối đa 128 MB ghi âm.");
        Path file=directory(r).resolve(index+".chunk");
        if(Files.exists(file)){if(Files.isSymbolicLink(file)||!hash.equals(sha256(Files.readAllBytes(file))))throw new IllegalArgumentException("Đoạn ghi âm cần được gửi lại với một mã bản ghi mới.");}
        else Files.write(file,bytes,StandardOpenOption.CREATE_NEW);
        chunks.put(key,new Chunk(hash,bytes.length));r.setChunksJson(json.writeValueAsString(chunks));r.setByteCount(total);em.flush();
        return SpeakingServiceImpl.map("saved",true,"index",index,"sha256",hash);
    }
    private static boolean signature(byte[] bytes,String type) {
        if(bytes.length<12)return false;
        if("audio/webm".equals(type))return(bytes[0]&255)==0x1a&&(bytes[1]&255)==0x45&&(bytes[2]&255)==0xdf&&(bytes[3]&255)==0xa3;
        if("audio/ogg".equals(type))return bytes[0]=='O'&&bytes[1]=='g'&&bytes[2]=='g'&&bytes[3]=='S';
        return bytes[4]=='f'&&bytes[5]=='t'&&bytes[6]=='y'&&bytes[7]=='p';
    }
    public Map<String,Object> finish(Long id,RecordingFinish request) throws IOException {
        SpeakingRecording r=writable(id);Map<String,Chunk> chunks=manifest(r);
        if(request==null||request.chunkCount==null||request.chunkCount<1||request.chunkCount>2048||chunks.size()!=request.chunkCount)throw new IllegalArgumentException("Ghi âm còn thiếu đoạn. Hãy thử đồng bộ lại.");
        for(int index=0;index<request.chunkCount;index++)if(!chunks.containsKey(String.valueOf(index)))throw new IllegalArgumentException("Ghi âm còn thiếu đoạn số "+index+".");
        if(Boolean.TRUE.equals(r.getComplete()))return SpeakingServiceImpl.recordingDto(r,now());
        Path folder=directory(r),target=folder.resolve("recording.audio"),temporary=folder.resolve("assemble-"+UUID.randomUUID()+".tmp");
        ByteArrayOutputStream initial=new ByteArrayOutputStream();long size=0;MessageDigest digest;
        try{digest=MessageDigest.getInstance("SHA-256");}catch(java.security.NoSuchAlgorithmException error){throw new IllegalStateException(error);}
        try(OutputStream output=Files.newOutputStream(temporary,StandardOpenOption.CREATE_NEW)){
            for(int index=0;index<request.chunkCount;index++){Path chunk=folder.resolve(index+".chunk");if(Files.isSymbolicLink(chunk))throw new AccessDeniedException("Đoạn ghi âm không hợp lệ.");byte[] bytes=Files.readAllBytes(chunk);Chunk expected=chunks.get(String.valueOf(index));
                if(bytes.length!=expected.bytes||!sha256(bytes).equals(expected.sha256))throw new IOException("Dữ liệu ghi âm không toàn vẹn.");
                if(initial.size()<16)initial.write(bytes,0,Math.min(bytes.length,16-initial.size()));output.write(bytes);digest.update(bytes);size+=bytes.length;}
        }catch(Exception error){Files.deleteIfExists(temporary);throw error;}
        if(size!=r.getByteCount()||!signature(initial.toByteArray(),r.getContentType())){Files.deleteIfExists(temporary);throw new IllegalArgumentException("Bản ghi âm chưa đúng định dạng hoặc thiếu dữ liệu.");}
        try{Files.move(temporary,target,StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);}catch(AtomicMoveNotSupportedException error){Files.move(temporary,target,StandardCopyOption.REPLACE_EXISTING);}
        StringBuilder hash=new StringBuilder();for(byte b:digest.digest())hash.append(String.format(Locale.ROOT,"%02x",b&255));r.setSha256(hash.toString());r.setComplete(true);em.flush();
        return SpeakingServiceImpl.recordingDto(r,now());
    }
    public SpeakingRecording readable(Long id) {
        SpeakingRecording r=id==null?null:em.find(SpeakingRecording.class,id);if(r==null)throw new IllegalArgumentException("Không tìm thấy bản ghi âm.");speaking.accessiblePractice(r.getPracticeId(),false);SpeakingRecordingPolicy.requireAvailable(r,now());return r;
    }
    public File file(Long id) throws IOException {
        SpeakingRecording r=readable(id);if(!Boolean.TRUE.equals(r.getComplete()))throw new IllegalArgumentException("Bản ghi âm chưa được đồng bộ đủ.");
        Path file=directory(r).resolve("recording.audio");if(!Files.isRegularFile(file)||Files.isSymbolicLink(file))throw new IOException("Chưa đọc được bản ghi âm đã lưu.");return file.toFile();
    }

    @Transactional(readOnly=true)
    public List<Long> expiredRecordingIds() {
        return em.createQuery("select r.id from SpeakingRecording r where r.createDate<=:cutoff and "
                + "(r.chunksJson is not null or r.byteCount>0 or r.complete=true or r.sha256 is not null) order by r.createDate,r.id",Long.class)
            .setParameter("cutoff",now().minusDays(SpeakingRecordingPolicy.RETENTION_DAYS)).setMaxResults(1000).getResultList();
    }

    public boolean purgeExpiredRecording(Long id) throws IOException {
        SpeakingRecording initial=em.find(SpeakingRecording.class,id);
        if(initial==null)return false;
        // Match upload lock order. Never remove files while a chunk/finalization
        // transaction holds this practice and recording.
        em.find(SpeakingPractice.class,initial.getPracticeId(),LockModeType.PESSIMISTIC_WRITE);
        SpeakingRecording recording=em.find(SpeakingRecording.class,id,LockModeType.PESSIMISTIC_WRITE);
        if(recording==null)return false;
        em.refresh(recording,LockModeType.PESSIMISTIC_WRITE);
        if(!SpeakingRecordingPolicy.expired(recording,now()))return false;
        if(recording.getChunksJson()==null&&Long.valueOf(0).equals(recording.getByteCount())
                &&!Boolean.TRUE.equals(recording.getComplete())&&recording.getSha256()==null)return false;
        SpeakingRecordingFiles.delete(storageDirectory,recording);
        // Retain the upload identity as a tombstone: an old offline retry must not
        // recreate the audio or consume a new slot after its retention period.
        recording.setChunksJson(null);recording.setByteCount(0L);recording.setComplete(false);recording.setSha256(null);
        em.flush();return true;
    }

}
