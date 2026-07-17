# Volunteer signup email notifications

`onVolunteerSignup` (in `index.js`) fires whenever a new document is created
in the Firestore `volunteers` collection and enqueues two emails into the
`mail` collection:

1. **Alert** to the Foundation's monitored inboxes
   (`gregnewkirk@gmail.com`, `greg@saferi.org`, `greg@scienceandfreedom.com`).
2. **Confirmation** to the applicant's email address.

The [Firebase **Trigger Email from Firestore** extension][ext] watches the
`mail` collection and delivers each message over SMTP. The website never
writes to `mail` and never holds SMTP credentials.

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

3. **Deploy the function and the updated rules.** From this repo, with the
   [Firebase CLI][cli] installed and logged in (`firebase login`):
   ```bash
   firebase use safe-research-institute
   cd functions && npm install && cd ..
   firebase deploy --only functions,firestore:rules
   ```
   No local machine? Use [Google Cloud Shell][shell] (a browser terminal):
   clone the repo there and run the same commands — nothing to install.

## Test

Submit a test application on `saferi.org/volunteer.html`. Within a minute you
should receive the alert at the three inboxes and the confirmation at the test
address. Delivery status is recorded on each `mail` document's `delivery`
field in Firestore.

To change the alert recipients, edit `ALERT_RECIPIENTS` in `index.js` and
redeploy.

[ext]: https://extensions.dev/extensions/firebase/firestore-send-email
[cli]: https://firebase.google.com/docs/cli
[shell]: https://cloud.google.com/shell
