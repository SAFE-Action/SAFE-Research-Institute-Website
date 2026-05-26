# SAFE Research Institute Website

Source for `https://saferi.org`, the public website for the Science and Freedom for Everyone Foundation and SAFE Research Institute.

## Status

The Foundation has applied for recognition under IRC Section 501(c)(3). Until the IRS determination letter is received, public copy should keep using application-pending language and should not state that donations are tax-deductible.

## Local Checks

This is a static site. There is no build step required for normal edits.

```sh
bash scripts/verify-site.sh
```

The verifier checks HTML shape, local `href`/`src` targets, and obvious public-copy drift around pending 501(c)(3) status.

## GitHub Automation

Two workflows are configured:

- `.github/workflows/site-checks.yml` runs static site checks on pull requests and pushes.
- `.github/workflows/deploy-vercel.yml` deploys `master` to Vercel after checks pass.

The Vercel workflow exits cleanly until these GitHub repository secrets are added:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Use `vercel project inspect safe-research-institute` from an authenticated Vercel CLI session to confirm the org/project values. Do not commit tokens or generated `.vercel` state.

## Website Workflow

Volunteer onboarding is handled by the public form and admin queue:

- `volunteer.html` and `js/volunteer.js` collect applications into Firestore.
- `admin.html` and `js/volunteer-admin.js` let admins review, approve, reject, and trigger onboarding.
- `google-apps-script/onboarding.gs` is the optional Google Workspace webhook for Chat, Calendar, and welcome email automation.

See `docs/onboarding-workflow.md` for the full setup checklist.
