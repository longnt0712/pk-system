-- Run before deploying the fair inventory backend. Safe to run again.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.tbl_fair_item_option', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tbl_fair_item_option (
        id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        kind VARCHAR(16) NOT NULL,
        name NVARCHAR(80) NOT NULL,
        name_key NVARCHAR(80) NOT NULL,
        CONSTRAINT uk_fair_item_option_kind_name UNIQUE (kind, name_key)
    );
    INSERT INTO dbo.tbl_fair_item_option (kind, name, name_key)
    VALUES ('CATEGORY', N'Văn phòng phẩm', N'văn phòng phẩm'),
           ('CATEGORY', N'Phụ kiện', N'phụ kiện'),
           ('CATEGORY', N'Đồ chơi', N'đồ chơi'),
           ('CATEGORY', N'Đồ ăn', N'đồ ăn'),
           ('DIFFICULTY', N'Dễ', N'dễ'),
           ('DIFFICULTY', N'Trung bình', N'trung bình'),
           ('DIFFICULTY', N'Khó', N'khó');
END;

IF OBJECT_ID(N'dbo.tbl_fair_item', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tbl_fair_item (
        id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        event_id BIGINT NOT NULL REFERENCES dbo.tbl_fair_event(id),
        name NVARCHAR(150) NOT NULL,
        unit_price BIGINT NOT NULL,
        quantity INT NOT NULL,
        category_id BIGINT NOT NULL REFERENCES dbo.tbl_fair_item_option(id),
        difficulty_id BIGINT NOT NULL REFERENCES dbo.tbl_fair_item_option(id),
        photo VARBINARY(MAX) NULL,
        revision BIGINT NOT NULL,
        CONSTRAINT ck_fair_item_amounts CHECK (unit_price BETWEEN 0 AND 1000000000 AND quantity BETWEEN 0 AND 1000000)
    );
    CREATE INDEX ix_fair_item_event ON dbo.tbl_fair_item(event_id, id);
END;

COMMIT TRANSACTION;
