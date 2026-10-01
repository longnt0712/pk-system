package com.globits.richy.service.impl;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/** Backfills older campaigns once; existing share URLs stay stable across edits and restarts. */
@Component
public class CampaignShareKeysInitializer implements ApplicationRunner {
    @Autowired private CampaignService service;
    @Override public void run(ApplicationArguments args) { service.initializeShareKeys(); }
}
