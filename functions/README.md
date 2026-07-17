# Volunteer email automation

Two Cloud Functions in `index.js` power the volunteer lifecycle. Both work by
enqueuing messages into the Firestore `mail` collection; the
[Firebase **Trigger Email from Firestore** extension][ext] watches that
collection and delivers each message over SMTP. The website never writes to
`mail` and never holds SMTP credentials.

### 1. `onVolunteerSignup` — on application

Fires when a new document is created in the `volunteers` collection and sends:

1. **Alert** to the Foundation's monitored inboxes
   (`gregnewkirk@gmail.com`, `greg@saferi.org`, `greg@scienceandfreedom.com`).
2. **Confirmation** to the applicant's email address.

### 2. `onVolunteerApproved` — on approval (onboarding)

Fires when a volunteer record transitions to `status: 'approved'` (i.e. when an
admin clicks **Approve and Onboard** in the Volunteer Queue). It emails the
volunteer a task-group-specific **welcome + onboarding** message containing:

- their focus area and concrete next steps for their task group,
- a one-click **Join the team chat** button, and
- a one-click **Add the weekly meeting to your calendar** button (a recurring
  Google Calendar event).

It only fires on the `pending → approved` transition, so editing a record later
(e.g. adding admin notes) never re-emails the volunteer.

**Configure it:** open the `ONBOARDING` block at the top of `index.js`. The only
value you normally need to set is `chatSpaceUrl` — paste your Google Chat space
share link (Space settings → *Share this space*). Until you do, the chat button
is simply omitted. The weekly-meeting defaults (Tuesday 6 PM ET) drive the
calendar button; adjust `meeting` there if your cadence differs.

## One-time setup (Firebase console + CLI)

1. **Upgrade the project to the Blaze (pay-as-you-go) plan.** Cloud Functions
   and Extensions require it. The free monthly allotments cover low volume, so
   the practical cost for a handful of signups is ~$0.

2. **Install the Trigger Email extension.** In the Firebase console →
   **Extensions** → search "Trigger Email from Firestore" → Install, and set:
   - **Email documents collection:** `mail`
   - **SMTP connection URI:** from your email provider, e.g.
     - SendGrid (free 100/day): `smtps://apikey:SG.xxxxx@smtp.sendgrid.net:465`
     - Google Workspace (`greg@saferi.org` + an App Password):
       `smtps://greg@saferi.org:APP_PASSWORD@smtp.gmail.com:465`
   - **Default FROM address:** e.g. `SAFE Research Institute <greg@saferi.org>`
     (must be an address your SMTP provider is allowed to send from).
   - Leave the templates/users collection fields blank — the function sends
     the full message body.

3. **Deploy the functions and the updated rules.** From this repo, with the
   [Firebase CLI][cli] installed and logged in (`firebase login`):
   ```bash
   firebase use safe-research-institute
   cd functions && npm install && cd ..
   firebase deploy --only functions,firestore:rules
   ```
   This deploys both `onVolunteerSignup` and `onVolunteerApproved`. No local
   machine? Use [Google Cloud Shell][shell] (a browser terminal): clone the repo
   there and run the same commands — nothing to install.

## Test

**Signup:** Submit a test application on `saferi.org/volunteer.html`. Within a
minute you should receive the alert at the three inboxes and the confirmation at
the test address.

**Onboarding:** In `saferi.org/admin.html` → Volunteer Queue, open that test
application and click **Approve and Onboard**. The test address should receive
the welcome/onboarding email with the next-steps and (if configured) the chat +
calendar buttons.

Delivery status is recorded on each `mail` document's `delivery` field in
Firestore.

To change the alert recipients, edit `ALERT_RECIPIENTS` in `index.js` and
redeploy.

[ext]: https://extensions.dev/extensions/firebase/firestore-send-email
[cli]: https://firebase.google.com/docs/cli
[shell]: https://cloud.google.com/shell
