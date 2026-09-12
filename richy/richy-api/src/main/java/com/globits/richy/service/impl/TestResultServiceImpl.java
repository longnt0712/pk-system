package com.globits.richy.service.impl;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.LinkedHashSet;
import com.globits.richy.domain.Topic;
import com.globits.richy.domain.Question;
import com.globits.richy.domain.QuestionTopic;
import com.globits.richy.repository.TopicRepository;
import org.springframework.security.access.AccessDeniedException;

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
import org.springframework.transaction.annotation.Transactional;

import com.globits.richy.domain.Answer;
import com.globits.richy.domain.QuestionAnswer;
import com.globits.richy.domain.QuestionAnswerTestResult;
import com.globits.richy.domain.TestResult;
import com.globits.richy.dto.QuestionAnswerDto;
import com.globits.richy.dto.QuestionAnswerTestResultDto;
import com.globits.richy.dto.TestResultDto;
import com.globits.richy.dto.TestResultStudyCalendarItemDto;
import com.globits.richy.dto.TestResultDto.sortByOrdinalNumberQuestionAnswerTestResult;
import com.globits.richy.repository.AnswerRepository;
import com.globits.richy.repository.QuestionAnswerRepository;
import com.globits.richy.repository.QuestionAnswerTestResultRepository;
import com.globits.richy.repository.QuestionRepository;
import com.globits.richy.repository.TestResultRepository;
import com.globits.richy.service.TestResultService;
import com.globits.security.domain.User;
import com.globits.security.dto.UserDto;
import com.globits.security.repository.UserRepository;

@Service
public class TestResultServiceImpl implements TestResultService {
	@Autowired
	EntityManager manager;
	@Autowired
	TestResultRepository testResultRepository;
	@Autowired
	UserRepository userRepository;
	@Autowired
	QuestionAnswerTestResultRepository questionAnswerTestResultRepository;
	@Autowired
	QuestionAnswerRepository questionAnswerRepository;
	@Autowired
	AnswerRepository answerRepository;
	@Autowired
	QuestionRepository questionRepository;
	@Autowired
	TopicRepository topicRepository;

	private String resultGroupClause(String group) {
		if ("VOCAB".equals(group)) { return " and s.testType = 1 "; }
		if ("DAILY_LISTENING".equals(group)) { return " and s.testType = 3 "; }
		if ("IELTS".equals(group)) { return " and s.testType in (2,4) "; }
		if (group == null || "ALL".equals(group)) { return ""; }
		throw new IllegalArgumentException("Unknown result group");
	}

	private void addQuestionTopics(Question question, Set<Topic> topics) {
		Set<Long> visited = new HashSet<Long>();
		while (question != null && visited.add(question.getId())) {
			if (question.getQuestionTopics() != null) {
				for (QuestionTopic link : question.getQuestionTopics()) { if (link.getTopic() != null) { topics.add(link.getTopic()); } }
			}
			question = question.getParent();
		}
	}

	private Set<Topic> completedTopics(TestResultDto dto, Set<Topic> topics) {
		Set<Topic> completed = new LinkedHashSet<Topic>();
		if (!Integer.valueOf(1).equals(dto.getTestType()) || dto.getCompletedVocabularyTopicIds() == null) { return completed; }
		if (dto.getCompletedVocabularyTopicIds().size() > 100) { throw new IllegalArgumentException("Tối đa 100 topic hoàn thành."); }
		for (Long id : new LinkedHashSet<Long>(dto.getCompletedVocabularyTopicIds())) {
			Topic found = null;
			if (topics != null) { for (Topic topic : topics) { if (topic.getId().equals(id)) { found = topic; break; } } }
			if (found == null) { throw new IllegalArgumentException("Topic hoàn thành không thuộc bài đã làm."); }
			completed.add(found);
		}
		return completed;
	}
	
