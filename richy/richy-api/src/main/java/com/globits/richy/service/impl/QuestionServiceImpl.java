package com.globits.richy.service.impl;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

import javax.persistence.EntityManager;
import javax.persistence.Query;

import org.joda.time.LocalDateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import com.globits.richy.test;
import com.globits.richy.domain.Answer;
import com.globits.richy.domain.CategoryQuestion;
import com.globits.richy.domain.Question;
import com.globits.richy.domain.QuestionAnswer;
import com.globits.richy.domain.QuestionTopic;
import com.globits.richy.domain.QuestionType;
import com.globits.richy.dto.QuestionAnswerDto;
import com.globits.richy.dto.QuestionDto;
import com.globits.richy.dto.QuestionForGamesDto;
import com.globits.richy.dto.QuestionForTestsDto;
import com.globits.richy.dto.QuestionOnlyQuestionDto;
import com.globits.richy.dto.QuestionTopicDto;
import com.globits.richy.dto.QuestionTypeDto;
import com.globits.richy.dto.QuestionUserDto;
import com.globits.richy.dto.QuizDto;
import com.globits.richy.dto.ShoesSizesDto;
import com.globits.richy.dto.TopicDto;
import com.globits.richy.dto.ShoesDto.sortByImageOrdinalNumber;
import com.globits.richy.repository.AnswerRepository;
import com.globits.richy.repository.CategoryQuestionRepository;
import com.globits.richy.repository.CategoryRepository;
import com.globits.richy.repository.QuestionAnswerRepository;
import com.globits.richy.repository.QuestionRepository;
import com.globits.richy.repository.QuestionTopicRepository;
import com.globits.richy.repository.QuestionTypeRepository;
import com.globits.richy.repository.TopicRepository;
import com.globits.richy.service.CategoryQuestionService;
import com.globits.richy.service.QuestionService;
import com.globits.security.domain.User;
import com.globits.security.dto.UserDto;
import com.globits.security.repository.UserRepository;

@Service
public class QuestionServiceImpl implements QuestionService {
	@Autowired
	EntityManager manager;
	@Autowired
	CategoryQuestionRepository categoryQuestionRepository;
	@Autowired
	CategoryRepository categoryRepository;
	@Autowired
	QuestionRepository questionRepository;
	@Autowired
	QuestionTypeRepository questionTypeRepository;
	@Autowired
	QuestionAnswerRepository questionAnswerRepository;
	@Autowired
	QuestionTopicRepository questionTopicRepository;
	@Autowired
	AnswerRepository answerRepository;
	@Autowired
	TopicRepository topicRepository;
	@Autowired
	UserRepository userRepository;

	@Override
	public Page<QuestionDto> getPageObject(QuestionDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.QuestionDto(s) from Question s where (1=1) ";
		String sqlCount = "select count(s.id) from Question s where (1=1) ";
		String whereClause = "";
		
		if(searchDto.getUserId() != null) {
			whereClause += " and s.user.id = :userId ";
		}
		List<Long> ids = new ArrayList<Long>();
		
		if(searchDto.getQuestionTopics() != null && searchDto.getQuestionTopics().size() > 0) {
			List<Long> topicIds = new ArrayList<Long>();
			for (QuestionTopicDto dto : searchDto.getQuestionTopics()) {
				if(dto != null && dto.getTopic() != null && dto.getTopic().getId() != null) {
					topicIds.add(dto.getTopic().getId());
				}	
			}
			if(topicIds != null && topicIds.size() > 0) {
				ids = questionTopicRepository.getListIdQuestionByListIdTopic(topicIds);
				
				if(ids != null && ids.size() > 0) {
					whereClause += " and (s.id in :ids) ";
				} else {
					return null;
				}
				
			}
			
		}
		
		QuestionType questionType = null;
		if(searchDto.getQuestionType() != null && searchDto.getQuestionType().getId() !=null) {
			questionType = questionTypeRepository.getOne(searchDto.getQuestionType().getId());
			if(questionType != null && questionType.getId() != null) {
				whereClause += " and (s.questionType.id =:questionTypeId) ";
			}
		}
		
		if (searchDto.getStatus() == 4) {
			whereClause += "and (s.status = 4) ";
		} else if(searchDto.getStatus() == 5) {
			whereClause += "and (s.status = 5) ";
		} else {
			whereClause += "and (s.status != 5) "; //bỏ listening
		}
		
		if(searchDto.getWebsite() != null) {
			whereClause += " and (s.website = :website) ";
		}
		
		
		if (textSearch != null && textSearch.length() > 0) {
			if(searchDto.isFindExactWord()) {
				whereClause += " and (s.question = :textSearch ) ";	
			}else {
				whereClause += " and (s.question like :textSearch "
						+ " or s.author like :textSearch "
						+ " or s.motherTongue like :textSearch )";	
			}
		}
		
		whereClause += "and (s.timeReviewd >= :lower and s.timeReviewd <= :upper) ";

		sql += whereClause;
		sqlCount += whereClause;
		
		sql += " order by s.ordinalNumber, s.createDate DESC ";
		
		Query q = manager.createQuery(sql, QuestionDto.class);
		Query qCount = manager.createQuery(sqlCount);
		
		Long numberOfWords = (long) 0;
		if(searchDto.getUserId() != null) {
			String sqlCountAll = "select count(s.id) from Question s where (1=1)  and s.user.id = :userId  ";
			Query qCountAll = manager.createQuery(sqlCountAll);
			qCountAll.setParameter("userId", searchDto.getUserId());
			numberOfWords = (Long) qCountAll.getSingleResult();
		}

		if (textSearch != null && textSearch.length() > 0) {
			if(searchDto.isFindExactWord()) {
				q.setParameter("textSearch", textSearch );
				qCount.setParameter("textSearch", textSearch );
			}else {
				q.setParameter("textSearch", '%' + textSearch + '%');
				qCount.setParameter("textSearch", '%' + textSearch + '%');	
			}
			
		}
		
		
		if(ids != null && ids.size() > 0) {
			q.setParameter("ids", ids);
			qCount.setParameter("ids", ids);
		}
	
		if(questionType != null && questionType.getId() != null) {
			q.setParameter("questionTypeId", questionType.getId());
			qCount.setParameter("questionTypeId", questionType.getId());
		}
		
		q.setParameter("lower", searchDto.getLower());
		qCount.setParameter("lower", searchDto.getLower());
		
		q.setParameter("upper", searchDto.getUpper());
		qCount.setParameter("upper", searchDto.getUpper());
		
		if(searchDto.getUserId() != null) {
			q.setParameter("userId", searchDto.getUserId());
			qCount.setParameter("userId", searchDto.getUserId());
//			qCountAll.setParameter("userId", searchDto.getUserId());
		}
		
//		if (searchDto.getStatus() ) {
//			q.setParameter("status", searchDto.getStatus());
//			qCount.setParameter("status", searchDto.getStatus());
//		}
		
		if(searchDto.getWebsite() != null) {
			q.setParameter("website",searchDto.getWebsite());
			qCount.setParameter("website",searchDto.getWebsite());
		}
		
		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();
//		Long numberOfWords = (Long) qCountAll.getSingleResult();
		
//		List<QuestionDto> listQuestionDto = new ArrayList<QuestionDto>();
//		List<Question> listQuestion = q.getResultList();
//		
//		if(q.getResultList() != null && q.getResultList().size() > 0 ) {
//			for (Question domain : listQuestion) {
//				listQuestionDto.add(new QuestionDto(domain));
//			}
//		}
		
		List<QuestionDto> list = q.getResultList();
		
		if(list != null && list.size() > 0) {
			list.get(0).setNumberOfWords(numberOfWords);
		}
		
		for(QuestionDto dto : list) {
			searchDto.setId(dto.getId());
			List<QuestionDto> questions = getListRandomQuestion(searchDto);
			if(questions != null && questions.size() > 0) {
				for(QuestionDto randomQuestion : questions) {
					dto.getQuestions().add(randomQuestion);
				}
				
			}
			
		}
		

		Page<QuestionDto> page = new PageImpl<QuestionDto>(list, pageable, numberResult);
		return page;
	}
	
