package com.globits.richy.schedule;

import com.globits.core.domain.Organization;
import com.globits.richy.battle.BattleVocabularyPreload;
import com.globits.richy.domain.Question;
import com.globits.richy.domain.QuestionTopic;
import com.globits.richy.domain.QuestionType;
import com.globits.richy.domain.Topic;
import com.globits.richy.dto.QuestionForGamesDto;
import com.globits.security.domain.User;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.h2.jdbcx.JdbcDataSource;
import org.hibernate.Session;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.Test;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.Assert.*;

public class BattleVocabularyPreloadPersistenceTest {
    @Test
    public void loadsEachSelectedIdOnceAndProjectsOnlyBattleFields() throws Exception {
        JdbcDataSource dataSource = new JdbcDataSource();
        dataSource.setURL("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MSSQLServer;DB_CLOSE_DELAY=-1");
        try (java.sql.Connection connection = dataSource.getConnection(); java.sql.Statement sql = connection.createStatement()) {
            sql.execute("CREATE SCHEMA dbo");
        }
        Configuration cfg = new Configuration();
        cfg.getProperties().put("hibernate.connection.datasource", dataSource);
        cfg.setProperty("hibernate.default_schema", "dbo");
        cfg.setProperty("hibernate.temp.use_jdbc_metadata_defaults", "false");
        cfg.setProperty("hibernate.dialect", "org.hibernate.dialect.H2Dialect");
        cfg.setProperty("hibernate.hbm2ddl.auto", "create-drop");
        cfg.setProperty("hibernate.hbm2ddl.halt_on_error", "true");
        cfg.setProperty("hibernate.generate_statistics", "true");
        MultiTopicVocabularyPersistenceTest.register(cfg, Topic.class, "com.globits.richy.domain");
        MultiTopicVocabularyPersistenceTest.register(cfg, Organization.class, "com.globits.core.domain");
        MultiTopicVocabularyPersistenceTest.register(cfg, User.class, "com.globits.security.domain");
        try (SessionFactory factory = cfg.buildSessionFactory(); Session session = factory.openSession()) {
            session.beginTransaction();
            User owner = new User(); owner.setUsername("english"); owner.setEmail("english@example.invalid"); owner.setPassword("fixture"); session.save(owner);
            User other = new User(); other.setUsername("other"); other.setEmail("other@example.invalid"); other.setPassword("fixture"); session.save(other);
            Topic a = new Topic(); a.setName("A"); session.save(a);
            Topic b = new Topic(); b.setName("B"); session.save(b);
            Topic c = new Topic(); c.setName("C"); session.save(c);
            QuestionType type = null;
            for (int index = 1; index <= 6; index++) {
                type = new QuestionType(); type.setName("Type " + index); session.save(type);
            }
            assertEquals(Long.valueOf(6), type.getId());
            Question second = question(session, owner, type, 2, 0, a, b);
            Question first = question(session, owner, type, 1, 100, b);
            Question someoneElses = question(session, other, type, 3, 0, a);
            question(session, owner, type, 1, 101, a);
            question(session, owner, type, 1, 0, c);
            session.getTransaction().commit();
            session.clear();
            factory.getStatistics().clear();

            BattleVocabularyPreload service = new BattleVocabularyPreload();
            ReflectionTestUtils.setField(service, "manager", session);
            List<Long> ids = service.plan(owner.getId(), Arrays.asList(a.getId(), b.getId()));
            assertEquals(Arrays.asList(first.getId(), second.getId()), ids);
            List<QuestionForGamesDto> batch = service.loadBatch(owner.getId(),
                    Arrays.asList(second.getId(), someoneElses.getId(), first.getId()));
            assertEquals(second.getId(), batch.get(0).getId());
            assertEquals(first.getId(), batch.get(1).getId());
            assertEquals(2, batch.size());
            assertEquals("nghĩa", batch.get(0).getMotherTongue());
            assertEquals("B2", batch.get(0).getLevel());
            assertTrue(service.loadBatch(owner.getId(), Collections.emptyList()).isEmpty());
            assertEquals(2, factory.getStatistics().getPrepareStatementCount());
            assertEquals(0, factory.getStatistics().getEntityLoadCount());
        }
    }

    private static Question question(Session session, User owner, QuestionType type, int position,
            int reviewed, Topic... topics) {
        Question card = new Question();
        card.setUser(owner); card.setQuestionType(type); card.setOrdinalNumber(position);
        card.setQuestion("word"); card.setMotherTongue("nghĩa"); card.setPronounce("/word/");
        card.setLevel("B2"); card.setTimeReviewd(reviewed);
        session.save(card);
        for (Topic topic : topics) {
            QuestionTopic link = new QuestionTopic(); link.setQuestion(card); link.setTopic(topic); session.save(link);
        }
        return card;
    }
}
