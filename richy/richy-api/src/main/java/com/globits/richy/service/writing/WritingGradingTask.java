package com.globits.richy.service.writing;

import java.util.ArrayList;
import java.util.List;

public class WritingGradingTask {
    private int part;
    private String prompt;
    private String answer;
    private List<String> imageUrls = new ArrayList<String>();

    public int getPart() { return part; }
    public void setPart(int value) { part = value; }
    public String getPrompt() { return prompt; }
    public void setPrompt(String value) { prompt = value; }
    public String getAnswer() { return answer; }
    public void setAnswer(String value) { answer = value; }
    public List<String> getImageUrls() { return imageUrls; }
    public void setImageUrls(List<String> value) { imageUrls = value; }
}
