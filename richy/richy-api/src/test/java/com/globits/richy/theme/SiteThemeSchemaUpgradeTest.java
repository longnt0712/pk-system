package com.globits.richy.theme;

import com.globits.richy.service.impl.SiteThemeSchemaUpgrade;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.Statement;
import javax.sql.DataSource;
import org.junit.Test;
import org.mockito.ArgumentCaptor;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

public class SiteThemeSchemaUpgradeTest {
    @Test public void sqlServerUpgradeKeepsVariablesAndAtomicGuardsInOneBatchWithoutChangingChoices() throws Exception {
        DataSource source = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        DatabaseMetaData metadata = mock(DatabaseMetaData.class);
        Statement statement = mock(Statement.class);
        when(source.getConnection()).thenReturn(connection);
        when(connection.getMetaData()).thenReturn(metadata);
        when(metadata.getDatabaseProductName()).thenReturn("Microsoft SQL Server");
        when(connection.createStatement()).thenReturn(statement);
        when(connection.getAutoCommit()).thenReturn(true);
        when(statement.getUpdateCount()).thenReturn(-1);
        new SiteThemeSchemaUpgrade(source).run(null);
        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(statement, times(2)).execute(sql.capture());
        String batch = sql.getAllValues().get(0);
        assertTrue(batch.contains("BEGIN TRANSACTION"));
        assertTrue(batch.contains("COMMIT TRANSACTION"));
        assertTrue(batch.contains("TABLOCKX, HOLDLOCK"));
        assertTrue(batch.contains("WITH CHECK ADD CONSTRAINT CK_tbl_site_theme_choice_v2"));
        assertTrue(batch.contains("'NORMAL', 'HALLOWEEN', 'CHRISTMAS'"));
        assertTrue(batch.indexOf("ADD CONSTRAINT") < batch.indexOf("DROP CONSTRAINT"));
        assertTrue(batch.contains("normalized IN"));
        assertTrue(batch.contains("QUOTENAME(name)"));
        assertFalse(batch.matches("(?is).*\\b(?:UPDATE|INSERT|DELETE)\\s+.*"));
        assertFalse(batch.contains("GO\n"));
        String schoolBatch = sql.getAllValues().get(1);
        assertTrue(schoolBatch.contains("COL_LENGTH(N'dbo.tbl_school', N'site_theme') IS NULL"));
        assertTrue(schoolBatch.contains("ALTER TABLE dbo.tbl_school ADD site_theme varchar(16) NULL"));
        assertTrue(schoolBatch.contains("BEGIN TRANSACTION"));
        assertTrue(schoolBatch.contains("COMMIT TRANSACTION"));
        assertFalse(schoolBatch.matches("(?is).*\\b(?:UPDATE|INSERT|DELETE|DROP)\\s+.*"));
    }

    @Test public void otherDatabaseEnginesDoNotReceiveSqlServerDdl() throws Exception {
        DataSource source = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        DatabaseMetaData metadata = mock(DatabaseMetaData.class);
        when(source.getConnection()).thenReturn(connection);
        when(connection.getMetaData()).thenReturn(metadata);
        when(metadata.getDatabaseProductName()).thenReturn("H2");
        new SiteThemeSchemaUpgrade(source).run(null);
        verify(connection, never()).createStatement();
        verify(source,times(1)).getConnection();
    }
}
