package com.globits.richy.dto;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

public class BattleOnlinePetSelectionDto implements Serializable {
    private static final long serialVersionUID = 1L;

    private String petKey;
    private String selectedPetKey;
    private int vocabularyExperienceLevel;
    private List<String> unlockedPetKeys = new ArrayList<String>();

    public String getPetKey() {
        return petKey;
    }

    public void setPetKey(String petKey) {
        this.petKey = petKey;
    }

    public String getSelectedPetKey() {
        return selectedPetKey;
    }

    public void setSelectedPetKey(String selectedPetKey) {
        this.selectedPetKey = selectedPetKey;
    }

    public int getVocabularyExperienceLevel() {
        return vocabularyExperienceLevel;
    }

    public void setVocabularyExperienceLevel(int vocabularyExperienceLevel) {
        this.vocabularyExperienceLevel = vocabularyExperienceLevel;
    }

    public List<String> getUnlockedPetKeys() {
        return unlockedPetKeys;
    }

    public void setUnlockedPetKeys(List<String> unlockedPetKeys) {
        this.unlockedPetKeys = unlockedPetKeys == null
                ? new ArrayList<String>() : unlockedPetKeys;
    }
}
