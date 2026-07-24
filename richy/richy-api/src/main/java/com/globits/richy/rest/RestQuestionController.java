package com.globits.richy.rest;

import java.util.List;
import java.util.Collections;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;

import com.globits.richy.dto.QuestionImportConfirmDto;
import com.globits.richy.dto.QuestionImportPreviewDto;
import com.globits.richy.dto.QuestionImportResultDto;
import com.globits.richy.service.QuestionExcelImportService;

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
import com.globits.richy.dto.QuestionDto;
import com.globits.richy.dto.QuestionForGamesDto;
import com.globits.richy.dto.QuestionForTestsDto;
import com.globits.richy.dto.QuestionOnlyQuestionDto;
import com.globits.richy.dto.QuestionUserDto;
import com.globits.richy.dto.QuizDto;
import com.globits.richy.service.AnswerService;
import com.globits.richy.service.QuestionExcelImportService;
import com.globits.richy.service.QuestionService;

@RestController
@RequestMapping("/api/question")
public class RestQuestionController {
	@Autowired
	QuestionService service;
	
	@Autowired
	QuestionExcelImportService questionExcelImportService;
	
	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_VIEWER"})
	@RequestMapping(value = "/get_page/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<QuestionDto> getPage(@RequestBody QuestionDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		return service.getPageObject(searchDto, pageIndex, pageSize);
	}
	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_VIEWER"})
	@RequestMapping(value = "/get_page_for_games/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<QuestionForGamesDto> getPageForGames(@RequestBody QuestionDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		return service.getPageObjectForGames(searchDto, pageIndex, pageSize);
	}
	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_VIEWER"})
	@RequestMapping(value = "/get_page_for_tests/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<QuestionForTestsDto> getPageForTests(@RequestBody QuestionDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		return service.getPageObjectForTests(searchDto, pageIndex, pageSize);
	}
	@Secured({"ROLE_ADMIN","ROLE_USER","ROLE_VIEWER"})
	@RequestMapping(value = "/get_one/{id}", method = RequestMethod.GET)
	public QuestionDto getOne(@PathVariable Long id) {
		return service.getObjectById(id);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/save", method = RequestMethod.POST)
	public QuestionDto saveOne(@RequestBody QuestionDto searchDto) {
		return service.saveObject(searchDto);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/delete/{id}", method = RequestMethod.DELETE)
	public boolean saveOne(@PathVariable Long id) {
		return service.deleteObject(id);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/get_random/{from}/{to}", method = RequestMethod.GET)
	public QuestionDto getRandom(@PathVariable int from,@PathVariable int to) {
		return service.getRandomObject(from, to);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/get_random_flash_card", method = RequestMethod.POST)
	public QuestionDto getRandomFlashCard(@RequestBody QuestionDto searchDto) {
		return service.getRandomFlashCard(searchDto);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/get_random_flash_card_quiz", method = RequestMethod.POST)
	public QuizDto getRandomFlashCardQuiz(@RequestBody QuizDto searchDto) {
		return service.getRandomFlashCardQuiz(searchDto);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/save_material", method = RequestMethod.POST)
	public QuestionDto saveMaterial(@RequestBody QuestionDto dto) {
		return service.saveMaterial(dto);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/get_statistic_question_user/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<QuestionUserDto> getStatisticQuestionUser(@RequestBody QuestionDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		return service.getStatisticQuestionUser(searchDto, pageIndex, pageSize);
	}
	
	@Secured({"ROLE_ADMIN","ROLE_USER"})
	@RequestMapping(value = "/get_page_only_question/{pageIndex}/{pageSize}", method = RequestMethod.POST)
	public Page<QuestionOnlyQuestionDto> getPageOnlyQuestion(@RequestBody QuestionDto searchDto, @PathVariable int pageIndex,@PathVariable int pageSize) {
		return service.getPageObjectOnlyQuestion(searchDto, pageIndex, pageSize);
	}
	
	@Secured({"ROLE_ADMIN", "ROLE_USER"})
	@RequestMapping(
	        value = "/import_excel/preview",
	        method = RequestMethod.POST,
	        consumes = MediaType.MULTIPART_FORM_DATA_VALUE
	)
	public ResponseEntity<?> previewExcelImport(
	        @RequestParam("file") MultipartFile file,
	        @RequestParam("topicId") Long topicId) {

	    try {
	        QuestionImportPreviewDto result =
	                questionExcelImportService.preview(
	                        file,
	                        topicId
	                );

	        return ResponseEntity.ok(result);

	    } catch (IllegalArgumentException e) {

	        Map<String, String> error =
	                Collections.singletonMap(
	                        "message",
	                        e.getMessage()
	                );

	        return ResponseEntity
	                .status(HttpStatus.BAD_REQUEST)
	                .body(error);

	    } catch (Exception e) {

	        Map<String, String> error =
	                Collections.singletonMap(
	                        "message",
	                        "Không thể đọc file Excel"
	                );

	        return ResponseEntity
	                .status(HttpStatus.INTERNAL_SERVER_ERROR)
	                .body(error);
	    }
	}

	@Secured({"ROLE_ADMIN", "ROLE_USER"})
	@RequestMapping(
	        value = "/import_excel/confirm",
	        method = RequestMethod.POST,
	        consumes = MediaType.APPLICATION_JSON_VALUE
	)
	public ResponseEntity<?> confirmExcelImport(
	        @RequestBody QuestionImportConfirmDto dto) {

	    try {
	        QuestionImportResultDto result =
	                questionExcelImportService.confirm(dto);

	        return ResponseEntity.ok(result);

	    } catch (IllegalArgumentException e) {

	        Map<String, String> error =
	                Collections.singletonMap(
	                        "message",
	                        e.getMessage()
	                );

	        return ResponseEntity
	                .status(HttpStatus.BAD_REQUEST)
	                .body(error);

	    } catch (Exception e) {

	        Map<String, String> error =
	                Collections.singletonMap(
	                        "message",
	                        "Import không thành công"
	                );

	        return ResponseEntity
	                .status(HttpStatus.INTERNAL_SERVER_ERROR)
	                .body(error);
	    }
	}
}
