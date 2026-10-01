package com.globits.richy.service.impl;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import org.joda.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.annotation.Secured;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.ResponseStatus;
import com.globits.richy.domain.Campaign;
import com.globits.richy.domain.SpiritualFlowerItem;
import com.globits.richy.dto.CampaignDto;
import com.globits.richy.repository.CampaignRepository;

@Service
@Transactional
public class CampaignService {
    @Autowired private CampaignRepository repository;

    @Transactional(readOnly = true)
    public Page<CampaignDto> list(String keyword, int page, int size) {
        if (page < 1 || size < 1 || size > 50 || page > 1000000) {
            throw new InvalidCampaignException("Trang không hợp lệ; số chiến dịch mỗi trang từ 1 đến 50.");
        }
        String search = text(keyword, 200, "Từ khóa").toLowerCase(Locale.ROOT);
        Pageable pageable = new PageRequest(page - 1, size, new Sort(Sort.Direction.DESC, "startDate", "id"));
        Page<Campaign> result = search.isEmpty() ? repository.findAll(pageable) : repository.search("%" + search + "%", pageable);
        return result.map(campaign -> new CampaignDto(campaign, false));
    }

    @Transactional(readOnly = true)
    public CampaignDto get(Long id) { return new CampaignDto(find(id), true); }

    @Secured({"ROLE_ADMIN", "ROLE_EDUCATION_MANAGERMENT"})
    public CampaignDto create(CampaignDto dto) {
        validate(dto);
        Campaign campaign = new Campaign();
        campaign.setCreatedBy(SecurityContextHolder.getContext().getAuthentication().getName());
        campaign.setCreateDate(LocalDateTime.now());
        copy(dto, campaign);
        return new CampaignDto(repository.saveAndFlush(campaign), true);
    }

    @Secured({"ROLE_ADMIN", "ROLE_EDUCATION_MANAGERMENT"})
    public CampaignDto update(Long id, CampaignDto dto) {
        validate(dto);
        Campaign campaign = find(id);
        if (dto.getVersion() == null || !dto.getVersion().equals(campaign.getVersion())) {
            throw new CampaignConflictException();
        }
        copy(dto, campaign);
        campaign.setModifiedBy(SecurityContextHolder.getContext().getAuthentication().getName());
        campaign.setModifyDate(LocalDateTime.now());
        return new CampaignDto(repository.saveAndFlush(campaign), true);
    }

    @Secured({"ROLE_ADMIN", "ROLE_EDUCATION_MANAGERMENT"})
    public void delete(Long id) { repository.delete(find(id)); }

    private Campaign find(Long id) {
        Campaign campaign = id == null || id < 1 ? null : repository.findOne(id);
        if (campaign == null) { throw new CampaignNotFoundException(); }
        return campaign;
    }

    private static void copy(CampaignDto dto, Campaign campaign) {
        campaign.setName(dto.getName().trim()); campaign.setTheme(text(dto.getTheme(), 300, "Chủ đề"));
        campaign.setDescription(text(dto.getDescription(), 20000, "Nội dung"));
        campaign.setStartDate(dto.getStartDate()); campaign.setEndDate(dto.getEndDate());
        campaign.setFlowerInstructions(text(dto.getFlowerInstructions(), 10000, "Hướng dẫn hoa thiêng"));
        campaign.getFlowerItems().clear();
        for (CampaignDto.FlowerItemDto item : dto.getFlowerItems()) {
            SpiritualFlowerItem practice = new SpiritualFlowerItem();
            practice.setName(item.getName().trim());
            practice.setInstructions(text(item.getInstructions(), 2000, "Hướng dẫn việc làm"));
            campaign.getFlowerItems().add(practice);
        }
    }

    private static void validate(CampaignDto dto) {
        if (dto == null || text(dto.getName(), 200, "Tên chiến dịch").isEmpty()) {
            throw new InvalidCampaignException("Vui lòng nhập tên chiến dịch.");
        }
        LocalDate start = date(dto.getStartDate()), end = date(dto.getEndDate());
        if (end.isBefore(start)) { throw new InvalidCampaignException("Ngày kết thúc phải từ ngày bắt đầu trở đi."); }
        if (dto.getFlowerItems() == null || dto.getFlowerItems().isEmpty() || dto.getFlowerItems().size() > 30) {
            throw new InvalidCampaignException("Hoa thiêng cần có từ 1 đến 30 việc làm.");
        }
        text(dto.getTheme(), 300, "Chủ đề"); text(dto.getDescription(), 20000, "Nội dung");
        text(dto.getFlowerInstructions(), 10000, "Hướng dẫn hoa thiêng");
        for (CampaignDto.FlowerItemDto item : dto.getFlowerItems()) {
            if (item == null || text(item.getName(), 200, "Tên việc làm").isEmpty()) {
                throw new InvalidCampaignException("Vui lòng nhập tên cho từng việc hoa thiêng.");
            }
            text(item.getInstructions(), 2000, "Hướng dẫn việc làm");
        }
    }

    private static LocalDate date(String value) {
        try {
            if (value == null || !value.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")) { throw new DateTimeParseException("date", "", 0); }
            LocalDate result = LocalDate.parse(value);
            if (result.getYear() < 1) { throw new DateTimeParseException("date", value, 0); }
            return result;
        } catch (DateTimeParseException e) { throw new InvalidCampaignException("Vui lòng nhập ngày hợp lệ theo định dạng năm-tháng-ngày."); }
    }
    private static String text(String value, int max, String label) {
        String result = value == null ? "" : value.trim();
        if (result.length() > max) { throw new InvalidCampaignException(label + " vượt quá " + max + " ký tự."); }
        return result;
    }

    @ResponseStatus(value = HttpStatus.BAD_REQUEST)
    public static class InvalidCampaignException extends RuntimeException {
        public InvalidCampaignException(String message) { super(message); }
    }
    @ResponseStatus(value = HttpStatus.NOT_FOUND, reason = "Không tìm thấy chiến dịch.")
    public static class CampaignNotFoundException extends RuntimeException { }
    @ResponseStatus(value = HttpStatus.CONFLICT, reason = "Chiến dịch đã được cập nhật. Vui lòng tải lại trước khi sửa.")
    public static class CampaignConflictException extends RuntimeException { }
}