	@Override
	public Page<TestResultDto> getPageObject(TestResultDto searchDto, int pageIndex, int pageSize) {

	    if (pageIndex > 0)
	        pageIndex = pageIndex - 1;
	    else
	        pageIndex = 0;

	    Pageable pageable = new PageRequest(pageIndex, pageSize);

	    String textSearch = searchDto.getTextSearch();
	    String grade = searchDto.getGrade();
	    Integer schoolId = searchDto.getSchoolId();
	    Integer enrollmentClassId = searchDto.getEnrollmentClassId();

	    String sql =
	            "select new com.globits.richy.dto.TestResultDto(s) "
	            + "from TestResult s where (1=1)";

	    String sqlCount =
	            "select count(s.id) "
	            + "from TestResult s where (1=1)";

	    String whereClause = resultGroupClause(searchDto.getResultGroup());

	    if (searchDto.getUser() != null) {
	        whereClause += " and s.user.id = :userId ";
	    }

	    if (searchDto.getTestType() != null
	            && searchDto.getTestType() != 0) {
	        whereClause += " and s.testType = :testType ";
	    }

	    if (textSearch != null && textSearch.length() > 0) {
	        whereClause += " and (s.testName like :textSearch or exists (select t.id from TestResult tr join tr.topics t where tr.id = s.id and t.name like :textSearch)) ";
	    }

	    if (grade != null && grade.length() > 0) {
	        whereClause += " and s.user.person.displayName like :grade ";
	    }
	    
	    if (enrollmentClassId != null && enrollmentClassId != 0) {
	        whereClause += " and s.user.person.enrollmentClassId = :enrollmentClassId ";
	    }

	    // ===== FILTER SCHOOL =====
	    if (schoolId != null && schoolId != 0) {
	        whereClause +=
	                " and s.user.person.enrollmentClassId in "
	                + "(select ec.id from EnrolmentClass ec "
	                + "where ec.schoolId = :schoolId) ";
	    }

	    if (searchDto.getStartDate() != null
	            && searchDto.getEndDate() != null) {

	        whereClause +=
	                " and (s.createDate >= :startDate "
	                + "and s.createDate < :endDate)";
	    }

	    sql += whereClause + " order by s.createDate DESC";
	    sqlCount += whereClause;

	    Query q = manager.createQuery(sql, TestResultDto.class);
	    Query qCount = manager.createQuery(sqlCount);

	    if (searchDto.getTestType() != null
	            && searchDto.getTestType() != 0) {

	        q.setParameter("testType", searchDto.getTestType());
	        qCount.setParameter("testType", searchDto.getTestType());
	    }

	    if (searchDto.getUser() != null) {
	        q.setParameter("userId", searchDto.getUser().getId());
	        qCount.setParameter("userId", searchDto.getUser().getId());
	    }

	    if (textSearch != null && textSearch.length() > 0) {
	        q.setParameter("textSearch", "%" + textSearch + "%");
	        qCount.setParameter("textSearch", "%" + textSearch + "%");
	    }

	    if (grade != null && grade.length() > 0) {
	        q.setParameter("grade", "%" + grade + "%");
	        qCount.setParameter("grade", "%" + grade + "%");
	    }
	    
	    if (enrollmentClassId != null && enrollmentClassId != 0) {
	        q.setParameter("enrollmentClassId", enrollmentClassId);
	        qCount.setParameter("enrollmentClassId", enrollmentClassId);
	    }

	    // ===== SCHOOL PARAM =====
	    if (schoolId != null && schoolId != 0) {
	        q.setParameter("schoolId", schoolId);
	        qCount.setParameter("schoolId", schoolId);
	    }

	    if (searchDto.getStartDate() != null
	            && searchDto.getEndDate() != null) {

	        LocalDateTime startDate = searchDto.getStartDate();
	        startDate = startDate.plusDays(1).withHourOfDay(0);

	        LocalDateTime endDate = searchDto.getEndDate();
	        endDate = endDate.plusDays(2).withHourOfDay(0);

	        q.setParameter("startDate", startDate);
	        qCount.setParameter("startDate", startDate);

	        q.setParameter("endDate", endDate);
	        qCount.setParameter("endDate", endDate);
	    }

	    q.setFirstResult(pageIndex * pageSize);
	    q.setMaxResults(pageSize);

	    Long numberResult = (Long) qCount.getSingleResult();

	    return new PageImpl<TestResultDto>(
	            q.getResultList(),
	            pageable,
	            numberResult
	    );
	}
	
