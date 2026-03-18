package com.globits.richy.rest;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import com.globits.core.dto.OrganizationDto;
import com.globits.core.dto.PersonDto;
import com.globits.richy.dto.AnswerDto;
import com.globits.richy.dto.QuestionDto;
import com.globits.richy.service.AnswerService;
import com.globits.richy.service.QuestionService;

@RestController
@RequestMapping("/api/classical_learning")
public class RestClassicalLearningController {
	@Autowired
	QuestionService service;
	
	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/answer_question", method = RequestMethod.POST)
	public QuestionDto getPage(@RequestBody QuestionDto dto) {
		return service.answerQuestion(dto);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/answer_question_catechism", method = RequestMethod.POST)
	public QuestionDto getPageCatechism(@RequestBody QuestionDto dto) {
		return service.answerQuestionCatechism(dto);
	}
}
