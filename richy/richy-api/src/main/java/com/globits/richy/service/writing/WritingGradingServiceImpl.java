package com.globits.richy.service.writing;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import com.globits.richy.domain.Question;
import com.globits.richy.domain.QuestionAnswer;
import com.globits.richy.domain.QuestionAnswerTestResult;
import com.globits.richy.domain.TestResult;
import com.globits.richy.dto.TestResultDto;
import com.globits.richy.repository.TestResultRepository;
import com.globits.security.domain.User;

@Service
public class WritingGradingServiceImpl implements WritingGradingService {
    private static final Logger LOGGER = LoggerFactory.getLogger(WritingGradingServiceImpl.class);
    private static final Pattern IMAGE_SOURCE = Pattern.compile(
            "(?i)<img\\b[^>]*\\bsrc\\s*=\\s*(?:\"([^\"]+)\"|'([^']+)'|([^\\s>]+))");
    private static final int MAX_FEEDBACK_LENGTH = 2000000;

    @Autowired
    private TestResultRepository testResultRepository;

    @Autowired(required = false)
    private List<WritingGradingProvider> providers = new ArrayList<WritingGradingProvider>();

    @Value("${writing.ai.provider:OPENAI}")
    private String configuredProvider;

    @Value("${writing.prompt-image-base-url:https://ieltsroom.com}")
    private String promptImageBaseUrl;

    @Override
    public synchronized TestResultDto grade(Long testResultId) {
        if (testResultId == null) {
            throw new IllegalArgumentException("Thiếu mã kết quả Writing cần chấm.");
        }

        TestResult result = testResultRepository.findWritingResultForGrading(testResultId);
        if (result == null) {
            throw new IllegalArgumentException("Không tìm thấy kết quả Writing cần chấm.");
        }
        if (!Integer.valueOf(7).equals(result.getTestType())) {
            throw new IllegalArgumentException("Kết quả này không phải bài IELTS Writing.");
        }
        ensureOwnerOrAdmin(result);

        if ("COMPLETED".equals(result.getAiGradingStatus())) {
            return gradingDto(result);
        }

        WritingGradingProvider provider = findProvider();
        result.setAiGradingProvider(configuredProviderCode());
        if (provider != null) {
            result.setAiGradingModel(provider.getModelName());
        }
        if (provider == null || !provider.isConfigured()) {
            result.setAiGradingStatus("NOT_CONFIGURED");
            result.setAiGradingError("Dịch vụ chấm bài chưa được cấu hình.");
            result.setAiGradingFeedback(null);
            result.setAiOverallBand(null);
            return gradingDto(testResultRepository.save(result));
        }

        try {
            WritingGradingRequest request = buildRequest(result);
            if (request.getTasks().isEmpty()) {
                throw new IllegalArgumentException("Bài làm không có nội dung Writing hợp lệ để chấm.");
            }

            result.setAiGradingStatus("PROCESSING");
            result.setAiGradingError(null);
            result.setAiGradingFeedback(null);
            result.setAiOverallBand(null);
            testResultRepository.save(result);

            WritingGradingResult assessment = provider.grade(request);
            if (assessment == null || assessment.getOverallBand() == null
                    || assessment.getOverallBand() < 0D || assessment.getOverallBand() > 9D) {
                throw new IllegalStateException("Dịch vụ AI trả về band điểm không hợp lệ.");
            }
            String feedback = assessment.getFeedbackJson();
            if (feedback != null && feedback.length() > MAX_FEEDBACK_LENGTH) {
                throw new IllegalStateException("Nội dung nhận xét AI vượt quá giới hạn lưu trữ.");
            }

            result.setAiGradingProvider(assessment.getProvider());
            result.setAiGradingModel(assessment.getModel());
            result.setAiOverallBand(assessment.getOverallBand());
            result.setAiGradingFeedback(feedback);
            result.setAiGradingError(null);
            result.setAiGradingStatus("COMPLETED");
        } catch (Exception exception) {
            LOGGER.error("Unable to grade IELTS Writing result {}", testResultId, exception);
            result.setAiGradingStatus("FAILED");
            result.setAiGradingError("Không thể chấm bài lúc này. Bài làm đã được lưu và có thể chấm lại.");
            result.setAiGradingFeedback(null);
            result.setAiOverallBand(null);
        }

        return gradingDto(testResultRepository.save(result));
    }