	public class sortByTimes implements Comparator<TestResultDto> {
		public int compare(TestResultDto a, TestResultDto b)
	    {
	        return b.getTimes() - a.getTimes();
	    }
	}
	
	public class sortByWords implements Comparator<TestResultDto> {
		public int compare(TestResultDto a, TestResultDto b)
	    {
	        return b.getNumberOfWords() - a.getNumberOfWords();
	    }
	}
	
	@Override
	public List<TestResultDto> getRanking(TestResultDto searchDto) {

	    String grade = searchDto.getGrade();
	    Integer enrollmentClassId = searchDto.getEnrollmentClassId();

	    Authentication authentication =
	            SecurityContextHolder.getContext().getAuthentication();

	    User modifiedUser = null;

	    if (authentication != null) {
	        modifiedUser = (User) authentication.getPrincipal();
	    }

	    List<TestResultDto> ret = new ArrayList<TestResultDto>();
	    List<UserDto> users = new ArrayList<UserDto>();

	    if (grade != null && grade.length() > 0) {
	        users = userRepository.getAllUserWithDisplayNameAndUsername(grade);
	    } else {
	        users = userRepository.getAllUserWithDisplayNameAndUsername();
	    }

	    for (UserDto userDto : users) {

	        // ===============================
	        // FILTER THEO LỚP
	        // ===============================
	        if (enrollmentClassId != null && enrollmentClassId != 0) {

	            User user = userRepository.getOne(userDto.getId());

	            if (user == null
	                    || user.getPerson() == null
	                    || user.getPerson().getEnrollmentClassId() == null
	                    || !enrollmentClassId.equals(
	                            user.getPerson().getEnrollmentClassId())) {

	                continue;
	            }
	        }

	        TestResultDto dto = new TestResultDto();

	        dto.setUser(userDto);
	        dto.setTestTakerName(userDto.getDisplayName());

	        String sqlCount =
	                "select count(s.id) from TestResult s where (1=1)";

	        String sqlSum =
	                "select sum(s.numberOfWords) from TestResult s where (1=1)";

	        String whereClause = "";

	        if (userDto != null) {
	            whereClause += " and s.user.id = :userId ";
	        }

	        // ===============================
	        // FILTER THEO LỚP
	        // ===============================
	        if (enrollmentClassId != null && enrollmentClassId != 0) {
	            whereClause +=
	                    " and s.user.person.enrollmentClassId = :enrollmentClassId ";
	        }

	        whereClause += " and s.testType = 1 and (s.resultStatus is null or s.resultStatus = 'SUCCESS') ";

	        if (searchDto != null
	                && searchDto.getStartDate() != null
	                && searchDto.getEndDate() != null) {

	            whereClause +=
	                    " and (s.createDate >= :startDate "
	                    + "and s.createDate < :endDate)";
	        }

	        sqlCount += whereClause;
	        sqlSum += whereClause;

	        Query qCount = manager.createQuery(sqlCount);
	        Query qSum = manager.createQuery(sqlSum);

	        if (userDto != null) {
	            qCount.setParameter("userId", userDto.getId());
	            qSum.setParameter("userId", userDto.getId());
	        }

	        // ===============================
	        // PARAMETER LỚP
	        // ===============================
	        if (enrollmentClassId != null && enrollmentClassId != 0) {
	            qCount.setParameter(
	                    "enrollmentClassId",
	                    enrollmentClassId
	            );

	            qSum.setParameter(
	                    "enrollmentClassId",
	                    enrollmentClassId
	            );
	        }

	        if (searchDto != null
	                && searchDto.getStartDate() != null
	                && searchDto.getEndDate() != null) {

	            LocalDateTime startDate = searchDto.getStartDate();
	            startDate = startDate.plusDays(1).withHourOfDay(0);

	            LocalDateTime endDate = searchDto.getEndDate();
	            endDate = endDate.plusDays(2).withHourOfDay(0);

	            qSum.setParameter("startDate", startDate);
	            qCount.setParameter("startDate", startDate);

	            qSum.setParameter("endDate", endDate);
	            qCount.setParameter("endDate", endDate);
	        }

	        Integer times = null;
	        Integer sum = null;

	        Long a = (Long) qCount.getSingleResult();

	        if (a != null) {
	            times = a.intValue();
	        }

	        Long b = (Long) qSum.getSingleResult();

	        if (b != null) {
	            sum = b.intValue();
	        }

	        if (sum == null) {
	            sum = 0;
	        }

	        // Students without a successful attempt do not enter the ranking.
	        if (times == null || times == 0) { continue; }

	        dto.setTimes(times);
	        dto.setNumberOfWords(sum);

	        ret.add(dto);
	    }

	    Collections.sort(ret, new sortByTimes());

	    List<TestResultDto> ret2 = new ArrayList<TestResultDto>();

	    if (ret.size() < searchDto.getNumberOfRanking()) {
	        searchDto.setNumberOfRanking(ret.size());
	    }

	    for (int i = 0; i < searchDto.getNumberOfRanking(); i++) {
	        ret2.add(ret.get(i));
	    }

	    Collections.sort(ret, new sortByWords());

	    for (int i = 0; i < searchDto.getNumberOfRanking(); i++) {
	        ret2.add(ret.get(i));
	    }

	    return ret2;
	}

