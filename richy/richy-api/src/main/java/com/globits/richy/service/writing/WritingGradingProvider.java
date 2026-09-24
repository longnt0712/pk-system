package com.globits.richy.service.writing;

public interface WritingGradingProvider {
    String getProviderCode();
    String getModelName();
    boolean isConfigured();
    WritingGradingResult grade(WritingGradingRequest request) throws Exception;
}
