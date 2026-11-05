# Shared IELTS Room appearance

The theme applies only to `ieltsroom.com` and `www.ieltsroom.com`. Other hosts,
including Chapter and localhost, keep their existing interface and do not load
or save the shared theme setting.

Admins open **Giao diện** in the signed-in header, choose **Normal** or
**Halloween** or **Christmas**, then select **Lưu áp dụng**. The choice is saved in the database
and applies to signed-in learners and public visitors. Open, visible pages check
for updates every 15 seconds and refresh when returning to the tab or going
online. A failed save leaves the displayed theme in place and shows an error.

An installation with no saved setting defaults to Halloween. Normal removes all
seasonal overrides and restores the existing interface and personal dark-mode
preference. Halloween retains the test view's accessibility contrast modes.

Christmas is an independent, opt-in theme. Installing it does not change the
saved choice or Normal/Halloween. It adds a light garland to public and signed-in
headers, winter village banner artwork and frosted SVG snowflakes. There are
at most ten screen-wide flakes (six on phones), plus five small flakes in the
village banner, animated with CSS transform/opacity only. Roof lights, windows
and the tree's golden star brighten slowly using opacity animation.
There is no canvas loop, per-flake blur or external animation library. Snow
pauses on hidden tabs and disappears while a modal, exam or reduced-motion
preference is active. Reduced-motion keeps the garland lit without blinking.
Choose Normal and save to remove every Christmas effect for all visitors.

## Deployment

Deploy the backend and frontend together, with the backend available first.
The Hibernate entity creates `tbl_site_theme` when schema updates are enabled.
For installations using explicit SQL Server migrations, run `site-theme.sql`
before serving the new backend. The script can be rerun and does not overwrite
an admin's saved choice.

The backend startup migration `db/site-theme-christmas.sql` expands the existing
SQL Server theme CHECKs to accept CHRISTMAS. Hibernate alone does not update old
CHECKs. It installs the replacement domain/value constraint first and removes
only recognized legacy Normal/Halloween constraints, inside a transaction with
a table lock. Custom constraints and saved choices are preserved. The migration
is idempotent and needs ALTER permission on `dbo.tbl_site_theme`; deploy the
backend before the frontend. For manual deployment the same SQL is in
`richy/richy-api/src/main/resources/db/site-theme-christmas.sql`.

- `GET /service/public/site-theme/ieltsroom` reads `{ "theme": "HALLOWEEN" }`
  or `{ "theme": "NORMAL" }` or `{ "theme": "CHRISTMAS" }` without authentication or HTTP caching.
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