	@Override
	public List<TestResultStudyCalendarItemDto> getStudyCalendar(TestResultDto searchDto) {
		List<TestResultStudyCalendarItemDto> calendarItems =
				new ArrayList<TestResultStudyCalendarItemDto>();

		if (searchDto == null) {
			searchDto = new TestResultDto();
		}

		Integer year = searchDto.getCalendarYear();
		Integer month = searchDto.getCalendarMonth();
		LocalDateTime now = LocalDateTime.now();

		if (year == null || year < 2000 || year > 2100) {
			year = now.getYear();
		}
		if (month == null || month < 1 || month > 12) {
			month = now.getMonthOfYear();
		}

		Long userId = null;
		if (searchDto.getUser() != null && searchDto.getUser().getId() != null) {
			userId = searchDto.getUser().getId();
		} else {
			Authentication authentication =
					SecurityContextHolder.getContext().getAuthentication();
			if (authentication != null && authentication.getPrincipal() instanceof User) {
				userId = ((User) authentication.getPrincipal()).getId();
			}
		}

		// A calendar is always personal. Never aggregate every student's activity
		// when no student can be resolved from the request/current session.
		if (userId == null) {
			return calendarItems;
		}

		LocalDateTime monthStart = new LocalDateTime(year, month, 1, 0, 0);
		LocalDateTime nextMonthStart = monthStart.plusMonths(1);

		Query query = manager.createQuery(
				"select s from TestResult s "
				+ "where s.user.id = :userId "
				+ "and s.createDate >= :monthStart "
				+ "and s.createDate < :nextMonthStart "
				+ resultGroupClause(searchDto.getResultGroup())
				+ "order by s.createDate asc");
		query.setParameter("userId", userId);
		query.setParameter("monthStart", monthStart);
		query.setParameter("nextMonthStart", nextMonthStart);

		@SuppressWarnings("unchecked")
		List<TestResult> results = query.getResultList();
		for (TestResult result : results) {
			calendarItems.add(new TestResultStudyCalendarItemDto(result));
		}

		return calendarItems;
	}

	@Override
	public List<TestResultDto> getListObject(TestResultDto searchDto, int pageIndex, int pageSize) {
		return null;
	}

	@Override
	public TestResultDto getObjectById(Long id) {
		return new TestResultDto(testResultRepository.getOne(id),true);
	}