	@Override
	public Page<QuestionForGamesDto> getPageObjectForGames(QuestionDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.QuestionForGamesDto(s) from Question s where (1=1) ";
		String sqlCount = "select count(s.id) from Question s where (1=1) ";
		String whereClause = "";
		
		if(searchDto.getUserId() != null) {
			whereClause += " and s.user.id = :userId ";
		}
		List<Long> ids = new ArrayList<Long>();
		
		if(searchDto.getQuestionTopics() != null && searchDto.getQuestionTopics().size() > 0) {
			List<Long> topicIds = new ArrayList<Long>();
			for (QuestionTopicDto dto : searchDto.getQuestionTopics()) {
				if(dto != null && dto.getTopic() != null && dto.getTopic().getId() != null) {
					topicIds.add(dto.getTopic().getId());
				}	
			}
			if(topicIds != null && topicIds.size() > 0) {
				ids = questionTopicRepository.getListIdQuestionByListIdTopic(topicIds);
				
				if(ids != null && ids.size() > 0) {
					whereClause += " and (s.id in :ids) ";
				} else {
					return null;
				}
				
			}
			
		}
		
		QuestionType questionType = null;
		if(searchDto.getQuestionType() != null && searchDto.getQuestionType().getId() !=null) {
			questionType = questionTypeRepository.getOne(searchDto.getQuestionType().getId());
			if(questionType != null && questionType.getId() != null) {
				whereClause += " and (s.questionType.id =:questionTypeId) ";
			}
		}
		
		if (searchDto.getStatus() != 3) {
			whereClause += "and (s.status =:status) ";
		}
		
		if(searchDto.getWebsite() != null) {
			whereClause += " and (s.website = :website) ";
		}
		
		
		if (textSearch != null && textSearch.length() > 0) {
			if(searchDto.isFindExactWord()) {
				whereClause += " and (s.question = :textSearch ) ";	
			}else {
				whereClause += " and (s.question like :textSearch "
						+ " or s.author like :textSearch "
						+ " or s.motherTongue like :textSearch )";	
			}
		}
		
		whereClause += "and (s.timeReviewd >= :lower and s.timeReviewd <= :upper) ";

		sql += whereClause;
		sqlCount += whereClause;
		
		sql += " order by s.ordinalNumber, s.createDate DESC ";
		
		Query q = manager.createQuery(sql, QuestionForGamesDto.class);
		Query qCount = manager.createQuery(sqlCount);
		
		Long numberOfWords = (long) 0;
		if(searchDto.getUserId() != null) {
			String sqlCountAll = "select count(s.id) from Question s where (1=1)  and s.user.id = :userId  ";
			Query qCountAll = manager.createQuery(sqlCountAll);
			qCountAll.setParameter("userId", searchDto.getUserId());
			numberOfWords = (Long) qCountAll.getSingleResult();
		}

		if (textSearch != null && textSearch.length() > 0) {
			if(searchDto.isFindExactWord()) {
				q.setParameter("textSearch", textSearch );
				qCount.setParameter("textSearch", textSearch );
			}else {
				q.setParameter("textSearch", '%' + textSearch + '%');
				qCount.setParameter("textSearch", '%' + textSearch + '%');	
			}
			
		}
		
		
		if(ids != null && ids.size() > 0) {
			q.setParameter("ids", ids);
			qCount.setParameter("ids", ids);
		}
	
		if(questionType != null && questionType.getId() != null) {
			q.setParameter("questionTypeId", questionType.getId());
			qCount.setParameter("questionTypeId", questionType.getId());
		}
		
		q.setParameter("lower", searchDto.getLower());
		qCount.setParameter("lower", searchDto.getLower());
		
		q.setParameter("upper", searchDto.getUpper());
		qCount.setParameter("upper", searchDto.getUpper());
		
		if(searchDto.getUserId() != null) {
			q.setParameter("userId", searchDto.getUserId());
			qCount.setParameter("userId", searchDto.getUserId());
//			qCountAll.setParameter("userId", searchDto.getUserId());
		}
		
		if(searchDto.getStatus() != 3) {
			q.setParameter("status", searchDto.getStatus());
			qCount.setParameter("status", searchDto.getStatus());
		}
		
		if(searchDto.getWebsite() != null) {
			q.setParameter("website",searchDto.getWebsite());
			qCount.setParameter("website",searchDto.getWebsite());
		}
		
		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();
//		Long numberOfWords = (Long) qCountAll.getSingleResult();
		
//		List<QuestionDto> listQuestionDto = new ArrayList<QuestionDto>();
//		List<Question> listQuestion = q.getResultList();
//		
//		if(q.getResultList() != null && q.getResultList().size() > 0 ) {
//			for (Question domain : listQuestion) {
//				listQuestionDto.add(new QuestionDto(domain));
//			}
//		}
		
		List<QuestionForGamesDto> list = q.getResultList();
		
		if(list != null && list.size() > 0) {
			list.get(0).setNumberOfWords(numberOfWords);
		}
		
//		for(QuestionForGamesDto dto : list) {
//			searchDto.setId(dto.getId());
//			List<QuestionForGamesDto> questions = getListRandomQuestionForGames(searchDto);
//			if(questions != null && questions.size() > 0) {
//				for(QuestionForGamesDto randomQuestion : questions) {
//					dto.getQuestions().add(randomQuestion);
//				}
//				
//			}
//		}
		

		Page<QuestionForGamesDto> page = new PageImpl<QuestionForGamesDto>(list, pageable, numberResult);
		return page;
	}
	
