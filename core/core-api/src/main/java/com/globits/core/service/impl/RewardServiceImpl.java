package com.globits.core.service.impl;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.globits.core.domain.Department;
import com.globits.core.domain.Reward;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.dto.RewardDto;
import com.globits.core.repository.RewardRepository;
import com.globits.core.service.RewardService;

@Transactional
@Service
public class RewardServiceImpl extends GenericServiceImpl<Reward, Long> implements RewardService {

	@Autowired
	RewardRepository rewardRepository;
	
	@Override
	public RewardDto checkDuplicateCode(String code) {
		RewardDto viewCheckDuplicateCodeDto = new RewardDto();
		Reward reward = null;
		List<Reward> list = rewardRepository.findByCode(code);
		if(list != null && list.size() > 0) {
			reward = list.get(0);
		}
		if(list == null) {
			viewCheckDuplicateCodeDto.setDuplicate(false);
		}else if(list != null && list.size() > 0) {
			viewCheckDuplicateCodeDto.setDuplicate(true);
			viewCheckDuplicateCodeDto.setDupCode(reward.getCode());
			viewCheckDuplicateCodeDto.setDupName(reward.getName());
		}
		return viewCheckDuplicateCodeDto;
	}
}
