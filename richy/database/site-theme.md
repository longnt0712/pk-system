# Shared IELTS Room appearance

The theme applies only to `ieltsroom.com` and `www.ieltsroom.com`. Other hosts,
including Chapter and localhost, keep their existing interface and do not load
or save the shared theme setting.

Admins open **Giao diện** in the signed-in header, choose **Normal** or
**Halloween**, then select **Lưu áp dụng**. The choice is saved in the database
and applies to signed-in learners and public visitors. Open, visible pages check
for updates every 15 seconds and refresh when returning to the tab or going
online. A failed save leaves the displayed theme in place and shows an error.

An installation with no saved setting defaults to Halloween. Normal removes all
seasonal overrides and restores the existing interface and personal dark-mode
preference. Halloween retains the test view's accessibility contrast modes.

## Deployment

Deploy the backend and frontend together, with the backend available first.
The Hibernate entity creates `tbl_site_theme` when schema updates are enabled.
For installations using explicit SQL Server migrations, run `site-theme.sql`
before serving the new backend. The script can be rerun and does not overwrite
an admin's saved choice.

- `GET /service/public/site-theme/ieltsroom` reads `{ "theme": "HALLOWEEN" }`
  or `{ "theme": "NORMAL" }` without authentication or HTTP caching.
- `PUT /service/api/site-theme/ieltsroom` saves the same payload. The controller
  and service require `ROLE_ADMIN`; unsupported values return 400.
- The database key is fixed to `ieltsroom.com`. Concurrent writes can return
  409; the admin can refresh the current setting and try again.

The frontend uses the server response as the shared source of truth. The theme
is not stored as a per-user browser preference.

## Validation

Frontend checks are in `richy/app/tests/shared-site-theme-browser.test.cjs`.
They cover domain restrictions, multiple independent visitors, admin controls,
save failures, stale reads, polling and responsive dialogs. Set
`SITE_THEME_BROWSER=webkit` to run the same checks with WebKit.

Backend checks are in `SiteThemeServiceTest.java`, including a Hibernate/H2
commit followed by a separate database session to verify persistence.