	@Override
	public Page<QuestionForTestsDto> getPageObjectForTests(QuestionDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.QuestionForTestsDto(s) from Question s where (1=1) ";
		String sqlCount = "select count(s.id) from Question s where (1=1) ";
		String whereClause = "";
		
		if(searchDto.getUserId() != null) {
			whereClause += " and s.user.id = :userId ";
		}
		List<Long> ids = new ArrayList<Long>();
		
		if(searchDto.getQuestionTopics() != null && searchDto.getQuestionTopics().size() > 0) {
			List<Long> topicIds = new ArrayList<Long>();
			for (QuestionTopicDto dto : searchDto.getQuestionTopics()) {
				if(dto != null && dto.getTopic() != null && dto.getTopic().getId() != null) {
					topicIds.add(dto.getTopic().getId());
				}	
			}
			if(topicIds != null && topicIds.size() > 0) {
				ids = questionTopicRepository.getListIdQuestionByListIdTopic(topicIds);
				
				if(ids != null && ids.size() > 0) {
					whereClause += " and (s.id in :ids) ";
				} else {
					return null;
				}
				
			}
			
		}
		
		QuestionType questionType = null;
		if(searchDto.getQuestionType() != null && searchDto.getQuestionType().getId() !=null) {
			questionType = questionTypeRepository.getOne(searchDto.getQuestionType().getId());
			if(questionType != null && questionType.getId() != null) {
				whereClause += " and (s.questionType.id =:questionTypeId) ";
			}
		}
		
		if (searchDto.getStatus() != 3) {
			whereClause += "and (s.status =:status) ";
		}
//		else {
//			whereClause += "and (s.status = 1 or s.status = 6 or s.status = 7) ";
//		}
		
		if(searchDto.getWebsite() != null) {
			whereClause += " and (s.website = :website) ";
		}
		
		
		if (textSearch != null && textSearch.length() > 0) {
			if(searchDto.isFindExactWord()) {
				whereClause += " and (s.question = :textSearch ) ";	
			}else {
				whereClause += " and (s.question like :textSearch "
						+ " or s.author like :textSearch "
						+ " or s.title like :textSearch "
						+ " or s.motherTongue like :textSearch )";	
			}
		}
		
		whereClause += "and (s.timeReviewd >= :lower and s.timeReviewd <= :upper) ";

		sql += whereClause;
		sqlCount += whereClause;
		
		sql += " order by s.ordinalNumber, s.createDate DESC ";
		
		Query q = manager.createQuery(sql, QuestionForTestsDto.class);
		Query qCount = manager.createQuery(sqlCount);
		
		Long numberOfWords = (long) 0;
		if(searchDto.getUserId() != null) {
			String sqlCountAll = "select count(s.id) from Question s where (1=1)  and s.user.id = :userId  ";
			Query qCountAll = manager.createQuery(sqlCountAll);
			qCountAll.setParameter("userId", searchDto.getUserId());
			numberOfWords = (Long) qCountAll.getSingleResult();
		}

		if (textSearch != null && textSearch.length() > 0) {
			if(searchDto.isFindExactWord()) {
				q.setParameter("textSearch", textSearch );
				qCount.setParameter("textSearch", textSearch );
			}else {
				q.setParameter("textSearch", '%' + textSearch + '%');
				qCount.setParameter("textSearch", '%' + textSearch + '%');	
			}
			
		}
		
		
		if(ids != null && ids.size() > 0) {
			q.setParameter("ids", ids);
			qCount.setParameter("ids", ids);
		}
	
		if(questionType != null && questionType.getId() != null) {
			q.setParameter("questionTypeId", questionType.getId());
			qCount.setParameter("questionTypeId", questionType.getId());
		}
		
		q.setParameter("lower", searchDto.getLower());
		qCount.setParameter("lower", searchDto.getLower());
		
		q.setParameter("upper", searchDto.getUpper());
		qCount.setParameter("upper", searchDto.getUpper());
		
		if(searchDto.getUserId() != null) {
			q.setParameter("userId", searchDto.getUserId());
			qCount.setParameter("userId", searchDto.getUserId());
//			qCountAll.setParameter("userId", searchDto.getUserId());
		}
		
		if(searchDto.getStatus() != 3) {
			q.setParameter("status", searchDto.getStatus());
			qCount.setParameter("status", searchDto.getStatus());
		}
		
		if(searchDto.getWebsite() != null) {
			q.setParameter("website",searchDto.getWebsite());
			qCount.setParameter("website",searchDto.getWebsite());
		}
		
		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();
//		Long numberOfWords = (Long) qCountAll.getSingleResult();
		
//		List<QuestionDto> listQuestionDto = new ArrayList<QuestionDto>();
//		List<Question> listQuestion = q.getResultList();
//		
//		if(q.getResultList() != null && q.getResultList().size() > 0 ) {
//			for (Question domain : listQuestion) {
//				listQuestionDto.add(new QuestionDto(domain));
//			}
//		}
		
		List<QuestionForTestsDto> list = q.getResultList();
		

		Page<QuestionForTestsDto> page = new PageImpl<QuestionForTestsDto>(list, pageable, numberResult);
		return page;
	}
	
	@Override
	public Page<QuestionOnlyQuestionDto> getPageObjectOnlyQuestion(QuestionDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.QuestionOnlyQuestionDto(s.question) from QuestionTopic s where (1=1) "
				+ "and ( s.topic.id = 1011 or "
				+ " s.topic.id = 1012 or "
				+ " s.topic.id = 1013 or "
				+ " s.topic.id = 1015 or "
				+ " s.topic.id = 1018 or "
				+ " s.topic.id = 1018 or "
				+ " s.topic.id = 1020  )";
		
		String sqlCount = "select count(s.id) from QuestionTopic s where (1=1) "
				+ "and ( s.topic.id = 1011 or "
				+ " s.topic.id = 1012 or "
				+ " s.topic.id = 1013 or "
				+ " s.topic.id = 1015 or "
				+ " s.topic.id = 1018 or "
				+ " s.topic.id = 1018 or "
				+ " s.topic.id = 1020  )";
		
		String whereClause = "";

		sql += whereClause;
		sqlCount += whereClause;
		
		sql += " order by s.createDate DESC ";
		
		Query q = manager.createQuery(sql, QuestionOnlyQuestionDto.class);
		Query qCount = manager.createQuery(sqlCount);
		
		Long numberOfWords = (long) 0;
		
		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();
		
		List<QuestionOnlyQuestionDto> list = q.getResultList();
		
//		if(list != null && list.size() > 0) {
//			list.get(0).setNumberOfWords(numberOfWords);
//		}
//		
//		for(QuestionDto dto : list) {
//			searchDto.setId(dto.getId());
//			List<QuestionDto> questions = getListRandomQuestion(searchDto);
//			if(questions != null && questions.size() > 0) {
//				for(QuestionDto randomQuestion : questions) {
//					dto.getQuestions().add(randomQuestion);
//				}
//				
//			}
//			
//		}
		

		Page<QuestionOnlyQuestionDto> page = new PageImpl<QuestionOnlyQuestionDto>(list, pageable, numberResult);
		return page;
	}
	