	@Override
	@Transactional(rollbackFor = Exception.class)
	public TestResultDto saveObject(TestResultDto dto) {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		User modifiedUser = null;
		LocalDateTime currentDate = LocalDateTime.now();
		String currentUserName = "Unknown User";
		if (authentication != null) {
			modifiedUser = (User) authentication.getPrincipal();
			currentUserName = modifiedUser.getUsername();
		}
		if(dto == null) {
			return new TestResultDto();
		}
		TestResult domain = null;
		boolean newResult = false;
        boolean passedDailyVocab=true;

        // Retry is scoped to the authenticated student, never a client-supplied user.
        TestResult previousAttempt=findDailyVocabRetry(dto,modifiedUser);
        if(previousAttempt!=null)return new TestResultDto(previousAttempt);
		
		//daily vocab
		if(Integer.valueOf(1).equals(dto.getTestType())) {
            if(dto.getTotalWord()==null||dto.getTotalWord()<=0||dto.getNumberOfWords()==null
                    ||dto.getNumberOfWords()<0||dto.getNumberOfWords()>dto.getTotalWord())
                throw new IllegalArgumentException("Số từ của kết quả Daily Vocab không hợp lệ.");
            passedDailyVocab=dto.checkRestult(dto);
		}
		
		
		if(dto.getId() != null) {
			domain = testResultRepository.getOne(dto.getId());
			if (domain == null || modifiedUser == null || domain.getUser() == null
					|| !domain.getUser().getId().equals(modifiedUser.getId())) {
				throw new AccessDeniedException("Bạn không được sửa kết quả của tài khoản khác.");
			}
			// A passed vocabulary completion is immutable: no later ID/topic/time forgery.
			if (Integer.valueOf(1).equals(domain.getTestType())) { return new TestResultDto(domain); }
		}
		Set<Topic> resultTopics = null;
		if (dto.getTopicIds() != null) {
			if (dto.getTopicIds().size() > 100) { throw new IllegalArgumentException("Tối đa 100 topic trong một kết quả."); }
			resultTopics = new LinkedHashSet<Topic>();
			for (Long id : new LinkedHashSet<Long>(dto.getTopicIds())) {
				Topic topic = id == null ? null : topicRepository.findOne(id);
				if (topic == null) { throw new IllegalArgumentException("Topic không còn tồn tại."); }
				resultTopics.add(topic);
			}
		}
		if (dto.getSourceQuestionId() != null && !Integer.valueOf(1).equals(dto.getTestType())) {
			if (resultTopics == null) { resultTopics = new LinkedHashSet<Topic>(); }
			addQuestionTopics(questionRepository.findOne(dto.getSourceQuestionId()), resultTopics);
		}
		Set<Topic> completedVocabTopics = passedDailyVocab ? completedTopics(dto, resultTopics) : new LinkedHashSet<Topic>();
		if(domain != null) {
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(currentDate);
		}
		if(domain == null) {
			domain = new TestResult();
			newResult = true;
            if(Integer.valueOf(1).equals(dto.getTestType()))domain.setClientAttemptKey(dto.getClientAttemptKey());
			domain.setCreateDate(currentDate);
			domain.setCreatedBy(currentUserName);
		}
		User resultUser = null;
		if(dto.getTestType() != null && dto.getTestType() == 1
				&& modifiedUser != null && modifiedUser.getId() != null) {
			// Daily Vocab chỉ được ghi nhận cho chính tài khoản đang đăng nhập.
			resultUser = userRepository.findById(modifiedUser.getId());
		} else if(dto.getUser() != null && dto.getUser().getId() != null) {
			resultUser = userRepository.getOne(dto.getUser().getId());
		}
		if(resultUser != null) {
			User user = resultUser;
			if(user != null && user.getId() != null) {
				domain.setUser(user);	
			}
			
		}
		domain.setTestTakerName(dto.getTestTakerName());
		if (resultTopics != null) { domain.getTopics().clear(); domain.getTopics().addAll(resultTopics); }
		if (newResult && Integer.valueOf(1).equals(dto.getTestType())) {
			domain.getCompletedVocabularyTopics().addAll(completedVocabTopics);
		}
		domain.setTestName(dto.getTestName());
		domain.setTestTime(dto.getTestTime());
		domain.setTestType(dto.getTestType());
        domain.setResultStatus(Integer.valueOf(1).equals(dto.getTestType())?(passedDailyVocab?"SUCCESS":"FAILED"):null);
		domain.setNumberOfWords(dto.getNumberOfWords());
		domain.setTestTakerPerformance(dto.getTestTakerPerformance());
		if(dto.getQuestionAnswerTestResult() !=null && dto.getQuestionAnswerTestResult().size()>0) {
			HashSet<QuestionAnswerTestResult> childrens = new HashSet<QuestionAnswerTestResult>();
			for(QuestionAnswerTestResultDto q:dto.getQuestionAnswerTestResult()) {
				QuestionAnswerTestResult children = null;
				if(q.getId()!=null) {
					children= questionAnswerTestResultRepository.getOne(q.getId());
				}
				if(children == null) {
					children = new QuestionAnswerTestResult();
					children.setCreateDate(currentDate);
					children.setCreatedBy(currentUserName);
				}
				children.setTestResult(domain);
				if (resultTopics != null && !Integer.valueOf(1).equals(dto.getTestType())
						&& q.getQuestionAnswer() != null && q.getQuestionAnswer().getId() != null) {
					QuestionAnswer answer = questionAnswerRepository.findOne(q.getQuestionAnswer().getId());
					if (answer != null) { addQuestionTopics(answer.getQuestion(), domain.getTopics()); }
				}
				
				if(q.getQuestionAnswer() != null && q.getQuestionAnswer().getId() != null) {
					children.setQuestionAnswer(questionAnswerRepository.getOne(q.getQuestionAnswer().getId()));
				}
				
				children.setOrdinalNumber(q.getOrdinalNumber());
				children.setClientAnswer(q.getClientAnswer());
				
				childrens.add(children);
			}
			if(domain.getQuestionAnswerTestResult()!=null) {
				domain.getQuestionAnswerTestResult().clear();
				domain.getQuestionAnswerTestResult().addAll(childrens);
			}else {
				domain.setQuestionAnswerTestResult(childrens);
			}
		}else if(dto.getQuestionAnswerTestResult()==null || dto.getQuestionAnswerTestResult().size()<=0) {
			if(domain.getQuestionAnswerTestResult() != null && domain.getQuestionAnswerTestResult().size() > 0) {
				domain.getQuestionAnswerTestResult().clear();
			}
		}
		
		
		domain = testResultRepository.save(domain);

		/*
		 * Chỉ kết quả Daily Vocab SUCCESS mới cộng số từ đúng vào kinh nghiệm.
		 * FAILED vẫn lưu lịch sử, không cộng EXP và không hoàn thành homework.
		 * Lưu lại cùng result id hoặc mã lượt không cộng lần hai.
		 */
		if(newResult && domain.getTestType() != null && domain.getTestType() == 1
				&& "SUCCESS".equals(domain.getResultStatus())
				&& domain.getVocabularyExperienceAwardedWords() == 0
				&& domain.getNumberOfWords() != null && domain.getNumberOfWords() > 0
				&& domain.getUser() != null) {
			int awardedWords = domain.getNumberOfWords();
			domain.getUser().addDailyVocabularyWords(awardedWords);
			userRepository.save(domain.getUser());
			domain.setVocabularyExperienceAwardedWords(awardedWords);
			domain = testResultRepository.save(domain);
		}
		
		return new TestResultDto(domain);
	}

    private TestResult findDailyVocabRetry(TestResultDto dto,User actor) {
        if(dto.getClientAttemptKey()==null)return null; // Older clients remain compatible.
        if(!Integer.valueOf(1).equals(dto.getTestType())||!dto.getClientAttemptKey().matches("[a-f0-9]{32}"))
            throw new IllegalArgumentException("Mã lượt Daily Vocab không hợp lệ.");
        if(actor==null||actor.getId()==null)throw new AccessDeniedException("Cần đăng nhập để lưu kết quả.");
        if(dto.getUser()!=null&&dto.getUser().getId()!=null&&!actor.getId().equals(dto.getUser().getId()))
            throw new AccessDeniedException("Lượt làm này thuộc tài khoản khác.");
        return testResultRepository.findDailyVocabAttempt(actor.getId(),dto.getClientAttemptKey());
    }
	@Override
	public boolean deleteObject(Long id) {
		if(id == null) {
			return false;
		}
		TestResult domain = testResultRepository.getOne(id);
		if(domain == null) {
			return false;
		}
		domain.setUser(null);
//		questionAnswerTestResultRepository.deleteByTestResultId(domain.getId());
		
		testResultRepository.delete(domain);
		return true;
	}

}
