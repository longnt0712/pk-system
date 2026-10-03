package com.globits.richy.service.impl;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import javax.persistence.*;
import org.joda.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.annotation.Secured;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.ResponseStatus;
import com.globits.core.domain.Person;
import com.globits.security.domain.User;
import com.globits.security.repository.UserRepository;
import com.globits.richy.domain.*;
import com.globits.richy.dto.*;
import com.globits.richy.repository.*;

@Service
@Transactional
public class CampaignFlowerService {
    @Autowired private UserRepository users;
    @Autowired private EnrolmentClassRepository classes;
    @Autowired private CampaignRepository campaigns;
    @Autowired private CampaignFlowerAccessRepository accessRepository;
    @Autowired private CampaignFlowerEntryRepository entries;
    @PersistenceContext private EntityManager entityManager;
    private static LocalDate today() { return LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")); }

    @Secured({"ROLE_ADMIN", "ROLE_EDUCATION_MANAGERMENT", "ROLE_STUDENT_MANAGERMENT"})
    public CampaignFlowerDto.Access issue(String studentCode) {
        return issueAccess(findStudent(studentCode));
    }

    // Existing printed student cards contain the student code rather than a URL.
    public CampaignFlowerDto.Access scan(String studentCode) {
        return issueAccess(findStudent(studentCode));
    }

    private User findStudent(String studentCode) {
        String code = studentCode == null ? "" : studentCode.trim();
        if (code.isEmpty() || code.length() > 100 || code.chars().anyMatch(Character::isISOControl) || code.contains("://")) { throw new InvalidStudentQrException(); }
        User student = users.findByUsernameAndPerson(code);
        requireParticipant(student); return student;
    }

    private CampaignFlowerDto.Access issueAccess(User student) {
        // Serialize first-time issuance as well as redisplaying an existing card.
        entityManager.lock(student, LockModeType.PESSIMISTIC_WRITE);
        CampaignFlowerAccess access = accessRepository.findByStudentId(student.getId());
        if (access == null) {
            access = new CampaignFlowerAccess(); access.setStudent(student);
            String token = StudentMarkShareSupport.newToken();
            access.setToken(token); access.setTokenHash(StudentMarkShareSupport.hashToken(token));
            access.setCreatedBy("student-qr"); access.setCreateDate(LocalDateTime.now());
            access = accessRepository.saveAndFlush(access);
        }
        CampaignFlowerDto.Access dto = new CampaignFlowerDto.Access();
        dto.token = access.getToken(); dto.student = profile(student); return dto;
    }

    @Secured({"ROLE_ADMIN", "ROLE_EDUCATION_MANAGERMENT", "ROLE_STUDENT_MANAGERMENT"})
    @Transactional(readOnly = true)
    public String resolveForAttendance(String token) { return access(token, false).getStudent().getUsername(); }

    @Transactional(readOnly = true)
    public CampaignFlowerDto.Landing landing(String token) {
        CampaignFlowerDto.Landing dto = new CampaignFlowerDto.Landing();
        dto.serverTime = System.currentTimeMillis();
        dto.student = profile(access(token, false).getStudent());
        for (Campaign campaign : campaigns.activeCampaigns(today().toString())) { dto.campaigns.add(new CampaignDto(campaign, false)); }
        return dto;
    }

    @Transactional(readOnly = true)
    public CampaignFlowerDto.Sheet sheet(String token, Long campaignId, int week) {
        User student = access(token, false).getStudent(); Campaign campaign = campaign(campaignId);
        LocalDate start = LocalDate.parse(campaign.getStartDate()), end = LocalDate.parse(campaign.getEndDate());
        long count = (ChronoUnit.DAYS.between(start, end) + 7) / 7;
        if (week < 0 || week >= count) { throw new CampaignService.InvalidCampaignException("Tuần hoa thiêng không hợp lệ."); }
        LocalDate first = start.plusDays(week * 7L), last = first.plusDays(6);
        if (last.isAfter(end)) { last = end; }
        CampaignFlowerDto.Sheet dto = new CampaignFlowerDto.Sheet();
        dto.serverTime = System.currentTimeMillis();
        dto.student = profile(student); dto.campaign = new CampaignDto(campaign, true);
        for (CampaignFlowerEntry entry : entries.findByCampaignIdAndStudentIdAndDateBetween(campaignId, student.getId(), first.toString(), last.toString())) {
            dto.entries.add(entryDto(entry));
        }
        return dto;
    }

    public CampaignFlowerDto.Entry check(String token, Long campaignId, String date, String itemKey, Boolean completed) {
        User student = access(token, true).getStudent(); Campaign campaign = campaign(campaignId);
        LocalDate day;
        try {
            if (date == null || !date.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")) { throw new IllegalArgumentException(); }
            day = LocalDate.parse(date);
        } catch (RuntimeException error) { throw new CampaignService.InvalidCampaignException("Ngày hoa thiêng không hợp lệ."); }
        if (completed == null || day.isBefore(LocalDate.parse(campaign.getStartDate())) || day.isAfter(LocalDate.parse(campaign.getEndDate())) || !day.equals(today())) {
            throw new CampaignService.InvalidCampaignException("Chỉ tích hoặc bỏ tích hoa thiêng cho ngày hôm nay. Các ngày khác chỉ được xem.");
        }
        boolean found = false;
        for (int i = 0; i < campaign.getFlowerItems().size(); i++) {
            if (CampaignDto.itemKey(campaign, campaign.getFlowerItems().get(i), i).equals(itemKey)) { found = true; break; }
        }
        if (!found) { throw new CampaignService.InvalidCampaignException("Việc hoa thiêng không còn thuộc chiến dịch. Vui lòng tải lại phiếu."); }
        CampaignFlowerEntry entry = entries.findByCampaignIdAndStudentIdAndDateAndItemKey(campaignId, student.getId(), date, itemKey);
        if (entry == null) {
            entry = new CampaignFlowerEntry(); entry.setCampaignId(campaignId); entry.setStudentId(student.getId());
            entry.setDate(date); entry.setItemKey(itemKey); entry.setCreatedBy(student.getUsername()); entry.setCreateDate(LocalDateTime.now());
        }
        entry.setCompleted(completed); entry.setModifiedBy(student.getUsername()); entry.setModifyDate(LocalDateTime.now());
        entries.saveAndFlush(entry);
        // Removing a check also removes excess paint; colors never create completion credit.
        reconcilePaint(campaign, dayEntries(campaign, student, date));
        return entryDto(entry);
    }

    private static final Set<String> PALETTE = new HashSet<>(Arrays.asList(
            "#F48FB1", "#EF5350", "#FFB74D", "#FFE082", "#B39DDB", "#81D4FA", "#80CBC4"));

    @Transactional(readOnly = true)
    public CampaignFlowerDto.Garden garden(String token, Long campaignId) {
        return gardenDto(campaign(campaignId), access(token, false).getStudent());
    }

    public CampaignFlowerDto.Garden paint(String token, Long campaignId, String date, String itemKey, String color) {
        // The access row serializes checks, paint and reset for this participant across devices.
        User student = access(token, true).getStudent(); Campaign campaign = campaign(campaignId);
        LocalDate day;
        try { day = LocalDate.parse(date); }
        catch (RuntimeException error) { throw new CampaignService.InvalidCampaignException("Ngày tô hoa không hợp lệ."); }
        if (!day.toString().equals(date) || day.isAfter(today()) || date.compareTo(campaign.getStartDate()) < 0 || date.compareTo(campaign.getEndDate()) > 0) {
            throw new CampaignService.InvalidCampaignException("Em chỉ tô hoa cho ngày đã đến trong chiến dịch.");
        }
        if (!itemKeys(campaign).contains(itemKey)) { throw new CampaignService.InvalidCampaignException("Cánh hoa đã thay đổi. Vui lòng mở lại vườn hoa."); }
        String selected = color == null ? "" : color.toUpperCase(Locale.ROOT);
        if (!PALETTE.contains(selected)) { throw new CampaignService.InvalidCampaignException("Hãy chọn một màu trong bảng màu."); }
        List<CampaignFlowerEntry> values = dayEntries(campaign, student, date);
        reconcilePaint(campaign, values);
        Set<String> keys = itemKeys(campaign);
        long earned = values.stream().filter(e -> keys.contains(e.getItemKey()) && e.isCompleted()).count();
        long used = values.stream().filter(e -> keys.contains(e.getItemKey()) && e.getPaintColor() != null).count();
        CampaignFlowerEntry target = entries.findByCampaignIdAndStudentIdAndDateAndItemKey(campaignId, student.getId(), date, itemKey);
        if ((target == null || target.getPaintColor() == null) && used >= earned) {
            throw new CampaignService.InvalidCampaignException("Em đã dùng hết lượt tô của ngày này. Hãy tích thêm việc em đã thực hiện.");
        }
        if (target == null) {
            target = new CampaignFlowerEntry(); target.setCampaignId(campaignId); target.setStudentId(student.getId());
            target.setDate(date); target.setItemKey(itemKey); target.setCreatedBy(student.getUsername()); target.setCreateDate(LocalDateTime.now());
        }
        target.setPaintColor(selected); target.setModifiedBy(student.getUsername()); target.setModifyDate(LocalDateTime.now());
        entries.saveAndFlush(target);
        return gardenDto(campaign, student);
    }

    public CampaignFlowerDto.Garden resetPaint(String token, Long campaignId) {
        User student = access(token, true).getStudent(); Campaign campaign = campaign(campaignId);
        for (CampaignFlowerEntry value : allEntries(campaign, student)) {
            if (value.getPaintColor() != null) {
                value.setPaintColor(null); value.setModifiedBy(student.getUsername()); value.setModifyDate(LocalDateTime.now()); entries.save(value);
            }
        }
        entries.flush();
        return gardenDto(campaign, student);
    }

    public CampaignFlowerDto.Garden erasePetal(String token, Long campaignId, String date, String itemKey) {
        User student = access(token, true).getStudent(); Campaign campaign = campaign(campaignId);
        LocalDate day;
        try { day = LocalDate.parse(date); }
        catch (RuntimeException error) { throw new CampaignService.InvalidCampaignException("Ngày xóa màu hoa không hợp lệ."); }
        if (!day.toString().equals(date) || day.isAfter(today()) || date.compareTo(campaign.getStartDate()) < 0 || date.compareTo(campaign.getEndDate()) > 0) {
            throw new CampaignService.InvalidCampaignException("Em chỉ xóa màu bông hoa của ngày đã đến trong chiến dịch.");
        }
        if (!itemKeys(campaign).contains(itemKey)) { throw new CampaignService.InvalidCampaignException("Cánh hoa đã thay đổi. Vui lòng mở lại vườn hoa."); }
        CampaignFlowerEntry value = entries.findByCampaignIdAndStudentIdAndDateAndItemKey(campaignId, student.getId(), date, itemKey);
        if (value != null && value.getPaintColor() != null) {
            value.setPaintColor(null); value.setModifiedBy(student.getUsername()); value.setModifyDate(LocalDateTime.now()); entries.saveAndFlush(value);
        }
        return gardenDto(campaign, student);
    }

    private Set<String> itemKeys(Campaign campaign) {
        Set<String> keys = new HashSet<>();
        for (int i = 0; i < campaign.getFlowerItems().size(); i++) { keys.add(CampaignDto.itemKey(campaign, campaign.getFlowerItems().get(i), i)); }
        return keys;
    }
    private List<CampaignFlowerEntry> allEntries(Campaign campaign, User student) {
        return entries.findByCampaignIdAndStudentIdAndDateBetween(campaign.getId(), student.getId(), campaign.getStartDate(), campaign.getEndDate());
    }
    private List<CampaignFlowerEntry> dayEntries(Campaign campaign, User student, String date) {
        return entries.findByCampaignIdAndStudentIdAndDateBetween(campaign.getId(), student.getId(), date, date);
    }
    private static List<CampaignFlowerEntry> paintOrder(List<CampaignFlowerEntry> values) {
        List<CampaignFlowerEntry> result = new ArrayList<>(values);
        result.sort(Comparator.comparing(CampaignFlowerEntry::getDate)
                .thenComparing(e -> !e.isCompleted()).thenComparing(CampaignFlowerEntry::getItemKey));
        return result;
    }
    private void reconcilePaint(Campaign campaign, List<CampaignFlowerEntry> values) {
        Set<String> keys = itemKeys(campaign);
        long remaining = values.stream().filter(e -> keys.contains(e.getItemKey()) && e.isCompleted()).count();
        for (CampaignFlowerEntry value : paintOrder(values)) {
            if (value.getPaintColor() == null) { continue; }
            if (!keys.contains(value.getItemKey()) || !PALETTE.contains(value.getPaintColor()) || remaining-- <= 0) {
                value.setPaintColor(null); entries.save(value);
            }
        }
    }
    private CampaignFlowerDto.Garden gardenDto(Campaign campaign, User student) {
        CampaignFlowerDto.Garden dto = new CampaignFlowerDto.Garden(); dto.serverTime = System.currentTimeMillis(); dto.campaign = new CampaignDto(campaign, true);
        Set<String> keys = itemKeys(campaign); List<CampaignFlowerEntry> values = paintOrder(allEntries(campaign, student));
        Map<String, Integer> credit = new HashMap<>();
        for (CampaignFlowerEntry value : values) {
            if (keys.contains(value.getItemKey()) && value.isCompleted()) { credit.put(value.getDate(), credit.getOrDefault(value.getDate(), 0) + 1); }
        }
        // Ignore retired items and cap display after an administrator removes a practice.
        for (CampaignFlowerEntry value : values) {
            if (!keys.contains(value.getItemKey())) { continue; }
            CampaignFlowerDto.Entry entry = entryDto(value); int remaining = credit.getOrDefault(value.getDate(), 0);
            if (entry.paintColor != null && PALETTE.contains(entry.paintColor) && remaining > 0) { credit.put(value.getDate(), remaining - 1); }
            else { entry.paintColor = null; }
            dto.entries.add(entry);
        }
        return dto;
    }

    private CampaignFlowerAccess access(String token, boolean write) {
        if (!StudentMarkShareSupport.validToken(token)) { throw new InvalidStudentQrException(); }
        String hash = StudentMarkShareSupport.hashToken(token);
        CampaignFlowerAccess access = write ? accessRepository.lockByTokenHash(hash) : accessRepository.findByTokenHash(hash);
        if (access == null) { throw new InvalidStudentQrException(); }
        requireParticipant(access.getStudent()); return access;
    }
    // Participation follows the code in the student directory, independent of account roles.
    private static void requireParticipant(User student) {
        if (student == null || student.getUsername() == null || student.getUsername().trim().isEmpty() ||
                !student.isEnabled() || !student.isAccountNonLocked() || !student.isAccountNonExpired()) { throw new InvalidStudentQrException(); }
    }
    private Campaign campaign(Long id) {
        Campaign value = id == null || id < 1 ? null : campaigns.findOne(id);
        if (value == null) { throw new CampaignService.CampaignNotFoundException(); } return value;
    }
    private CampaignFlowerDto.Student profile(User student) {
        CampaignFlowerDto.Student dto = new CampaignFlowerDto.Student(); dto.studentCode = student.getUsername();
        Person person = student.getPerson();
        dto.saintName = person == null ? "" : clean(person.getPatron());
        dto.fullName = person == null ? student.getUsername() : (clean(person.getLastName()) + " " + clean(person.getFirstName())).trim();
        if (dto.fullName.isEmpty()) { dto.fullName = person == null ? student.getUsername() : clean(person.getDisplayName()); }
        Set<Long> ids = new TreeSet<>(student.getEnrollmentClassIds());
        if (person != null && person.getEnrollmentClassId() != null && person.getEnrollmentClassId() > 0) { ids.add(person.getEnrollmentClassId().longValue()); }
        for (Long id : ids) {
            EnrolmentClass enrollment = classes.findOne(id);
            if (enrollment != null && (enrollment.getSchoolId() == null || enrollment.getSchoolId() == 2)) { dto.classes.add(clean(enrollment.getName())); }
        }
        return dto;
    }
    private static String clean(String value) { return value == null ? "" : value.trim(); }
    private static CampaignFlowerDto.Entry entryDto(CampaignFlowerEntry value) {
        CampaignFlowerDto.Entry dto = new CampaignFlowerDto.Entry();
        dto.date = value.getDate(); dto.itemKey = value.getItemKey(); dto.completed = value.isCompleted(); dto.paintColor = value.getPaintColor(); return dto;
    }
    @ResponseStatus(value = HttpStatus.NOT_FOUND, reason = "Mã QR học sinh không hợp lệ hoặc tài khoản đã ngừng hoạt động.")
    public static class InvalidStudentQrException extends RuntimeException { }
}
