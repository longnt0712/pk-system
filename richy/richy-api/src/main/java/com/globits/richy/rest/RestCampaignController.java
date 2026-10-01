package com.globits.richy.rest;

import java.util.Collections;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.*;
import com.globits.richy.dto.CampaignDto;
import com.globits.richy.service.impl.CampaignService;

@RestController
@RequestMapping("/api/campaigns")
@Secured("ROLE_EDUCATION_MANAGERMENT")
public class RestCampaignController {
    @Autowired private CampaignService service;

    @RequestMapping(method = RequestMethod.POST)
    @ResponseStatus(HttpStatus.CREATED)
    public CampaignDto create(@RequestBody CampaignDto dto) { return service.create(dto); }
    @RequestMapping(value = "/{id}", method = RequestMethod.PUT)
    public CampaignDto update(@PathVariable("id") Long id, @RequestBody CampaignDto dto) { return service.update(id, dto); }
    @RequestMapping(value = "/{id}", method = RequestMethod.DELETE)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable("id") Long id) { service.delete(id); }

    @ExceptionHandler(CampaignService.InvalidCampaignException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> invalid(CampaignService.InvalidCampaignException error) {
        return Collections.singletonMap("message", error.getMessage());
    }
    @ExceptionHandler(org.springframework.orm.ObjectOptimisticLockingFailureException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Map<String, String> conflict() {
        return Collections.singletonMap("message", "Chiến dịch đã được cập nhật. Vui lòng tải lại trước khi sửa.");
    }
}
