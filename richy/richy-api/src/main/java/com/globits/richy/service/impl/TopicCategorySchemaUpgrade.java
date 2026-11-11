package com.globits.richy.service.impl;

import java.sql.Connection;
import javax.sql.DataSource;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.stereotype.Component;

/** Upgrades vocabulary folder storage on deployments with Hibernate DDL disabled. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TopicCategorySchemaUpgrade implements ApplicationRunner {
    private final DataSource source;

    public TopicCategorySchemaUpgrade(DataSource source) { this.source = source; }

    @Override public void run(ApplicationArguments args) throws Exception {
        try (Connection connection = source.getConnection()) {
            if (!"Microsoft SQL Server".equalsIgnoreCase(connection.getMetaData().getDatabaseProductName())) { return; }
        }
        ResourceDatabasePopulator migration = new ResourceDatabasePopulator(new ClassPathResource("db/topic-category-hierarchy.sql"));
        migration.setSqlScriptEncoding("UTF-8");
        migration.setSeparator(ScriptUtils.EOF_STATEMENT_SEPARATOR);
        migration.execute(source);
    }
}