    private void ensureOwnerOrAdmin(TestResult result) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new AccessDeniedException("Cần đăng nhập để chấm bài Writing.");
        }
        boolean admin = false;
        for (GrantedAuthority authority : authentication.getAuthorities()) {
            if (authority != null && "ROLE_ADMIN".equals(authority.getAuthority())) {
                admin = true;
                break;
            }
        }
        if (admin) { return; }

        Object principal = authentication.getPrincipal();
        Long currentUserId = principal instanceof User ? ((User) principal).getId() : null;
        if (currentUserId == null || result.getUser() == null || result.getUser().getId() == null
                || !currentUserId.equals(result.getUser().getId())) {
            throw new AccessDeniedException("Bạn không được chấm kết quả của tài khoản khác.");
        }
    }

    private WritingGradingProvider findProvider() {
        String requested = configuredProviderCode();
        for (WritingGradingProvider provider : providers) {
            if (provider != null && requested.equalsIgnoreCase(provider.getProviderCode())) {
                return provider;
            }
        }
        return null;
    }

    private String configuredProviderCode() {
        String value = configuredProvider == null ? "" : configuredProvider.trim();
        return value.isEmpty() ? "OPENAI" : value.toUpperCase();
    }

    private WritingGradingRequest buildRequest(TestResult result) {
        WritingGradingRequest request = new WritingGradingRequest();
        request.setTestResultId(result.getId());
        request.setTestName(result.getTestName());

        TreeMap<Integer, WritingGradingTask> tasks = new TreeMap<Integer, WritingGradingTask>();
        if (result.getQuestionAnswerTestResult() != null) {
            for (QuestionAnswerTestResult submittedAnswer : result.getQuestionAnswerTestResult()) {
                QuestionAnswer questionAnswer = submittedAnswer == null ? null : submittedAnswer.getQuestionAnswer();
                Question answerQuestion = questionAnswer == null ? null : questionAnswer.getQuestion();
                Question questionPackage = answerQuestion == null ? null : answerQuestion.getParent();
                Integer part = questionPackage == null ? null
                        : questionPackage.getType() == 16 ? Integer.valueOf(1)
                        : questionPackage.getType() == 17 ? Integer.valueOf(2) : null;
                if (part == null) { continue; }

                WritingGradingTask task = tasks.get(part);
                if (task == null) {
                    task = new WritingGradingTask();
                    task.setPart(part);
                    String promptHtml = questionPackage.getQuestion();
                    if (promptHtml == null || promptHtml.trim().isEmpty()) {
                        promptHtml = answerQuestion.getQuestion();
                    }
                    task.setPrompt(htmlToText(promptHtml));
                    task.setImageUrls(extractImageUrls(promptHtml));
                    task.setAnswer(plainAnswer(submittedAnswer.getClientAnswer()));
                    tasks.put(part, task);
                } else {
                    String nextAnswer = plainAnswer(submittedAnswer.getClientAnswer());
                    if (!nextAnswer.isEmpty()) {
                        task.setAnswer((task.getAnswer() == null || task.getAnswer().isEmpty())
                                ? nextAnswer : task.getAnswer() + "\n\n" + nextAnswer);
                    }
                }
            }
        }

        List<WritingGradingTask> orderedTasks = new ArrayList<WritingGradingTask>(tasks.values());
        Collections.sort(orderedTasks, new Comparator<WritingGradingTask>() {
            @Override
            public int compare(WritingGradingTask first, WritingGradingTask second) {
                return first.getPart() - second.getPart();
            }
        });
        request.setTasks(orderedTasks);
        return request;
    }

    private List<String> extractImageUrls(String html) {
        Set<String> urls = new LinkedHashSet<String>();
        Matcher matcher = IMAGE_SOURCE.matcher(html == null ? "" : html);
        while (matcher.find()) {
            String source = matcher.group(1) != null ? matcher.group(1)
                    : matcher.group(2) != null ? matcher.group(2) : matcher.group(3);
            String resolved = resolveImageUrl(decodeHtml(source));
            if (!resolved.isEmpty()) { urls.add(resolved); }
        }
        return new ArrayList<String>(urls);
    }

    private String resolveImageUrl(String value) {
        String source = value == null ? "" : value.trim();
        if (source.isEmpty() || source.startsWith("javascript:")) { return ""; }
        if (source.startsWith("http://") || source.startsWith("https://") || source.startsWith("data:image/")) {
            return source;
        }
        if (source.startsWith("//")) { return "https:" + source; }
        String base = promptImageBaseUrl == null ? "" : promptImageBaseUrl.trim();
        while (base.endsWith("/")) { base = base.substring(0, base.length() - 1); }
        if (base.isEmpty()) { return ""; }
        return base + (source.startsWith("/") ? source : "/" + source);
    }

    private String plainAnswer(String value) {
        return value == null ? "" : value.replace('\u00a0', ' ').trim();
    }

    private String htmlToText(String html) {
        String text = html == null ? "" : html;
        text = text.replaceAll("(?is)<script\\b[^>]*>.*?</script>", " ");
        text = text.replaceAll("(?is)<style\\b[^>]*>.*?</style>", " ");
        text = text.replaceAll("(?i)<br\\s*/?>", "\n");
        text = text.replaceAll("(?i)</(?:p|div|li|tr|h[1-6])\\s*>", "\n");
        text = text.replaceAll("(?s)<[^>]+>", " ");
        text = decodeHtml(text);
        text = text.replaceAll("[\\t\\x0B\\f\\r ]+", " ");
        text = text.replaceAll(" *\\n+ *", "\n");
        return text.trim();
    }

    private String decodeHtml(String value) {
        if (value == null) { return ""; }
        return value.replace("&nbsp;", " ").replace("&#160;", " ")
                .replace("&amp;", "&").replace("&quot;", "\"")
                .replace("&#39;", "'").replace("&lt;", "<").replace("&gt;", ">");
    }

    private TestResultDto gradingDto(TestResult result) {
        TestResultDto dto = new TestResultDto();
        dto.setId(result.getId());
        dto.setTestType(result.getTestType());
        dto.setAiGradingProvider(result.getAiGradingProvider());
        dto.setAiGradingStatus(result.getAiGradingStatus());
        dto.setAiGradingModel(result.getAiGradingModel());
        dto.setAiOverallBand(result.getAiOverallBand());
        dto.setAiGradingFeedback(result.getAiGradingFeedback());
        dto.setAiGradingError(result.getAiGradingError());
        return dto;
    }
}
