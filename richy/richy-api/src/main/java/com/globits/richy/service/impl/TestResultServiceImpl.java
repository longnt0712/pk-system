package com.globits.richy.service.impl;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;

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

	    String whereClause = "";

	    if (searchDto.getUser() != null) {
	        whereClause += " and s.user.id = :userId ";
	    }

	    if (searchDto.getTestType() != null
	            && searchDto.getTestType() != 0) {
	        whereClause += " and s.testType = :testType ";
	    }

	    if (textSearch != null && textSearch.length() > 0) {
	        whereClause += " and s.testName like :textSearch ";
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

	        whereClause += " and s.testType = 1 ";

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
		
		//daily vocab
		if(dto.getTestType() == 1) {
			if(!dto.checkRestult(dto)) {
				dto.setMessageCode(1);
				return dto;
			}
		}
		
		
		if(dto.getId() != null) {
			domain = testResultRepository.getOne(dto.getId());
		}
		if(domain != null) {
			domain.setModifiedBy(currentUserName);
			domain.setModifyDate(currentDate);
		}
		if(domain == null) {
			domain = new TestResult();
			domain.setCreateDate(currentDate);
			domain.setCreatedBy(currentUserName);
		}
		if(dto.getUser() != null && dto.getUser().getId() != null) {
			User user = userRepository.getOne(dto.getUser().getId());
			if(user != null && user.getId() != null) {
				domain.setUser(user);	
			}
			
		}
		domain.setTestTakerName(dto.getTestTakerName());
		domain.setTestName(dto.getTestName());
		domain.setTestTime(dto.getTestTime());
		domain.setTestType(dto.getTestType());
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
		
		return new TestResultDto(domain);
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