	@Override
	public Page<QuestionDto> getPageObjectReverse(QuestionDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();

		String sql = "select new com.globits.richy.dto.QuestionDto(s) from Question s where (1=1) ";
		String sqlCount = "select count(s.id) from Question s where (1=1) ";
		String whereClause = "";
		
		if(searchDto.getUserId() != null) {
			whereClause += " and s.user.id = :userId ";
		}
		List<Long> ids = new ArrayList<Long>();
		
		if(searchDto.getQuestionTopics() != null && searchDto.getQuestionTopics().size() > 0) {
			List<Long> topicIds = new ArrayList<Long>();
			for (QuestionTopicDto dto : searchDto.getQuestionTopics()) {
				if(dto != null && dto.getTopic() != null && dto.getTopic().getId() != null) {
					topicIds.add(dto.getTopic().getId());
				}	
			}
			if(topicIds != null && topicIds.size() > 0) {
				ids = questionTopicRepository.getListIdQuestionByListIdTopic(topicIds);
				
				if(ids != null && ids.size() > 0) {
					whereClause += " and (s.id in :ids) ";
				} else {
					return null;
				}
				
			}
			
		}
		
		QuestionType questionType = null;
		if(searchDto.getQuestionType() != null && searchDto.getQuestionType().getId() !=null) {
			questionType = questionTypeRepository.getOne(searchDto.getQuestionType().getId());
			if(questionType != null && questionType.getId() != null) {
				whereClause += " and (s.questionType.id =:questionTypeId) ";
			}
		}
		
		if (searchDto.getStatus() != 3) {
			whereClause += "and (s.status =:status) ";
		}
		
		if(searchDto.getWebsite() != null) {
			whereClause += " and (s.website = :website) ";
		}
		
		
		if (textSearch != null && textSearch.length() > 0) {
			whereClause += " and (s.question like :textSearch "
					+ " or s.author like :textSearch "
					+ " or s.title like :textSearch "
					+ " or s.motherTongue like :textSearch )";
		}
		
		whereClause += "and (s.timeReviewd >= :lower and s.timeReviewd <= :upper) ";

		sql += whereClause;
		sqlCount += whereClause;
		
		sql += " order by s.ordinalNumber, s.createDate ASC ";
		
		Query q = manager.createQuery(sql, QuestionDto.class);
		Query qCount = manager.createQuery(sqlCount);
		
		Long numberOfWords = (long) 0;
		if(searchDto.getUserId() != null) {
			String sqlCountAll = "select count(s.id) from Question s where (1=1)  and s.user.id = :userId  ";
			Query qCountAll = manager.createQuery(sqlCountAll);
			qCountAll.setParameter("userId", searchDto.getUserId());
			numberOfWords = (Long) qCountAll.getSingleResult();
		}

		if (textSearch != null && textSearch.length() > 0) {
			q.setParameter("textSearch", '%' + textSearch + '%');
			qCount.setParameter("textSearch", '%' + textSearch + '%');
		}
		
		
		if(ids != null && ids.size() > 0) {
			q.setParameter("ids", ids);
			qCount.setParameter("ids", ids);
		}
	
		if(questionType != null && questionType.getId() != null) {
			q.setParameter("questionTypeId", questionType.getId());
			qCount.setParameter("questionTypeId", questionType.getId());
		}
		
		q.setParameter("lower", searchDto.getLower());
		qCount.setParameter("lower", searchDto.getLower());
		
		q.setParameter("upper", searchDto.getUpper());
		qCount.setParameter("upper", searchDto.getUpper());
		
		if(searchDto.getUserId() != null) {
			q.setParameter("userId", searchDto.getUserId());
			qCount.setParameter("userId", searchDto.getUserId());
//			qCountAll.setParameter("userId", searchDto.getUserId());
		}
		
		if(searchDto.getStatus() != 3) {
			q.setParameter("status", searchDto.getStatus());
			qCount.setParameter("status", searchDto.getStatus());
		}
		
		if(searchDto.getWebsite() != null) {
			q.setParameter("website",searchDto.getWebsite());
			qCount.setParameter("website",searchDto.getWebsite());
		}
		
		q.setFirstResult((pageIndex) * pageSize);
		q.setMaxResults(pageSize);

		Long numberResult = (Long) qCount.getSingleResult();
//		Long numberOfWords = (Long) qCountAll.getSingleResult();
		
//		List<QuestionDto> listQuestionDto = new ArrayList<QuestionDto>();
//		List<Question> listQuestion = q.getResultList();
//		
//		if(q.getResultList() != null && q.getResultList().size() > 0 ) {
//			for (Question domain : listQuestion) {
//				listQuestionDto.add(new QuestionDto(domain));
//			}
//		}
		
		List<QuestionDto> list = q.getResultList();
		
		if(list != null && list.size() > 0) {
			list.get(0).setNumberOfWords(numberOfWords);
		}
		
		for(QuestionDto dto : list) {
			searchDto.setId(dto.getId());
			List<QuestionDto> questions = getListRandomQuestion(searchDto);
			if(questions != null && questions.size() > 0) {
				for(QuestionDto randomQuestion : questions) {
					dto.getQuestions().add(randomQuestion);
				}
				
			}
			
		}
		

		Page<QuestionDto> page = new PageImpl<QuestionDto>(list, pageable, numberResult);
		return page;
	}
	
	@Override
	public QuestionDto getRandomFlashCard(QuestionDto searchDto) {
		String sql = "select new com.globits.richy.dto.QuestionDto(s) from Question s where "
				+ "(s.questionType.id = 6) "
				+ "and (s.timeReviewd >= :lower and s.timeReviewd <= :upper)  ";

		String whereClause = "";
		
		if(searchDto.getUserId() != null) {
			whereClause += " and s.user.id = :userId ";
		}
		
		
		List<Long> ids = new ArrayList<Long>();
		
		if(searchDto.getQuestionTopics() != null && searchDto.getQuestionTopics().size() > 0) {
			List<Long> topicIds = new ArrayList<Long>();
			for (QuestionTopicDto dto : searchDto.getQuestionTopics()) {
				if(dto != null && dto.getTopic() != null && dto.getTopic().getId() != null) {
					topicIds.add(dto.getTopic().getId());
				}	
			}
			if(topicIds != null && topicIds.size() > 0) {
				ids = questionTopicRepository.getListIdQuestionByListIdTopic(topicIds);
				
				if(ids != null && ids.size() > 0) {
					whereClause += " and (s.id in :ids) ";
				} else {
					return null;
				}
				
			}
			
		}
		
		if (searchDto.getStatus() != 3) {
			whereClause += "and (s.status =:status) ";
		}
		
		if (searchDto.getStatus() != 3) {
			whereClause += "and (s.status =:status) ";
		}
		
		whereClause += "ORDER BY newid() ";
		
		sql += whereClause;
		
		Query q = manager.createQuery(sql, QuestionDto.class);
		
		if(searchDto.getStatus() != 3) {
			q.setParameter("status", searchDto.getStatus());
		}
		
		q.setParameter("lower", searchDto.getLower());
		
		q.setParameter("upper", searchDto.getUpper());
		
		if(searchDto.getUserId() != null) {
			q.setParameter("userId", searchDto.getUserId());
		}
		
		if(searchDto.getStatus() != 3) {
			q.setParameter("status", searchDto.getStatus());
		}
		
		if(ids != null && ids.size() > 0) {
			q.setParameter("ids", ids);
		}
		
		q.setMaxResults(1);

		QuestionDto ret = (QuestionDto) q.getSingleResult();

		return ret;
	}
	
	@Override
	public QuizDto getRandomFlashCardQuiz(QuizDto searchDto) {
		String sql = "select new com.globits.richy.dto.QuestionDto(s) from Question s where "
				+ "(s.questionType.id = 6) "
				+ "and (s.timeReviewd >= :lower and s.timeReviewd <= :upper)  ";

		String whereClause = "";
		
		if(searchDto.getUserId() != null) {
			whereClause += " and s.user.id = :userId ";
		}
		
		
		List<Long> ids = new ArrayList<Long>();
		
		if(searchDto.getQuestionTopics() != null && searchDto.getQuestionTopics().size() > 0) {
			List<Long> topicIds = new ArrayList<Long>();
			for (QuestionTopicDto dto : searchDto.getQuestionTopics()) {
				if(dto != null && dto.getTopic() != null && dto.getTopic().getId() != null) {
					topicIds.add(dto.getTopic().getId());
				}	
			}
			if(topicIds != null && topicIds.size() > 0) {
				ids = questionTopicRepository.getListIdQuestionByListIdTopic(topicIds);
				
				if(ids != null && ids.size() > 0) {
					whereClause += " and (s.id in :ids) ";
				} else {
					return null;
				}
				
			}
			
		}
		
		if (searchDto.getStatus() != 3) {
			whereClause += "and (s.status =:status) ";
		}
		
		if (searchDto.getStatus() != 3) {
			whereClause += "and (s.status =:status) ";
		}
		
		whereClause += "ORDER BY newid() ";
		
		sql += whereClause;
		
		Query q = manager.createQuery(sql, QuestionDto.class);
		
//		q.setParameter("numberOfAnswers", searchDto.getNumberOfAnswers() - 1);
		
		if(searchDto.getStatus() != 3) {
			q.setParameter("status", searchDto.getStatus());
		}
		
		q.setParameter("lower", searchDto.getLower());
		
		q.setParameter("upper", searchDto.getUpper());
		
		if(searchDto.getUserId() != null) {
			q.setParameter("userId", searchDto.getUserId());
		}
		
		if(searchDto.getStatus() != 3) {
			q.setParameter("status", searchDto.getStatus());
		}
		
		if(ids != null && ids.size() > 0) {
			q.setParameter("ids", ids);
		}
		
		q.setMaxResults(searchDto.getNumberOfAnswers() - 1); //4 answer => 1 answer gốc và 3 cái cần phải tìm random

		List<QuestionDto> questions = q.getResultList();
		
		QuizDto ret = new QuizDto();
		
		if(questions != null && questions.size() > 0) {
			for (QuestionDto dto : questions) {
				if(dto != null) {
					ret.getQuestions().add(dto);
				}	
			}
		}

		return ret;
	}
	
