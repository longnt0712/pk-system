package com.globits.richy.battle;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.globits.richy.domain.*;
import com.globits.richy.dto.*;
import com.globits.richy.rest.RestBattleExerciseCatalogController;
import com.globits.richy.service.BattleOnlineException;
import com.globits.richy.service.impl.BattleExerciseCatalogServiceImpl;
import com.globits.security.domain.User;
import java.util.*;
import java.util.stream.Collectors;
import javax.persistence.Entity;
import javax.persistence.EntityManager;
import javax.persistence.Query;
import javax.persistence.TypedQuery;
import org.h2.jdbcx.JdbcDataSource;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.hibernate.stat.Statistics;
import org.joda.time.LocalDateTime;
import org.junit.*;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Real scalar JPQL, paging, visibility and query counts against an isolated H2 database. */
public class BattleExerciseCatalogTest {
    private static SessionFactory factory;
    private EntityManager em;
    private BattleExerciseCatalogServiceImpl service;
    private QuestionType kind;
    private User owner, other;

    @BeforeClass public static void database() throws Exception {
        JdbcDataSource data = new JdbcDataSource();
        data.setURL("jdbc:h2:mem:battle_exercise_catalog;MODE=MSSQLServer;DB_CLOSE_DELAY=-1");
        Configuration config = new Configuration().setProperty("hibernate.dialect", "org.hibernate.dialect.H2Dialect")
                .setProperty("hibernate.hbm2ddl.auto", "create-drop").setProperty("hibernate.show_sql", "false")
                .setProperty("hibernate.generate_statistics", "true");
        config.getProperties().put("hibernate.connection.datasource", data);
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));
        for (String base : Arrays.asList("com.globits.richy", "com.globits.core", "com.globits.security")) {
            for (org.springframework.beans.factory.config.BeanDefinition entity : scanner.findCandidateComponents(base)) {
                config.addAnnotatedClass(Class.forName(entity.getBeanClassName()));
            }
        }
        factory = config.buildSessionFactory();
    }
    @AfterClass public static void closeDatabase() { if (factory != null) factory.close(); }
    @Before public void fixture() {
        em = factory.createEntityManager(); em.getTransaction().begin();
        service = new BattleExerciseCatalogServiceImpl(); ReflectionTestUtils.setField(service,"manager",em);
        as("ROLE_VIEWER");
        em.createNativeQuery("insert into tbl_question_type (id,name,create_date,created_by) values (11,'Tests',CURRENT_TIMESTAMP,'fixture')").executeUpdate();
        kind = em.find(QuestionType.class,11L); owner = user("owner"); other = user("other");
    }
    @After public void rollback() {
        SecurityContextHolder.clearContext();
        if (em != null) { if (em.getTransaction().isActive()) em.getTransaction().rollback(); em.close(); }
    }
    private void as(String role) {
        User actor = new User(); actor.setUsername("actor");
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(actor,"unused",Collections.singletonList(new SimpleGrantedAuthority(role))));
    }
    private User user(String name) {
        User value = new User(); value.setUsername(name + UUID.randomUUID()); value.setPassword("unused"); value.setEmail(value.getUsername() + "@example.invalid"); em.persist(value); return value;
    }
    private Question test(String title) {
        Question value = new Question(); value.setTitle(title); value.setQuestionType(kind); value.setStatus(7);
        value.setType(100); value.setTestFormat("COMPREHENSIVE"); value.setOrdinalNumber(1); value.setUser(owner); em.persist(value); return value;
    }
    private TestFolder folder(String name, TestFolder parent) {
        TestFolder value = new TestFolder(); value.setName(name); value.setOwner(owner); value.setParent(parent); em.persist(value); return value;
    }
    private Topic topic(String name,User user,TopicCategory category) {
        Topic value = new Topic(); value.setName(name); value.setUser(user); value.setTopicCategory(category); em.persist(value); return value;
    }
    private void link(Question question,Topic topic) { QuestionTopic value = new QuestionTopic(); value.setQuestion(question); value.setTopic(topic); em.persist(value); }
    private void prepare() { em.flush(); em.clear(); factory.getStatistics().clear(); }
    private Set<String> titles(QuestionDto filters) {
        Page<BattleOnlineExerciseTestDto> result = service.search(filters,1,50);
        assertEquals(result.getContent().size(),result.getTotalElements());
        return result.getContent().stream().map(BattleOnlineExerciseTestDto::getTitle).collect(Collectors.toSet());
    }
    private void expect(QuestionDto filters,String... names) { assertEquals(new HashSet<String>(Arrays.asList(names)),titles(filters)); }
    private void noHydration(long statements) {
        Statistics stats = factory.getStatistics();
        assertEquals(statements,stats.getPrepareStatementCount()); assertEquals(0L,stats.getEntityLoadCount()); assertEquals(0L,stats.getCollectionFetchCount());
    }
    private void error(HttpStatus code,Runnable request) {
        try { request.run(); fail("Expected " + code); } catch (BattleOnlineException expected) { assertEquals(code,expected.getStatus()); }
    }

    @Test public void onlyPublishedComprehensiveRootsAreVisibleRegardlessOfClientStatusOrOwner() {
        test("Published"); Question legacy = test("Legacy root"); legacy.setType(0); legacy.setUser(other);
        test("Draft").setStatus(6); test("Hidden").setStatus(8); test("Reading").setTestFormat(null);
        test("Daily Listening").setTestFormat("DAILY_LISTENING"); test("Writing").setTestFormat("WRITING");
        test("Part with copied flags").setParent(legacy); test("Reviewed 101").setTimeReviewd(101); test("Negative reviews").setTimeReviewd(-1);
        QuestionType vocabulary = new QuestionType(); vocabulary.setName("Vocabulary"); em.persist(vocabulary);
        test("Wrong kind").setQuestionType(vocabulary);
        prepare(); QuestionDto filters = new QuestionDto(); filters.setStatus(3); filters.setTestFormat("WRITING"); filters.setLower(-100); filters.setUpper(1000);
        expect(filters,"Published","Legacy root"); noHydration(2);
    }

    @Test public void directFolderRootAndExplicitDescendantsStayScalar() {
        TestFolder parent = folder("Parent",null), child = folder("Child",parent), grandchild = folder("Grandchild",child);
        TestFolder foreign = folder("Daily Listening",parent); foreign.setTestMode("DAILY_LISTENING");
        test("Unfiled"); test("Parent test").setTestFolder(parent); test("Child test").setTestFolder(child);
        test("Grandchild test").setTestFolder(grandchild); test("Wrong folder mode").setTestFolder(foreign);
        Long parentId = parent.getId(), foreignId = foreign.getId(); prepare();
        BattleOnlineExerciseTestFilterDto filters = new BattleOnlineExerciseTestFilterDto(); filters.setTestFolderId(parentId);
        assertFalse(filters.isIncludeSubfolders()); expect(filters,"Parent test"); noHydration(2);
        factory.getStatistics().clear(); filters.setIncludeSubfolders(true); expect(filters,"Parent test","Child test","Grandchild test"); noHydration(3);
        filters.setWithoutTestFolder(true); expect(filters,"Unfiled");
        filters.setWithoutTestFolder(false); filters.setTestFolderId(foreignId); expect(filters);
        filters.setTestFolderId(Long.MAX_VALUE); expect(filters);
    }

    @Test public void topicFiltersUseLinkedTopicOwnerDeduplicateAndUnassignedIgnoresStaleFilters() {
        TopicCategory category = new TopicCategory(); category.setName("GRADE 6"); em.persist(category);
        TopicCategory another = new TopicCategory(); another.setName("GRADE 7"); em.persist(another);
        Topic first = topic("Animals",owner,category), second = topic("Food",owner,category), third = topic("Other source",other,another);
        Question tagged = test("Tagged"); tagged.setUser(other); link(tagged,first); link(tagged,second);
        Question outsider = test("Other topic source"); link(outsider,third); test("Standalone");
        Question nullTopic = test("Empty link"); link(nullTopic,null);
        Long sourceId = owner.getId(), categoryId = category.getId(), firstId = first.getId(); prepare();
        QuestionDto filters = new QuestionDto(); filters.setTopicOwnerUserId(sourceId); expect(filters,"Tagged"); noHydration(2);
        filters.setTopicCategoryId(categoryId); filters.setTopicId(firstId); expect(filters,"Tagged");
        filters.setWithoutTopics(true); expect(filters,"Standalone","Empty link");
        filters.setWithoutTopics(false); filters.setTopicOwnerUserId(Long.MAX_VALUE); expect(filters);
    }

    @Test public void titleSearchIsCaseInsensitiveLiteralAndDoesNotSearchQuestionBodies() {
        test("Unit 100%_ready!"); test("Unit 100XXready!"); Question body = test("Other title"); body.setQuestion("100%_ready!"); body.setAuthor("AUTHOR_ONLY");
        test("Literal quote ' example"); prepare();
        QuestionDto filters = new QuestionDto(); filters.setTextSearch("  UNIT 100%_READY!  "); expect(filters,"Unit 100%_ready!");
        filters.setTextSearch("AUTHOR_ONLY"); expect(filters);
        filters.setTextSearch("' or 1=1 --"); expect(filters);
        filters.setTextSearch("quote '"); expect(filters,"Literal quote ' example");
    }

    @Test public void orderPagingAndCountMatchTheExistingCatalogOrder() {
        Question first = test("First"); first.setOrdinalNumber(0);
        Question old = test("Old"), equalOld = test("Old same date"), fresh = test("Fresh"), last = test("Last"); last.setOrdinalNumber(2);
        em.flush(); LocalDateTime date = new LocalDateTime(2026,1,1,0,0);
        first.setCreateDate(date); old.setCreateDate(date); equalOld.setCreateDate(date); fresh.setCreateDate(date.plusDays(1)); last.setCreateDate(date);
        Long firstId = first.getId(), freshId = fresh.getId(), equalId = equalOld.getId(), oldId = old.getId(), lastId = last.getId(); prepare();
        Page<BattleOnlineExerciseTestDto> page = service.search(null,1,2); assertEquals(5,page.getTotalElements());
        assertEquals(Arrays.asList(firstId,freshId),page.getContent().stream().map(BattleOnlineExerciseTestDto::getId).collect(Collectors.toList()));
        page = service.search(null,2,2); assertEquals(Arrays.asList(equalId,oldId),page.getContent().stream().map(BattleOnlineExerciseTestDto::getId).collect(Collectors.toList()));
        page = service.search(null,3,2); assertEquals(lastId,page.getContent().get(0).getId());
        factory.getStatistics().clear(); page = service.search(null,4,2); assertEquals(5,page.getTotalElements()); assertTrue(page.getContent().isEmpty()); noHydration(1);
    }

    @Test public void twelveLargeTestsUseExactlyTwoQueriesAndSerializeOnlyIdsAndTitles() throws Exception {
        TopicCategory category = new TopicCategory(); category.setName("Many topics"); em.persist(category);
        Topic topic = topic("Big linked content",owner,category); topic.setContent("SECRET_TOPIC_CONTENT");
        for (int root = 0; root < 12; root++) {
            Question value = test("Big test " + root); value.setQuestion("SECRET_QUESTION_BODY"); value.setVideoUrl("https://example.invalid/secret-video"); link(value,topic);
            for (int part = 0; part < 3; part++) {
                Question pack = test("Part " + part); pack.setParent(value);
                for (int index = 0; index < 10; index++) {
                    Question child = test("Nested question " + index); child.setParent(pack);
                    Answer answer = new Answer(); answer.setAnswer("SECRET_CORRECT_ANSWER"); em.persist(answer);
                    QuestionAnswer choice = new QuestionAnswer(); choice.setQuestion(child); choice.setAnswer(answer); choice.setCorrect(true); em.persist(choice);
                }
            }
        }
        prepare(); long start = System.nanoTime(); Page<BattleOnlineExerciseTestDto> page = service.search(null,1,12);
        assertEquals(12,page.getTotalElements()); assertEquals(12,page.getContent().size()); noHydration(2);
        JsonNode json = new ObjectMapper().readTree(new ObjectMapper().writeValueAsString(page));
        for (JsonNode item : json.get("content")) { assertEquals(2,item.size()); assertTrue(item.has("id")); assertTrue(item.has("title")); }
        String payload = json.toString(); assertFalse(payload.contains("SECRET_")); assertFalse(payload.contains("subQuestions")); assertFalse(payload.contains("videoUrl"));
        System.out.println("Battle catalog: 12 roots + 396 nested questions + 360 answers: " + ((System.nanoTime()-start)/1000000L) + "ms; 2 SQL statements; 0 entity loads; 0 collection fetches.");
    }

    @Test public void authenticationAndRolesAreEnforcedBeforeDatabaseAccess() {
        prepare(); SecurityContextHolder.clearContext(); error(HttpStatus.UNAUTHORIZED,()->service.search(null,1,12));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("actor","unused"));
        error(HttpStatus.UNAUTHORIZED,()->service.search(null,1,12));
        as("ROLE_OTHER"); error(HttpStatus.FORBIDDEN,()->service.search(null,1,12)); noHydration(0);
        for (String role : Arrays.asList("ROLE_VIEWER","ROLE_USER","ROLE_ADMIN")) { as(role); assertEquals(0,service.search(null,1,12).getTotalElements()); }
    }

    @Test public void pageSizeOffsetAndSearchInputsAreBounded() {
        for (int index = 0; index < 55; index++) test("Test " + index); prepare();
        Page<BattleOnlineExerciseTestDto> page = service.search(null,-1,100000); assertEquals(0,page.getNumber()); assertEquals(50,page.getSize()); assertEquals(50,page.getContent().size());
        page = service.search(null,1,0); assertEquals(1,page.getSize()); assertEquals(1,page.getContent().size());
        factory.getStatistics().clear(); error(HttpStatus.BAD_REQUEST,()->service.search(null,Integer.MAX_VALUE,50)); noHydration(0);
        QuestionDto filters = new QuestionDto(); filters.setTextSearch(String.join("",Collections.nCopies(201,"a")));
        error(HttpStatus.BAD_REQUEST,()->service.search(filters,1,12)); noHydration(0);
    }

    @Test public void everyQueryHasAFiveSecondDatabaseTimeout() {
        EntityManager manager = mock(EntityManager.class); Query count = mock(Query.class);
        @SuppressWarnings("unchecked") TypedQuery<BattleOnlineExerciseTestDto> rows = mock(TypedQuery.class);
        when(manager.createQuery(startsWith("select count"))).thenReturn(count);
        when(count.getSingleResult()).thenReturn(1L);
        when(manager.createQuery(startsWith("select new"),eq(BattleOnlineExerciseTestDto.class))).thenReturn(rows);
        when(rows.getResultList()).thenReturn(Collections.singletonList(new BattleOnlineExerciseTestDto(1L,"Summary")));
        ReflectionTestUtils.setField(service,"manager",manager); service.search(null,1,12);
        verify(count).setHint("javax.persistence.query.timeout",5000); verify(rows).setHint("javax.persistence.query.timeout",5000);
        verify(rows).setFirstResult(0); verify(rows).setMaxResults(12);
    }

    @Test public void restRouteDefaultsToDirectFolderBrowsingAndReturnsACompactPage() throws Exception {
        TestFolder parent = folder("Parent",null), child = folder("Child",parent); test("Visible").setTestFolder(parent); test("Nested").setTestFolder(child);
        Long folderId = parent.getId(); prepare();
        RestBattleExerciseCatalogController rest = new RestBattleExerciseCatalogController(); ReflectionTestUtils.setField(rest,"service",service);
        MockMvc http = MockMvcBuilders.standaloneSetup(rest).build();
        String response = http.perform(post("/api/battle-online/exercise-tests/1/12").contentType("application/json").content("{\"testFolderId\":"+folderId+"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode json = new ObjectMapper().readTree(response); assertEquals(1,json.get("totalElements").asInt()); assertEquals("Visible",json.get("content").get(0).get("title").asText());
        assertEquals(2,json.get("content").get(0).size());
        SecurityContextHolder.clearContext(); http.perform(post("/api/battle-online/exercise-tests/1/12").contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized());
    }
}
