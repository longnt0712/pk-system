package com.globits.richy.dto;

import java.io.Serializable;

public class BattleOnlinePasswordChoiceDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private String optionKey;
    private String customPassword;

    public BattleOnlinePasswordChoiceDto() {
    }

    public String getOptionKey() {
        return optionKey;
    }

    public void setOptionKey(String optionKey) {
        this.optionKey = optionKey;
    }

    public String getCustomPassword() {
        return customPassword;
    }

    public void setCustomPassword(String customPassword) {
        this.customPassword = customPassword;
    }
}