	public List<QuestionDto> getListRandomQuestion(QuestionDto searchDto) {
		String sql = "select new com.globits.richy.dto.QuestionDto(s) from Question s where "
				+ "(s.questionType.id = 6) "
				+ "and (s.timeReviewd >= :lower and s.timeReviewd <= :upper)  ";

		String whereClause = "";
		
		if(searchDto.getUserId() != null && searchDto.getId() != null) {
			whereClause += " and (s.user.id = :userId) and (s.id != :id) ";
		}
		
		
		List<Long> ids = new ArrayList<Long>();
		
		if(searchDto.getQuestionTopics() != null && searchDto.getQuestionTopics().size() > 0) {
			List<Long> topicIds = new ArrayList<Long>();
			for (QuestionTopicDto dto : searchDto.getQuestionTopics()) {
				if(dto != null && dto.getTopic() != null && dto.getTopic().getId() != null) {
					topicIds.add(dto.getTopic().getId());
				}	
			}
			if(topicIds != null && topicIds.size() > 0) {
				ids = questionTopicRepository.getListIdQuestionByListIdTopic(topicIds);
				
				if(ids != null && ids.size() > 0) {
					whereClause += " and (s.id in :ids) ";
				} else {
					return null;
				}
				
			}
			
		}
		
		if (searchDto.getStatus() != 3) {
			whereClause += "and (s.status =:status) ";
		}
		
		if (searchDto.getStatus() != 3) {
			whereClause += "and (s.status =:status) ";
		}
		
		whereClause += "ORDER BY newid() ";
		
		sql += whereClause;
		
		Query q = manager.createQuery(sql, QuestionDto.class);
		
//		q.setParameter("numberOfAnswers", searchDto.getNumberOfAnswers() - 1);
		
		if(searchDto.getStatus() != 3) {
			q.setParameter("status", searchDto.getStatus());
		}
		
		q.setParameter("lower", searchDto.getLower());
		
		q.setParameter("upper", searchDto.getUpper());
		
		if(searchDto.getUserId() != null) {
			q.setParameter("userId", searchDto.getUserId());
			q.setParameter("id", searchDto.getId());
		}
		
		if(searchDto.getStatus() != 3) {
			q.setParameter("status", searchDto.getStatus());
		}
		
		if(ids != null && ids.size() > 0) {
			q.setParameter("ids", ids);
		}
		
		q.setMaxResults(searchDto.getNumberOfAnswers() - 1); //4 answer => 1 answer gốc và 3 cái cần phải tìm random

		List<QuestionDto> ret = q.getResultList();

		return ret;
	}
	
	public List<QuestionForGamesDto> getListRandomQuestionForGames(QuestionDto searchDto) {
		String sql = "select new com.globits.richy.dto.QuestionForGamesDto(s) from Question s where "
				+ "(s.questionType.id = 6) "
				+ "and (s.timeReviewd >= :lower and s.timeReviewd <= :upper)  ";

		String whereClause = "";
		
		if(searchDto.getUserId() != null && searchDto.getId() != null) {
			whereClause += " and (s.user.id = :userId) and (s.id != :id) ";
		}
		
		
		List<Long> ids = new ArrayList<Long>();
		
		if(searchDto.getQuestionTopics() != null && searchDto.getQuestionTopics().size() > 0) {
			List<Long> topicIds = new ArrayList<Long>();
			for (QuestionTopicDto dto : searchDto.getQuestionTopics()) {
				if(dto != null && dto.getTopic() != null && dto.getTopic().getId() != null) {
					topicIds.add(dto.getTopic().getId());
				}	
			}
			if(topicIds != null && topicIds.size() > 0) {
				ids = questionTopicRepository.getListIdQuestionByListIdTopic(topicIds);
				
				if(ids != null && ids.size() > 0) {
					whereClause += " and (s.id in :ids) ";
				} else {
					return null;
				}
				
			}
			
		}
		
		if (searchDto.getStatus() != 3) {
			whereClause += "and (s.status =:status) ";
		}
		
		if (searchDto.getStatus() != 3) {
			whereClause += "and (s.status =:status) ";
		}
		
		whereClause += "ORDER BY newid() ";
		
		sql += whereClause;
		
		Query q = manager.createQuery(sql, QuestionForGamesDto.class);
		
//		q.setParameter("numberOfAnswers", searchDto.getNumberOfAnswers() - 1);
		
		if(searchDto.getStatus() != 3) {
			q.setParameter("status", searchDto.getStatus());
		}
		
		q.setParameter("lower", searchDto.getLower());
		
		q.setParameter("upper", searchDto.getUpper());
		
		if(searchDto.getUserId() != null) {
			q.setParameter("userId", searchDto.getUserId());
			q.setParameter("id", searchDto.getId());
		}
		
		if(searchDto.getStatus() != 3) {
			q.setParameter("status", searchDto.getStatus());
		}
		
		if(ids != null && ids.size() > 0) {
			q.setParameter("ids", ids);
		}
		
		q.setMaxResults(searchDto.getNumberOfAnswers() - 1); //4 answer => 1 answer gốc và 3 cái cần phải tìm random

		List<QuestionForGamesDto> ret = q.getResultList();

		return ret;
	}

	@Override
	public List<QuestionDto> getListObject(QuestionDto searchDto, int pageIndex, int pageSize) {
		return null;
	}

	@Override
	public QuestionDto getObjectById(Long id) {
		return new QuestionDto(questionRepository.getOne(id));
	}

