# Website Onboarding Workflow

Last updated: 2026-05-25

This file tracks how `saferi.org` moves from GitHub to the live website and how website volunteer applications move into SAFE Research Institute operations.

## Source and Deployment

- GitHub source: `SAFE-Action/SAFE-Research-Institute-Website`
- Production domain: `https://saferi.org`
- Vercel project: `safe-research-institute`
- Production branch: `master`

## GitHub Automation Setup

The repository has two GitHub Actions workflows:

- `site-checks.yml`: verifies static HTML, local links, and pending-status copy on pull requests and pushes.
- `deploy-vercel.yml`: verifies the site and deploys `master` to Vercel when credentials are present.

To enable production deploys from GitHub:

1. In Vercel, create a token scoped to the account that owns `safe-research-institute`.
2. In GitHub repo settings, add repository secrets:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`
3. Confirm the values with `vercel project inspect safe-research-institute` from an authenticated local session.
4. Run the `Deploy to Vercel` workflow manually once from GitHub Actions.
5. After the first successful deploy, make `Site checks` a required branch protection check for `master`.

The deploy workflow intentionally skips deployment instead of failing when secrets are missing. This keeps checks useful before production credentials are added.

## Volunteer Website Workflow

Applicant path:

1. Applicant signs in with Google on `volunteer.html`.
2. `js/volunteer.js` collects the four-step application, signature, optional resume, and task group. Resume uploads are capped at 512KB because they are stored in the Firestore application document.
3. The application is written to Firestore collection `volunteers` with `status: pending`, the authenticated user's `uid`, agreement acknowledgments, agreement version, signature timestamp, source URL, and all visible form fields.

Admin path:

1. Admin signs in on `admin.html`.
2. `js/auth.js` checks the signed-in user's Firestore `users/{uid}.role`.
3. Admin opens the Volunteer Queue tab.
4. `js/volunteer-admin.js` loads pending applications, shows detail, score, notes, and approve/reject controls.
5. Approving an applicant updates Firestore to `status: approved` and can trigger EmailJS plus the Google Apps Script webhook.

Google Workspace automation path:

1. Deploy `google-apps-script/onboarding.gs` as a Google Apps Script web app.
2. Set `CONFIG.SHARED_SECRET`, `CONFIG.CHAT_SPACE_NAME`, `CONFIG.CALENDAR_ID`, `CONFIG.ADMIN_EMAIL`, and meeting settings in Apps Script.
3. Set matching `GAS_WEBHOOK_URL` and `GAS_SHARED_SECRET` in `js/volunteer-admin.js`.
4. Enable Google Chat API and Google Calendar API in the Apps Script project.
5. Approve a test volunteer in the admin panel and confirm Apps Script logs show Chat, Calendar, and welcome-email results.

The admin panel uses `mode: no-cors` for the Apps Script call, so browser JavaScript cannot read the webhook response. Treat Apps Script logs and the resulting Chat/Calendar/email artifacts as the verification source.

## Regression Check

Run the site verifier before merging volunteer workflow changes:

```sh
bash scripts/verify-site.sh
```

This includes `scripts/verify-volunteer-workflow.mjs`, which checks that volunteer form fields are represented in the Firestore payload, admin detail view, Firestore rules contract, meeting availability values, and Apps Script webhook contract.

## Firebase Setup

Before the public volunteer and admin tools can be used in production:

1. Replace placeholder values in `js/firebase-config.js`.
2. Deploy `firestore.rules`.
3. Sign in once as the first admin.
4. In Firestore, set that user's `users/{uid}.role` to `admin`.
5. Confirm a test applicant can create a `volunteers` document and cannot read other applications.
6. Confirm an admin can read the queue and update application status.

## Public-Copy Guardrails

Until the IRS determination letter is received:

- Say the Foundation has applied for recognition under IRC Section 501(c)(3).
- Say tax-exempt status is pending with the IRS.
- Say donations are not yet tax-deductible.
- Do not say the Foundation is already a 501(c)(3) organization.
- Do not say donations are tax-deductible.
