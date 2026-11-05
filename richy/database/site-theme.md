# Shared school appearance

Themes are configured by School ID and resolved through each active School's
registered domain. `www` resolves to the same school. Unknown and inactive
domains keep Normal. New schools default to Normal; the existing IELTS Room
selection remains the fallback until an admin saves a choice for that school.

Admins open **Giao diện** in the signed-in header, select one or more schools,
choose **Normal**, **Halloween** or **Christmas**, then select **Lưu áp dụng**.
The list shows each school's name, ID, domain and current theme. The current
school is selected initially. Only the checked schools change, in one database
transaction; an invalid or inactive target rejects the entire batch. The choice
applies to signed-in learners and public visitors of each school. Visible pages check
for updates every 15 seconds and refresh when returning to the tab or going
online. A failed save leaves the displayed theme in place and shows an error.

The legacy IELTS setting with no saved row defaults to Halloween. Normal removes all
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
Choose Normal and save for selected schools to remove their Christmas effects.

## Deployment

School choices use nullable `tbl_school.site_theme`. Linux runs with
`ddl-auto=none`, so startup explicitly runs `db/school-site-theme.sql` to add
this column if missing, without changing existing choices. For manual migrations
use `school-site-theme.sql`. Changing a school's registered domain keeps its theme
on the same School ID. The public resolver never uses suffix/substring matching.

- `GET /service/public/site-theme?domain=example.com` returns only the active
  school identity and theme, anonymously and without caching.
- `GET /service/api/site-theme/schools` lists active schools and current themes
  for admins only.
- `PUT /service/api/site-theme/schools` accepts
  `{ "theme":"CHRISTMAS", "schoolIds":[1,2] }`, for admins only. Empty batches,
  unsupported themes and invalid/inactive IDs return 400, with no partial save.
- Legacy `/site-theme/ieltsroom` endpoints stay available for older clients.
  Saving school `ieltsroom.com` also updates that legacy selection atomically.

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
- The legacy database key is fixed to `ieltsroom.com`. Concurrent writes can return
  409; the admin can refresh the current setting and try again.

The frontend uses the server response as the shared source of truth. The theme
is not stored as a per-user browser preference.

## Validation

Frontend checks are in `richy/app/tests/shared-site-theme-browser.test.cjs`.
They cover domain restrictions, multiple independent visitors, admin controls,
save failures, stale reads, polling and responsive dialogs. Set
`SITE_THEME_BROWSER=webkit` to run the same checks with WebKit.

Backend checks are in `SiteThemeServiceTest.java`, `SchoolSiteThemeServiceTest.java`
and `SiteThemeSchemaUpgradeTest.java`. They cover exact domain resolution,
selected-school isolation, batch validation, admin authorization, compatibility
with older IELTS clients and Hibernate commits read from separate sessions.