	@Override
	public QuestionDto saveObject(QuestionDto dto) {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User modifiedUser = null;
		LocalDateTime currentDate = LocalDateTime.now();
		String currentUserName = "Unknown User";
		if (authentication != null) {
			modifiedUser = (User) authentication.getPrincipal();
			currentUserName = modifiedUser.getUsername();
		}
		QuestionDto ret = new QuestionDto();
		String message = "Successfully";
		if(dto == null) {
			return null;
		}
		Question domain = null;
		if(dto.getId() != null) {
			domain = questionRepository.getOne(dto.getId());
		}
		if(domain != null) {
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(currentDate);
		}
		if(domain == null) {
			if(dto.getQuestion() != null && modifiedUser.getId() != null) {
				List<Question> questionExists = questionRepository.findByQuestion(dto.getQuestion().trim(),modifiedUser.getId());	
				Question questionExist = null;
				if(questionExists != null && questionExists.size() > 0) {
					questionExist = questionExists.get(0);
				}
				if(questionExist != null && questionExist.getId() != null) {
					message = message + ", but there is another card like this";
					ret.setMessage(message);
				}
			}
			
			domain = new Question();
			domain.setCreateDate(currentDate);
			domain.setCreatedBy(currentUserName);
			
			//1 người chỉ được 10,000 words mà thôi
			Long numberOfQuestions = (long) 0;
			if(modifiedUser.getId() != null) {
				numberOfQuestions = questionRepository.countByUserId(modifiedUser.getId());
				if(numberOfQuestions > 20000) {
					ret.setMessage("You can only create no more than 20.000 words");
					return ret;
				}
			}
		}
//		if(dto.getQuestion() != null) {
//			domain.setQuestion(dto.getQuestion().trim());
//		}
		if(dto.getQuestion() != null) {
			if(dto.getQuestionType() != null && dto.getQuestionType().getId() == 6) {//hard code: id = 6 => flascard
				if(test.isShortEnoughString(dto.getQuestion())) {
					domain.setQuestion(dto.getQuestion());
				}else {
					message = "Should be less than 200 characters";
					ret.setMessage(message);
					return ret;
				}
			} else if(test.isLongEnoughString(dto.getQuestion())) {
				domain.setQuestion(dto.getQuestion());
			}else {
				message = "Your text is way too long";
				ret.setMessage(message);
				return ret;
			}
			
			
			
		}
		
		
		if(test.isShortEnoughString(dto.getPronounce())) {
			domain.setPronounce(dto.getPronounce());
		}else {
			message = "Should be less than 200 characters";
			ret.setMessage(message);
			return ret;
		}
		
		if(test.isShortEnoughString(dto.getMotherTongue())) {
			domain.setMotherTongue(dto.getMotherTongue());
		}else {
			message = "Should be less than 200 characters";
			ret.setMessage(message);
			return ret;
		}
		
		if(test.isLongEnoughString(dto.getDescription())) {
			domain.setDescription(dto.getDescription());
		}else {
			message = "Your text is way too long";
			ret.setMessage(message);
			return ret;
		}
		
//		if(dto.getDescription() != null) {
//			domain.setDescription(dto.getDescription().trim());
//		}
		
		if(dto.getExamples() != null) {
			domain.setExamples(dto.getExamples().trim());
		}
		if(dto.getUserId() != null) {
			User user = userRepository.getOne(dto.getUserId());
			if(user != null) {
				domain.setUser(user);
			}
		}
		
		domain.setOrdinalNumber(dto.getOrdinalNumber());
		domain.setType(dto.getType());
		domain.setStatus(dto.getStatus());
		domain.setCorrectAnswer(dto.getCorrectAnswer());
		domain.setTimeReviewd(dto.getTimeReviewd());
		domain.setWrongAnswer(dto.getWrongAnswer());
		domain.setAuthor(dto.getAuthor());
		domain.setCountWords(dto.getCountWords());
		domain.setTitle(dto.getTitle());
		domain.setWebsite(dto.getWebsite());
		if(dto.getParent() != null && dto.getParent().getId() !=null) {
			Question object = questionRepository.getOne(dto.getParent().getId());
			if(object != null){
				domain.setParent(object);	
			}
		}
		
		setListSubQuestions(dto, domain, currentDate, currentUserName);
//		setListQuestionAnswers(dto,domain,currentDate,currentUserName);
//		if(dto.getSubQuestions()!=null && dto.getSubQuestions().size()>0) {
//			HashSet<Question> subQuestions = new HashSet<Question>();
//			for(QuestionDto sDto: dto.getSubQuestions()) {
//				Question subQuestion = null;
//				if(sDto.getId()!=null) {
//					subQuestion= questionRepository.findOne(sDto.getId());
//				}
//				if(subQuestion==null) {
//					subQuestion = new Question();
//					subQuestion.setCreateDate(currentDate);
//					subQuestion.setCreatedBy(currentUserName);
//				}
//				subQuestion.setQuestion(sDto.getQuestion());
//				if(sDto.getQuestionType() != null && sDto.getQuestionType().getId() != null) {
//					subQuestion.setQuestionType(questionTypeRepository.getOne(sDto.getQuestionType().getId()));
//				}
//				
//				if(sDto.getSubQuestions() != null )
//				
//				subQuestion.setOrdinalNumber(sDto.getOrdinalNumber());
//				subQuestion.setParent(domain);
//				subQuestions.add(subQuestion);
//			}
//			if(domain.getSubQuestions()!=null) {
//				domain.getSubQuestions().clear();
//				domain.getSubQuestions().addAll(subQuestions);
//			}else {
//				domain.setSubQuestions(subQuestions);
//			}
//		}
		
		if(dto.getQuestionType() != null && dto.getQuestionType().getId() != null) {
			domain.setQuestionType(questionTypeRepository.getOne(dto.getQuestionType().getId()));
		}
		if(dto.getQuestionAnswers() !=null && dto.getQuestionAnswers().size()>0) {
			HashSet<QuestionAnswer> childrens = new HashSet<QuestionAnswer>();
			for(QuestionAnswerDto q:dto.getQuestionAnswers()) {
				QuestionAnswer children = null;
				if(q.getId()!=null) {
					children= questionAnswerRepository.getOne(q.getId());
				}
				if(children == null) {
					children = new QuestionAnswer();
					children.setCreateDate(currentDate);
					children.setCreatedBy(currentUserName);
				}
				children.setQuestion(domain);
				if(q.getAnswer() != null && q.getAnswer().getId() != null) {
					children.setAnswer(answerRepository.getOne(q.getAnswer().getId()));
				}
				childrens.add(children);
			}
			if(domain.getQuestionAnswers()!=null) {
				domain.getQuestionAnswers().clear();
				domain.getQuestionAnswers().addAll(childrens);
			}else {
				domain.setQuestionAnswers(childrens);
			}
		}else if(dto.getQuestionAnswers()==null || dto.getQuestionAnswers().size()<=0) {
			if(domain.getQuestionAnswers() != null && domain.getQuestionAnswers().size() > 0) {
				domain.getQuestionAnswers().clear();
			}
		}
		
		if(dto.getQuestionTopics() !=null && dto.getQuestionTopics().size()>0) {
			HashSet<QuestionTopic> childrens = new HashSet<QuestionTopic>();
			for(QuestionTopicDto q:dto.getQuestionTopics()) {
				QuestionTopic children = null;
				if(q.getId()!=null) {
					children= questionTopicRepository.getOne(q.getId());
				}
				if(children == null) {
					children = new QuestionTopic();
					children.setCreateDate(currentDate);
					children.setCreatedBy(currentUserName);
				}
				children.setQuestion(domain);
				if(q.getTopic() != null && q.getTopic().getId() != null) {
					children.setTopic(topicRepository.getOne(q.getTopic().getId()));
				}
				childrens.add(children);
			}
			if(domain.getQuestionTopics()!=null) {
				domain.getQuestionTopics().clear();
				domain.getQuestionTopics().addAll(childrens);
			}else {
				domain.setQuestionTopics(childrens);
			}
		}else if(dto.getQuestionTopics()==null || dto.getQuestionTopics().size()<=0) {
			if(domain.getQuestionTopics() != null && domain.getQuestionTopics().size() > 0) {
				domain.getQuestionTopics().clear();
			}
		}
		domain = questionRepository.save(domain);
		ret = new QuestionDto(domain);
		ret.setMessage(message);
		return ret;
	}

	@Override
	public boolean deleteObject(Long id) {
		if(id == null) {
			return false;
		}
		Question domain = questionRepository.getOne(id);
		if(domain == null) {
			return false;
		}
		questionRepository.delete(domain);
		return true;
	}

	@Override
	public QuestionDto getRandomObject(int from, int to) {
		String sql = "select new com.globits.richy.dto.QuestionDto(s) from Question s where (s.type >= :from and s.type <= :to) ORDER BY newid()";

		
		
		
		Query q = manager.createQuery(sql, QuestionDto.class);
		
		q.setParameter("from", from);
	
		
		q.setParameter("to", to);
		
		q.setMaxResults(1);

		QuestionDto ret = (QuestionDto) q.getSingleResult();

		return ret;
	}
	
	
	public static String deAccent(String str) {
        String nfdNormalizedString = Normalizer.normalize(str, Normalizer.Form.NFD); 
        Pattern pattern = Pattern.compile("\\p{InCombiningDiacriticalMarks}+");
        return pattern.matcher(nfdNormalizedString).replaceAll("");
    }

