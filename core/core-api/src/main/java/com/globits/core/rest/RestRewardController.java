package com.globits.core.rest;

import javax.persistence.EntityManager;
import javax.persistence.PersistenceContext;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import com.globits.core.domain.Reward;
import com.globits.core.dto.DepartmentDto;
import com.globits.core.dto.RewardDto;
import com.globits.core.service.RewardService;

@RestController
@RequestMapping("/api/reward")
public class RestRewardController {
	@PersistenceContext
	private EntityManager manager;
	@Autowired
	private RewardService rewardService;

	@RequestMapping(value = "/{pageIndex}/{pageSize}", method = RequestMethod.GET)
	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT" })
	public Page<Reward> getList(@PathVariable int pageIndex, @PathVariable int pageSize) {
		Page<Reward> page = rewardService.getList(pageIndex, pageSize);
		return page;
	}

	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT" , "ROLE_STUDENT"})
	@RequestMapping(value = "/{rewardId}", method = RequestMethod.GET)
	public Reward getReward(@PathVariable("rewardId") String rewardId) {
		Reward reward = rewardService.findById(new Long(rewardId));
		return reward;
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(method = RequestMethod.POST)
	public Reward saveReward(@RequestBody Reward reward) {
		return rewardService.save(reward);
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/{rewardId}", method = RequestMethod.PUT)
	public Reward updateReward(@RequestBody Reward Reward, @PathVariable("rewardId") Long RewardId) {
		return rewardService.save(Reward);
	}

	@Secured("ROLE_ADMIN")
	@RequestMapping(value = "/{rewardId}", method = RequestMethod.DELETE)
	public Reward removeReward(@PathVariable("rewardId") String rewardId) {
		Reward Reward = rewardService.delete(new Long(rewardId));
		return Reward;
	}
	
	@Secured({ "ROLE_ADMIN", "ROLE_USER","ROLE_STUDENT_MANAGERMENT", "ROLE_STUDENT" })
	@RequestMapping(value = "/checkCode/{code}",method = RequestMethod.GET)
	public RewardDto checkDuplicateCode(@PathVariable("code") String code) {
		return rewardService.checkDuplicateCode(code);
	}
}
