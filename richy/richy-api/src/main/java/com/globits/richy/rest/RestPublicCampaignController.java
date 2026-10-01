package com.globits.richy.rest;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;
import com.globits.richy.dto.CampaignDto;
import com.globits.richy.service.impl.CampaignService;

/** Read-only public routes. All writes are under the protected /api/campaigns. */
@RestController
@RequestMapping("/public/campaigns")
public class RestPublicCampaignController {
    @Autowired private CampaignService service;

    @RequestMapping(method = RequestMethod.GET)
    public Page<CampaignDto> list(@RequestParam(value = "q", defaultValue = "") String keyword,
            @RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "size", defaultValue = "12") int size) {
        return service.list(keyword, page, size);
    }
    @RequestMapping(value = "/{id}", method = RequestMethod.GET)
    public CampaignDto get(@PathVariable("id") Long id) { return service.get(id); }
}