	@Override
	public QuestionDto answerQuestion(QuestionDto dto) {
		if(dto == null || dto.getAnswerText() == null || dto.getId() == null) {
			return null;
		}
		QuestionDto ret = new QuestionDto();
		
		String clientText = dto.getAnswerText().replaceAll("[\\[\\].\n\",:?'(){};-=/]", "");
		clientText = clientText.toLowerCase();
		clientText = clientText.replaceAll("\\s{2,}", " ").trim();
		String[] listClientText = clientText.split(" ");
		clientText = clientText.replaceAll(" ", "");
		clientText = deAccent(clientText);
		
		List<Answer> list = questionAnswerRepository.getQuestionAnswerBy(dto.getId());
		if(list != null && list.size() > 0) {
			for (Answer answer : list) {
				if(answer != null) {
					String serverText = answer.getText().replaceAll("[\\[\\].\n\",:?'(){};-=/]", "");
					ret.setCorrectText(serverText.trim());
					serverText = serverText.toLowerCase();
					serverText = serverText.replaceAll("\\s{2,}", " ").trim();
					String[] listServerText = serverText.split(" ");
					serverText = serverText.replaceAll(" ", "");
					serverText = deAccent(serverText);
					if(serverText.equals(clientText)) {
						ret.setResult(true); 
						break;
					}else {
						ret.setResult(false); 
						boolean found = false;
						int i = 0;
						String wrongText = "";
						String correctText = "";
						while(!found && i < listClientText.length) {
							String text1 = deAccent(listClientText[i]);
							String text2 = deAccent(listServerText[i]);
							wrongText += listClientText[i] + " ";
							correctText += listServerText[i] + " ";
							if(!text1.equals(text2)) {
								found = true;
							}
							i++;
						}
						ret.setWrongText(wrongText.trim());
						
					}
				}
			}
		}
		
		return ret;
	}
	
	@Override
	public QuestionDto answerQuestionCatechism(QuestionDto dto) {
		if(dto == null || dto.getAnswerText() == null || dto.getId() == null) {
			return null;
		}
		QuestionDto ret = new QuestionDto();
		
		if(dto.getId() != null) {
			ret = getObjectById(dto.getId());	
		}
		
		ret.setTimeReviewd(ret.getTimeReviewd() + 1);
		
		String clientText = dto.getAnswerText();
		
		clientText = processText(clientText);
		
		String[] listClientText = clientText.split(" ");
		clientText = clientText.replaceAll(" ", "");
		clientText = deAccent(clientText);
		
		
		String serverText = dto.getDescription();
		
		serverText = processText(serverText);
		
		String[] listServerText = serverText.split(" ");
		serverText = serverText.replaceAll(" ", "");
		serverText = deAccent(serverText);
		
		if(serverText.equals(clientText)) {
			ret.setCorrectAnswer(ret.getCorrectAnswer() + 1);
			ret.setResult(true); 
			saveObject(ret);
		}else {
			ret.setResult(false); 
			ret.setWrongAnswer(ret.getWrongAnswer() + 1);
			saveObject(ret);
			
			boolean found = false;
			int i = 0;
			String wrongText = "";
			String correctText = "";
			while(!found && i < listClientText.length) {
				String text1 = deAccent(listClientText[i]);
				String text2 = deAccent(listServerText[i]);
				wrongText += listClientText[i] + " ";
				correctText += listServerText[i] + " ";
				if(!text1.equals(text2)) {
					found = true;
				}
				i++;
			}
			
			ret.setCorrectText(correctText.trim());
			ret.setWrongText(wrongText.trim());
		}
		
		
		return ret;
	}

	public void setListSubQuestions(QuestionDto dto, Question parentQuestion,LocalDateTime currentDate, String currentUserName) {
		if(dto.getSubQuestions()!=null && dto.getSubQuestions().size()>0) {
			HashSet<Question> subQuestions = new HashSet<Question>();
			for(QuestionDto sDto: dto.getSubQuestions()) {
				Question subQuestion = null;
				if(sDto.getId()!=null) {
					subQuestion= questionRepository.findOne(sDto.getId());
				}
				if(subQuestion==null) {
					subQuestion = new Question();
					subQuestion.setCreateDate(currentDate);
					subQuestion.setCreatedBy(currentUserName);
				}
				subQuestion.setQuestion(sDto.getQuestion());
				if(sDto.getQuestionType() != null && sDto.getQuestionType().getId() != null) {
					subQuestion.setQuestionType(questionTypeRepository.getOne(sDto.getQuestionType().getId()));
				}
				
				if(sDto.getSubQuestions() != null && sDto.getSubQuestions().size() > 0) {
					setListSubQuestions(sDto,subQuestion,currentDate,currentUserName);
				}
				
				if(sDto.getQuestionAnswers() != null && sDto.getQuestionAnswers().size()>0) {
					HashSet<QuestionAnswer> childrens = new HashSet<QuestionAnswer>();
					for(QuestionAnswerDto q : sDto.getQuestionAnswers()) {
						QuestionAnswer children = null;
						if(q.getId()!=null) {
							children= questionAnswerRepository.getOne(q.getId());
						}
						if(children == null) {
							children = new QuestionAnswer();
							children.setCreateDate(currentDate);
							children.setCreatedBy(currentUserName);
						}
						children.setQuestion(subQuestion);
						Answer answer = null;
						if(q.getAnswer() != null && q.getAnswer().getId() != null) {
							answer = answerRepository.getOne(q.getAnswer().getId());
						}
						if(answer == null) {
							answer = new Answer();
							answer.setCreateDate(currentDate);
							answer.setCreatedBy(currentUserName);
						}
						if(q.getAnswer() != null) {
							answer.setAnswer(q.getAnswer().getAnswer());	
						}						
						answer = answerRepository.save(answer);
						children.setAnswer(answer);
						
						children.setOrdinalNumber(q.getOrdinalNumberQuestionAnswer());
						children.setCorrect(q.isCorrect());
						childrens.add(children);
					}
					if(subQuestion.getQuestionAnswers()!=null) {
						subQuestion.getQuestionAnswers().clear();
						subQuestion.getQuestionAnswers().addAll(childrens);
					}else {
						subQuestion.setQuestionAnswers(childrens);
					}
				}else if(dto.getQuestionAnswers()==null || dto.getQuestionAnswers().size()<=0) {
					if(subQuestion.getQuestionAnswers() != null && subQuestion.getQuestionAnswers().size() > 0) {
						subQuestion.getQuestionAnswers().clear();
					}
				}
				
//				subQuestion.setQuestionAnswers(setListQuestionAnswers(sDto,parentQuestion,currentDate,currentUserName));
				
				subQuestion.setOrdinalNumber(sDto.getOrdinalNumber());
				subQuestion.setParent(parentQuestion);
				subQuestion.setType(sDto.getType());
				subQuestions.add(subQuestion);
				
//				if(dto.getQuestionTopics() !=null && dto.getQuestionTopics().size()>0) {
//					HashSet<QuestionTopic> childrens = new HashSet<QuestionTopic>();
//					for(QuestionTopicDto q:dto.getQuestionTopics()) {
//						QuestionTopic children = null;
//						if(q.getId()!=null) {
//							children= questionTopicRepository.getOne(q.getId());
//						}
//						if(children == null) {
//							children = new QuestionTopic();
//							children.setCreateDate(currentDate);
//							children.setCreatedBy(currentUserName);
//						}
//						children.setQuestion(subQuestion);
//						if(q.getTopic() != null && q.getTopic().getId() != null) {
//							children.setTopic(topicRepository.getOne(q.getTopic().getId()));
//						}
//						childrens.add(children);
//					}
//					if(subQuestion.getQuestionTopics()!=null) {
//						subQuestion.getQuestionTopics().clear();
//						subQuestion.getQuestionTopics().addAll(childrens);
//					}else {
//						subQuestion.setQuestionTopics(childrens);
//					}
//				}else if(dto.getQuestionTopics()==null || dto.getQuestionTopics().size()<=0) {
//					if(subQuestion.getQuestionTopics() != null && subQuestion.getQuestionTopics().size() > 0) {
//						subQuestion.getQuestionTopics().clear();
//					}
//				}
			}
			if(parentQuestion.getSubQuestions()!=null) {
				parentQuestion.getSubQuestions().clear();
				parentQuestion.getSubQuestions().addAll(subQuestions);
			}else {
				parentQuestion.setSubQuestions(subQuestions);
			}
		}
	}
	
//	public ArrayList<QuestionAnswer> setListQuestionAnswers(QuestionDto dto,Question parentQuestion,LocalDateTime currentDate, String currentUserName) {
//		if(dto.getQuestionAnswers() != null && dto.getQuestionAnswers().size()>0) {
//			HashSet<QuestionAnswer> childrens = new HashSet<QuestionAnswer>();
//			for(QuestionAnswerDto q : dto.getQuestionAnswers()) {
//				QuestionAnswer children = null;
//				if(q.getId()!=null) {
//					children= questionAnswerRepository.getOne(q.getId());
//				}
//				if(children == null) {
//					children = new QuestionAnswer();
//					children.setCreateDate(currentDate);
//					children.setCreatedBy(currentUserName);
//				}
//				children.setQuestion(parentQuestion);
//				Answer answer = null;
//				if(q.getAnswer() != null && q.getAnswer().getId() != null) {
//					answer = answerRepository.getOne(q.getAnswer().getId());
//				}
//				if(answer == null) {
//					answer = new Answer();
//					answer.setCreateDate(currentDate);
//					answer.setCreatedBy(currentUserName);
//				}
//				if(q.getAnswer() != null) {
//					answer.setAnswer(q.getAnswer().getAnswer());
//				}
//				children.setAnswer(answer);
//				
//				childrens.add(children);
//			}
//			if(parentQuestion.getQuestionAnswers()!=null) {
//				parentQuestion.getQuestionAnswers().clear();
//				parentQuestion.getQuestionAnswers().addAll(childrens);
//			}else {
//				parentQuestion.setQuestionAnswers(childrens);
//			}
//		}else if(dto.getQuestionAnswers()==null || dto.getQuestionAnswers().size()<=0) {
//			if(parentQuestion.getQuestionAnswers() != null && parentQuestion.getQuestionAnswers().size() > 0) {
//				parentQuestion.getQuestionAnswers().clear();
//			}
//		}
//	}
	
