package com.globits.richy.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Enables the bounded Speaking-history cleanup even if no answer is opened again. */
@Configuration
@EnableScheduling
public class SpeakingAnswerHistorySchedulingConfiguration {
}
