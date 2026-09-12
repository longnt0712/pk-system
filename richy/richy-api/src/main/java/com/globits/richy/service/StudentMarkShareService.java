package com.globits.richy.service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Date;
import java.util.TimeZone;
import java.text.SimpleDateFormat;
import javax.servlet.http.HttpServletRequest;
import org.joda.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.ResponseStatus;
import com.globits.richy.domain.*;
import com.globits.richy.dto.*;
import com.globits.richy.repository.*;
import com.globits.richy.service.impl.StudentMarkShareSupport;
import com.globits.security.domain.Role;
import com.globits.security.domain.User;
import com.globits.security.dto.UserDto;
import com.globits.security.repository.UserRepository;

@Service
@Transactional
public class StudentMarkShareService {
    @Autowired StudentMarkShareRepository shareRepository;
    @Autowired EnrolmentClassRepository classRepository;
    @Autowired EducationProgramRepository programRepository;
    @Autowired MarkRepository markRepository;
    @Autowired UserRepository userRepository;
    @Autowired EnrolmentClassService classService;
    @Autowired StudentMarkService markService;

    public StudentMarkShareDto create(StudentMarkShareRequestDto request,HttpServletRequest http) {
        if(request==null)throw new IllegalArgumentException("Chọn lớp và chương trình trước khi tạo link.");
        User teacher=requireScope(request.getEnrollmentClass(),request.getEducationProgramId());
        String hostname=hostname(http),keyword=limited(request.getKeywordStudentName()),text=limited(request.getTextSearch());
        if(request.getGroupId()!=null&&request.getGroupId()<=0)throw new IllegalArgumentException("Ban/hội không hợp lệ.");
        String token=StudentMarkShareSupport.newToken();
        StudentMarkShare share=new StudentMarkShare();
        share.setTokenHash(StudentMarkShareSupport.hashToken(token));share.setHostname(hostname);
        share.setEnrollmentClass(request.getEnrollmentClass());share.setEducationProgramId(request.getEducationProgramId());
        share.setGroupId(request.getGroupId());share.setTextSearch(text);share.setKeywordStudentName(keyword);
        share.setOwnerUserId(teacher.getId());share.setCreateDate(LocalDateTime.now());share.setCreatedBy(teacher.getUsername());
        share=shareRepository.saveAndFlush(share);
        StudentMarkShareDto result=new StudentMarkShareDto(share);
        result.setRelativeUrl("/student_mark/shared.html#"+token);
        return result;
    }
    @Transactional(readOnly=true)
    public List<StudentMarkShareDto> list(Integer classId,Long programId,HttpServletRequest http) {
        requireScope(classId,programId);List<StudentMarkShareDto> result=new ArrayList<StudentMarkShareDto>();
        for(StudentMarkShare share:shareRepository.findTop50ByEnrollmentClassAndEducationProgramIdAndHostnameOrderByIdDesc(classId,programId,hostname(http)))result.add(new StudentMarkShareDto(share));
        return result;
    }
    public StudentMarkShareDto revoke(Long id,HttpServletRequest http) {
        StudentMarkShare share=id==null?null:shareRepository.findOne(id);
        if(share==null||!share.getHostname().equals(hostname(http)))throw new Unavailable();
        User teacher=requireScope(share.getEnrollmentClass(),share.getEducationProgramId());
        share.setRevoked(true);share.setModifyDate(LocalDateTime.now());share.setModifiedBy(teacher.getUsername());
        return new StudentMarkShareDto(shareRepository.saveAndFlush(share));
    }
    @Transactional(readOnly=true)
    public PublicStudentMarkTableDto read(String token,HttpServletRequest http) {
        if(!StudentMarkShareSupport.validToken(token))throw new Unavailable();
        StudentMarkShare share=shareRepository.findByTokenHash(StudentMarkShareSupport.hashToken(token));
        if(share==null||share.isRevoked()||!share.getHostname().equals(hostname(http)))throw new Unavailable();
        EnrolmentClass selectedClass=classRepository.findOne(share.getEnrollmentClass().longValue());
        EducationProgram program=programRepository.findOne(share.getEducationProgramId());
        if(selectedClass==null||program==null)throw new Unavailable();
        DisplayStudentMarkDto scope=new DisplayStudentMarkDto();
        scope.setEnrollmentClass(share.getEnrollmentClass());scope.setEducationProgramId(share.getEducationProgramId());
        scope.setGroupId(share.getGroupId());scope.setTextSearch(share.getTextSearch());
        // Anonymous query parameters cannot change the saved class/program/group scope.
        PublicStudentMarkTableDto table=new PublicStudentMarkTableDto();
        table.setClassName(selectedClass.getName());table.setProgramName(program.getName());
        table.setFilterDescription(new StudentMarkShareDto(share).getDescription());
        List<Mark> columns=markRepository.findMarkBy(share.getEducationProgramId());
        if(columns==null)columns=Collections.emptyList();
        for(Mark column:columns)table.getColumns().add(new PublicStudentMarkTableDto.Column(column.getName(),column.getCoefficient()));
        String keyword=StudentMarkShareSupport.normalizeSearch(share.getKeywordStudentName());
        for(DisplayStudentMarkDto student:markService.getListDisplayStudentMark(scope)) {
            UserDto user=student.getUser();if(user==null)continue;
            if(!keyword.isEmpty()&&user.getPerson()==null)continue;
            String patron=user.getPerson()==null?"":safe(user.getPerson().getPatron());
            String last=user.getPerson()==null?"":safe(user.getPerson().getLastName());
            String first=user.getPerson()==null?"":safe(user.getPerson().getFirstName());
            String name=(patron+" "+last+" "+first).replaceAll("\\s+"," ").trim(),username=safe(user.getUsername());
            if(!StudentMarkShareSupport.normalizeSearch(name+" "+username).contains(keyword))continue;
            String birthDate=user.getPerson()==null?"":formatBirthDate(user.getPerson().getBirthDate());
            PublicStudentMarkTableDto.Row row=new PublicStudentMarkTableDto.Row(name,birthDate,StudentMarkShareSupport.nameSortKey(last,first));
            for(Mark column:columns) {
                Double value=null;
                for(StudentMarkDto mark:student.getStudentMarks()) {
                    if(mark.getMark()!=null&&column.getId().equals(mark.getMark().getId())){value=mark.getMarkNumber();break;}
                }
                row.getMarks().add(value);
            }
            table.getRows().add(row);
        }
        table.getRows().sort(Comparator.comparing(PublicStudentMarkTableDto.Row::getSortKey));
        return table;
    }
    private User requireScope(Integer classId,Long programId) {
        Authentication authentication=SecurityContextHolder.getContext().getAuthentication();
        if(authentication==null||!authentication.isAuthenticated()||authentication instanceof org.springframework.security.authentication.AnonymousAuthenticationToken)
            throw new AccessDeniedException("Cần đăng nhập để chia sẻ bảng điểm.");
        User teacher=authentication==null?null:userRepository.findByUsername(authentication.getName());
        boolean allowed=false;
        if(teacher!=null&&teacher.getRoles()!=null)for(Role role:teacher.getRoles()) {
            if(role!=null&&java.util.Arrays.asList("ROLE_ADMIN","ROLE_EDUCATION_MANAGERMENT","ROLE_STUDENT_MANAGERMENT").contains(role.getName()))allowed=true;
        }
        if(!allowed)throw new AccessDeniedException("Chỉ giáo viên/quản lý được chia sẻ bảng điểm.");
        if(classId==null||classId<=0||programId==null||programId<=0)throw new IllegalArgumentException("Chọn lớp và chương trình hợp lệ trước khi chia sẻ.");
        EnrolmentClassDto selected=classService.getObjectById(classId.longValue());
        if(selected==null||!selected.isCanEdit())throw new AccessDeniedException("Bạn không có quyền chia sẻ bảng điểm lớp này.");
        if(programRepository.findOne(programId)==null)throw new IllegalArgumentException("Chương trình không còn tồn tại.");
        return teacher;
    }
    private String hostname(HttpServletRequest request) {
        String host=request.getServerName()==null?"":request.getServerName().toLowerCase(Locale.ROOT);
        if(host.startsWith("www."))host=host.substring(4);
        if(!"tnttphungkhoang.com".equals(host)&&!"ieltsroom.com".equals(host))throw new Unavailable();
        return host;
    }
    private String limited(String value){if(value==null||value.trim().isEmpty())return null;if(value.length()>200)throw new IllegalArgumentException("Nội dung lọc tối đa 200 ký tự.");return value.trim();}
    private String safe(String value){return value==null?"":value;}
    private String formatBirthDate(Date value) {
        if(value==null)return "";
        SimpleDateFormat format=new SimpleDateFormat("dd/MM/yyyy",Locale.ROOT);
        format.setTimeZone(TimeZone.getTimeZone("Asia/Ho_Chi_Minh"));
        return format.format(value);
    }
    @ResponseStatus(value=HttpStatus.NOT_FOUND,reason="Link không tồn tại hoặc đã được thu hồi.")
    public static class Unavailable extends RuntimeException {private static final long serialVersionUID=1L;}
}
