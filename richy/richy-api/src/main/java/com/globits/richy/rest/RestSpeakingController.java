package com.globits.richy.rest;

import com.globits.richy.domain.SpeakingRecording;
import com.globits.richy.dto.SpeakingDto.*;
import com.globits.richy.service.impl.SpeakingServiceImpl;
import com.globits.richy.service.impl.SpeakingRecordingService;
import java.io.*;
import java.util.*;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/speaking")
@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_VIEWER","ROLE_STUDENT","ROLE_EDUCATION_MANAGERMENT","ROLE_STUDENT_MANAGERMENT"})
public class RestSpeakingController {
    @Autowired private SpeakingServiceImpl service;
    @Autowired private SpeakingRecordingService recording;
    @RequestMapping(value="/bootstrap",method=RequestMethod.GET)
    public Map<String,Object> bootstrap(){return service.bootstrap();}
    @RequestMapping(value="/sets",method=RequestMethod.POST)
    public Map<String,Object> createSet(@RequestBody SetRequest request){return service.createSet(request);}
    @RequestMapping(value="/sets/{id}",method=RequestMethod.GET)
    public Map<String,Object> bank(@PathVariable Long id,@RequestParam(value="studentId",required=false)Long studentId){return service.bank(id,studentId);}
    @RequestMapping(value="/sets/{id}/students",method=RequestMethod.GET)
    public List<Map<String,Object>> students(@PathVariable Long id,@RequestParam(value="q",defaultValue="")String q){return service.students(id,q);}
    @RequestMapping(value="/sets/{id}/share",method=RequestMethod.POST)
    public Map<String,Object> share(@PathVariable Long id,@RequestBody SetRequest request){return service.share(id,request);}
    @RequestMapping(value="/sets/{id}/import/preview",method=RequestMethod.POST)
    public Map<String,Object> preview(@PathVariable Long id,@RequestParam("file")MultipartFile file)throws IOException{
        if(file==null||file.isEmpty()||file.getSize()>8L*1024*1024)throw new IllegalArgumentException("File Excel phải nhỏ hơn 8 MB.");
        return service.preview(id,file.getBytes());
    }
    @RequestMapping(value="/sets/{id}/import/confirm",method=RequestMethod.POST)
    public Map<String,Object> confirm(@PathVariable Long id,@RequestBody ConfirmImport request){return service.confirm(id,request);}
    @RequestMapping(value="/sets/{id}/pass",method=RequestMethod.POST)
    public Map<String,Object> pass(@PathVariable Long id,@RequestBody PassRequest request){return service.markPass(id,request);}
    @RequestMapping(value="/practice",method=RequestMethod.POST)
    public Map<String,Object> start(@RequestBody PracticeRequest request){return service.startPractice(request);}
    @RequestMapping(value="/practice/{id}",method=RequestMethod.GET)
    public Map<String,Object> practice(@PathVariable Long id){return service.getPractice(id);}
    @RequestMapping(value="/practice/{id}/progress",method=RequestMethod.POST)
    public Map<String,Object> progress(@PathVariable Long id,@RequestBody PracticeProgress request){return service.progress(id,request);}
    @RequestMapping(value="/history",method=RequestMethod.GET)
    public List<Map<String,Object>> history(@RequestParam(value="setId",required=false)Long setId,@RequestParam(value="studentId",required=false)Long studentId){return service.history(setId,studentId);}
    @RequestMapping(value="/practice/{id}/recordings",method=RequestMethod.POST)
    public Map<String,Object> initRecording(@PathVariable Long id,@RequestBody RecordingRequest request){return recording.create(id,request);}
    @RequestMapping(value="/recordings/{id}/chunks/{index}",method=RequestMethod.POST,consumes="application/octet-stream")
    public Map<String,Object> chunk(@PathVariable Long id,@PathVariable int index,@RequestBody byte[] bytes)throws IOException{return recording.chunk(id,index,bytes);}
    @RequestMapping(value="/recordings/{id}/finish",method=RequestMethod.POST)
    public Map<String,Object> finish(@PathVariable Long id,@RequestBody RecordingFinish request)throws IOException{return recording.finish(id,request);}
    @RequestMapping(value="/recordings/{id}/audio",method=RequestMethod.GET)
    public ResponseEntity<FileSystemResource> audio(@PathVariable Long id)throws IOException{
        SpeakingRecording r=recording.readable(id);File file=recording.file(id);HttpHeaders headers=new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(r.getContentType()));headers.setContentLength(file.length());
        headers.set("Cache-Control","private, no-store");headers.set("X-Content-Type-Options","nosniff");
        headers.set("Content-Disposition","inline; filename=\"speaking-"+r.getId()+("audio/mp4".equals(r.getContentType())?".m4a":"audio/ogg".equals(r.getContentType())?".ogg":".webm")+"\"");
        return new ResponseEntity<FileSystemResource>(new FileSystemResource(file),headers,HttpStatus.OK);
    }
    private static void row(Sheet sheet,int index,Object... values){Row row=sheet.createRow(index);for(int i=0;i<values.length;i++){Cell cell=row.createCell(i);if(values[i] instanceof Number)cell.setCellValue(((Number)values[i]).doubleValue());else cell.setCellValue(values[i]==null?"":String.valueOf(values[i]));}}
    @RequestMapping(value="/sets/{id}/export",method=RequestMethod.GET)
    public ResponseEntity<byte[]> export(@PathVariable Long id)throws IOException{
        Map<String,Object> bank=service.exportSet(id);@SuppressWarnings("unchecked")Map<String,Object> set=(Map<String,Object>)bank.get("set");
        @SuppressWarnings("unchecked")List<Map<String,Object>> questions=(List<Map<String,Object>>)bank.get("questions");
        try(Workbook workbook=new XSSFWorkbook();ByteArrayOutputStream out=new ByteArrayOutputStream()){
            Sheet info=workbook.createSheet("THONG_TIN");row(info,0,"Bộ Speaking đã xuất");row(info,3,"Năm",set.get("year"));row(info,4,"Bộ",set.get("number"));
            Sheet p1=workbook.createSheet("PART_1"),p2=workbook.createSheet("PART_2"),p3=workbook.createSheet("PART_3");
            row(p1,0,"Topic *","Câu hỏi *","Sample","Mã câu (tuỳ chọn)","Ghi chú");row(p2,0,"Tên bài *","Cue card *","Sample","Mã bài (tuỳ chọn)","Ghi chú");
            row(p3,0,"Nhóm Part 3 *","Tên/mã Part 2 liên kết","Câu hỏi *","Sample","Mã câu (tuỳ chọn)","Ghi chú");
            Map<Long,String> part2Codes=new HashMap<Long,String>();for(Map<String,Object> q:questions)if(Integer.valueOf(2).equals(q.get("part")))part2Codes.put(((Number)q.get("id")).longValue(),String.valueOf(q.get("code")));
            int[] next={1,1,1};for(Map<String,Object> q:questions){int part=((Number)q.get("part")).intValue();if(part==3)row(p3,next[2]++,q.get("topic"),part2Codes.get(q.get("linkedPart2Id")),q.get("prompt"),q.get("sample"),q.get("code"),"");
                else row(part==1?p1:p2,next[part-1]++,q.get("topic"),q.get("prompt"),q.get("sample"),q.get("code"),"");}
            for(Sheet sheet:Arrays.asList(p1,p2,p3)){sheet.createFreezePane(0,1);for(int col=0;col<6;col++)sheet.setColumnWidth(col,(col==2||col==3?60:28)*256);}
            workbook.write(out);HttpHeaders headers=new HttpHeaders();headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
            headers.set("Content-Disposition","attachment; filename=\"speaking-"+set.get("year")+"-bo-"+set.get("number")+".xlsx\"");return new ResponseEntity<byte[]>(out.toByteArray(),headers,HttpStatus.OK);
        }
    }
    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String,Object> invalid(IllegalArgumentException error){return SpeakingServiceImpl.map("message",error.getMessage());}
    @ExceptionHandler(AccessDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public Map<String,Object> denied(AccessDeniedException error){return SpeakingServiceImpl.map("message",error.getMessage());}
    @ExceptionHandler(DataIntegrityViolationException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String,Object> conflict(){return SpeakingServiceImpl.map("message","Dữ liệu vừa được cập nhật ở nơi khác. Hãy tải lại và đối chiếu trước khi thử lại.");}
    @ExceptionHandler(IOException.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public Map<String,Object> fileError(IOException error){org.slf4j.LoggerFactory.getLogger(getClass()).warn("Speaking file operation failed",error);return SpeakingServiceImpl.map("message","Chưa đọc hoặc lưu được dữ liệu Speaking. Vui lòng thử lại.");}
}