	public String processText(String text) {
		if(text == null) return "";
		
		String ret = text;
		
		ret = ret.replaceAll("[\\[\\].\n\",:?'(){};-=/]", "");
		ret = ret.replaceAll("-", "");
		ret = ret.replaceAll("−", "");
		ret = ret.replaceAll("–", "");
		
		ret = ret.replaceAll("“", "");
		ret = ret.replaceAll("”", "");
		
		ret = ret.trim();
		ret = ret.toLowerCase();
		ret = ret.replaceAll("\\s{2,}", " ").trim();
		
		
		return ret;
	}

	@Override
	public QuestionDto saveMaterial(QuestionDto dto) {
		
		QuestionDto ret = new QuestionDto();
		//tìm xem đã có cái material này chưa
		//tìm list theo user và parentId và questionType IELTS Vocab => tìm ra => không lưu vì có rồi
		if(checkDuplicate(dto)) {
			return ret = null;
		}
		
//		if(dto != null) {
			ret = saveObject(dto);
//		}
		
		
		return ret;
	}
	
	public boolean checkDuplicate(QuestionDto searchDto) {
		boolean ret = false;

		String sqlCount = "select count(s.id) from Question s where (1=1) ";
		String whereClause = "";
		
		if(searchDto.getUserId() != null) {
			whereClause += " and s.user.id = :userId ";
		}
//		List<Long> ids = new ArrayList<Long>();
		
//		if(searchDto.getQuestionTopics() != null && searchDto.getQuestionTopics().size() > 0) {
//			List<Long> topicIds = new ArrayList<Long>();
//			for (QuestionTopicDto dto : searchDto.getQuestionTopics()) {
//				if(dto != null && dto.getTopic() != null && dto.getTopic().getId() != null) {
//					topicIds.add(dto.getTopic().getId());
//				}	
//			}
//			if(topicIds != null && topicIds.size() > 0) {
//				ids = questionTopicRepository.getListIdQuestionByListIdTopic(topicIds);
//				
//				if(ids != null && ids.size() > 0) {
//					whereClause += " and (s.id in :ids) ";
//				} 
//			}
//			
//		}
		
		if(searchDto.getParent() != null && searchDto.getParent().getId() != null) {
			whereClause += " and (s.parent.id = :parentId) ";
		}
		
		QuestionType questionType = null;
		if(searchDto.getQuestionType() != null && searchDto.getQuestionType().getId() !=null) {
			questionType = questionTypeRepository.getOne(searchDto.getQuestionType().getId());
			if(questionType != null && questionType.getId() != null) {
				whereClause += " and (s.questionType.id =:questionTypeId) ";
			}
		}
		
//		if (searchDto.getStatus() != 3) {
//			whereClause += "and (s.status =:status) ";
//		}
		
//		whereClause += "and (s.timeReviewd >= :lower and s.timeReviewd <= :upper) ";

		sqlCount += whereClause;
		
		
		Query qCount = manager.createQuery(sqlCount);
		
//		if(ids != null && ids.size() > 0) {
//			qCount.setParameter("ids", ids);
//		}
	
		if(searchDto.getParent() != null && searchDto.getParent().getId() != null) {
			qCount.setParameter("parentId", searchDto.getParent().getId());
		}
		
		if(questionType != null && questionType.getId() != null) {
			qCount.setParameter("questionTypeId", questionType.getId());
		}
		
//		qCount.setParameter("lower", searchDto.getLower());
//		
//		qCount.setParameter("upper", searchDto.getUpper());
		
		if(searchDto.getUserId() != null) {
			qCount.setParameter("userId", searchDto.getUserId());
		}
		
//		if(searchDto.getStatus() != 3) {
//			qCount.setParameter("status", searchDto.getStatus());
//		}
		
		Long numberResult = (Long) qCount.getSingleResult();
		
		if(numberResult > 0) {
			ret = true;
		}

//		Page<QuestionDto> page = new PageImpl<QuestionDto>(list, pageable, numberResult);
		return ret;
	}

	@Override
	public Page<QuestionUserDto> getStatisticQuestionUser(QuestionDto searchDto, int pageIndex, int pageSize) {
		if (pageIndex > 0)
			pageIndex = pageIndex - 1;
		else
			pageIndex = 0;
		Pageable pageable = new PageRequest(pageIndex, pageSize);

		String textSearch = searchDto.getTextSearch();
		
		String sqlUserId = "select DISTINCT (s.user.id) from Question s where s.user.id != null  ";
		Query qUserId = manager.createQuery(sqlUserId, Long.class);
		
		qUserId.setFirstResult((pageIndex) * pageSize);
		qUserId.setMaxResults(pageSize);
		
		List<QuestionUserDto> questionUserDtos = new ArrayList<QuestionUserDto>();

		String sqlCountAll = "select count(s.id) from Question s where (1=1)  and s.user.id = :userId and (s.questionType.id = 6)  ";
		String whereClause = "";
		
		Query qCountAll = manager.createQuery(sqlCountAll);
		
		List<Long> userIds =  qUserId.getResultList();
		for (Long userId : userIds) {
			QuestionUserDto item = new QuestionUserDto();
			
			User user = userRepository.getOne(userId);
			if(user != null && user.getId() != null) {
				item.setUsername(user.getUsername());	
				qCountAll.setParameter("userId", userId);
				
				Long numberOfWords = (Long) qCountAll.getSingleResult();
				
				item.setNumberOfWords(numberOfWords);
			}
			questionUserDtos.add(item);
		
		}
		
		Collections.sort(questionUserDtos, new sortByNumberOfWords());
		

		Page<QuestionUserDto> page = new PageImpl<QuestionUserDto>(questionUserDtos, pageable, questionUserDtos.size());
		return page;
	}
	
	public class sortByNumberOfWords implements Comparator<QuestionUserDto> {
		public int compare(QuestionUserDto a, QuestionUserDto b)
	    {
			return (int) (b.getNumberOfWords() - a.getNumberOfWords());	
	    }
	}
	
	
}
