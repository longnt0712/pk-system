package com.globits.core.service;

import com.globits.core.domain.Reward;
import com.globits.core.dto.RewardDto;

public interface RewardService extends GenericService<Reward, Long> {
	RewardDto checkDuplicateCode(String code);
}