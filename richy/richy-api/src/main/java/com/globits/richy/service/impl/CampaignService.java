package com.globits.richy.service.impl;

import java.time.LocalDate;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import java.util.HashSet;
import java.util.Set;
import java.util.Map;
import java.util.Collections;
import java.util.Arrays;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
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
import com.globits.richy.repository.CampaignFlowerEntryRepository;

@Service
@Transactional
public class CampaignService {
    @Autowired private CampaignRepository repository;
    @Autowired private CampaignFlowerEntryRepository entryRepository;

    @Transactional(readOnly = true)
    public Page<CampaignDto> list(String keyword, int page, int size) {
        if (page < 1 || size < 1 || size > 50 || page > 1000000) {
            throw new InvalidCampaignException("Trang không hợp lệ; số chiến dịch mỗi trang từ 1 đến 50.");
        }
        String search = text(keyword, 200, "Từ khóa").toLowerCase(Locale.ROOT);
        Pageable pageable = new PageRequest(page - 1, size, new Sort(Sort.Direction.DESC, "createDate", "id"));
        Page<Campaign> result = search.isEmpty() ? repository.findAll(pageable) : repository.search("%" + search + "%", pageable);
        return result.map(campaign -> new CampaignDto(campaign, false));
    }

    @Transactional(readOnly = true)
    public CampaignDto get(Long id) { return new CampaignDto(find(id), true); }

    @Transactional(readOnly = true)
    public CampaignDto getByShareCode(String code) {
        if (code == null || !code.matches("[a-f0-9]{32}")) { throw new CampaignNotFoundException(); }
        String uuid = code.substring(0, 8) + "-" + code.substring(8, 12) + "-" + code.substring(12, 16)
                + "-" + code.substring(16, 20) + "-" + code.substring(20);
        Campaign campaign = repository.findByUuidKey(UUID.fromString(uuid));
        if (campaign == null) { throw new CampaignNotFoundException(); }
        return new CampaignDto(campaign, true);
    }

    public void initializeShareKeys() {
        for (Campaign campaign : repository.missingShareKeys()) {
            campaign.setUuidKey(UUID.randomUUID());
            repository.saveAndFlush(campaign);
        }
    }

    @Secured({"ROLE_ADMIN", "ROLE_EDUCATION_MANAGERMENT"})
    public CampaignDto create(CampaignDto dto) {
        validate(dto);
        Campaign campaign = new Campaign();
        campaign.setUuidKey(UUID.randomUUID());
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
    public void delete(Long id) {
        Campaign campaign = find(id);
        entryRepository.deleteCampaignEntries(id);
        repository.delete(campaign);
    }

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
        campaign.setDesktopLeftImageUrl(imageUrl(dto.getDesktopLeftImageUrl()));
        campaign.setDesktopRightImageUrl(imageUrl(dto.getDesktopRightImageUrl()));
        campaign.setMobileImageUrl(imageUrl(dto.getMobileImageUrl()));
        campaign.setFlowerBackgroundOpacity(dto.getFlowerBackgroundOpacity());
        try { campaign.setImageCropSettings(new ObjectMapper().writeValueAsString(dto.getImageCrops() == null ? Collections.emptyMap() : dto.getImageCrops())); }
        catch (JsonProcessingException error) { throw new InvalidCampaignException("Không lưu được vị trí ảnh."); }
        Set<String> existingKeys = new HashSet<>(), usedKeys = new HashSet<>();
        for (int i = 0; i < campaign.getFlowerItems().size(); i++) {
            existingKeys.add(CampaignDto.itemKey(campaign, campaign.getFlowerItems().get(i), i));
        }
        campaign.getFlowerItems().clear();
        for (CampaignDto.FlowerItemDto item : dto.getFlowerItems()) {
            SpiritualFlowerItem practice = new SpiritualFlowerItem();
            String key = existingKeys.contains(item.getItemKey()) ? item.getItemKey() : UUID.randomUUID().toString();
            if (!usedKeys.add(key)) { throw new InvalidCampaignException("Các việc hoa thiêng không được trùng mã."); }
            practice.setItemKey(key);
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
        imageUrl(dto.getDesktopLeftImageUrl()); imageUrl(dto.getDesktopRightImageUrl()); imageUrl(dto.getMobileImageUrl());
        if (dto.getFlowerBackgroundOpacity() < 0 || dto.getFlowerBackgroundOpacity() > 100) {
            throw new InvalidCampaignException("Độ hiển thị ảnh nền phải từ 0 đến 100%.");
        }
        if (dto.getImageCrops() != null) {
            if (dto.getImageCrops().size() > 3) { throw new InvalidCampaignException("Chỉ chỉnh được ba ảnh của chiến dịch."); }
            for (Map.Entry<String, CampaignDto.ImageCropDto> entry : dto.getImageCrops().entrySet()) {
                CampaignDto.ImageCropDto crop = entry.getValue();
                if (!Arrays.asList("desktopLeftImageUrl", "desktopRightImageUrl", "mobileImageUrl").contains(entry.getKey()) || crop == null
                        || crop.getZoom() < 50 || crop.getZoom() > 300 || Math.abs((long) crop.getX()) > 100 || Math.abs((long) crop.getY()) > 100) {
                    throw new InvalidCampaignException("Vị trí ảnh không hợp lệ; zoom từ 50 đến 300%, dịch chuyển từ -100 đến 100%.");
                }
            }
        }
        for (CampaignDto.FlowerItemDto item : dto.getFlowerItems()) {
            if (item == null || text(item.getName(), 200, "Tên việc làm").isEmpty()) {
                throw new InvalidCampaignException("Vui lòng nhập tên cho từng việc hoa thiêng.");
            }
            text(item.getInstructions(), 2000, "Hướng dẫn việc làm");
        }
    }

    private static String imageUrl(String value) {
        String result = text(value, 2048, "Link ảnh");
        if (result.isEmpty()) { return null; }
        try {
            URI uri = new URI(result);
            if (("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null && uri.getUserInfo() == null) { return result; }
        } catch (URISyntaxException ignored) { }
        throw new InvalidCampaignException("Link ảnh cần là địa chỉ http:// hoặc https:// hợp lệ.");
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
