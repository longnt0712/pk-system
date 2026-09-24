package com.globits.richy.service.writing;

public class WritingGradingResult {
    private String provider;
    private String model;
    private Double overallBand;
    private String feedbackJson;

    public String getProvider() { return provider; }
    public void setProvider(String value) { provider = value; }
    public String getModel() { return model; }
    public void setModel(String value) { model = value; }
    public Double getOverallBand() { return overallBand; }
    public void setOverallBand(Double value) { overallBand = value; }
    public String getFeedbackJson() { return feedbackJson; }
    public void setFeedbackJson(String value) { feedbackJson = value; }
}
