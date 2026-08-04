/**
 * SAFE Research Institute — volunteer signup email notifications.
 *
 * Fires when a new document is created in the `volunteers` collection and
 * enqueues two emails into the `mail` collection. The Firebase "Trigger
 * Email from Firestore" extension (firebase/firestore-send-email) watches
 * the `mail` collection and delivers each message over SMTP:
 *   1. An alert to the Foundation's monitored inboxes.
 *   2. A confirmation to the applicant.
 *
 * The front-end never writes to `mail` and never holds SMTP credentials —
 * this backend trigger is the only writer, so the notification can't be
 * skipped or abused from the client.
 */

const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

setGlobalOptions({ region: 'us-central1', maxInstances: 5 });

// Inboxes alerted on every new volunteer application.
const ALERT_RECIPIENTS = [
  'board@scienceandfreedom.com',
];

// Friendly labels for the stored task-group codes.
const TASK_GROUP_LABELS = {
  outreach: 'Public Education and Community Outreach',
  digital: 'Digital — Website, Data, and Technical Infrastructure',
  experts: 'Research Analysis and Scientific Publications',
  general: 'General Volunteer',
};

// ---------------------------------------------------------------------------
// ONBOARDING CONFIG — the only thing you may want to edit.
// Everything below works with these defaults; the chat button simply hides
// itself until you paste in a space link.
// ---------------------------------------------------------------------------
const ONBOARDING = {
  // Google Chat space share link. In Google Chat, open the space →
  // Space settings → "Share this space" (or the space name dropdown →
  // "Share space") → copy the link and paste it between the quotes.
  // Leave blank to omit the "Join the team chat" button for now.
  chatSpaceUrl: '',

  // Weekly team meeting used to build the "Add to calendar" button.
  meeting: {
    enabled: true,
    title: 'SAFE Research Institute — Weekly Team Meeting',
    dayOfWeek: 2, // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    startHour: 18, // 24-hour local time in the timezone below (18 = 6 PM)
    durationMinutes: 60,
    timezone: 'America/New_York',
    meetLink: '', // optional Google Meet link shown as the event location
  },
};

// Task-group-specific next steps shown in the welcome email.
const ONBOARDING_NEXT_STEPS = {
  outreach: [
    'Introduce yourself in the team chat and tell us which communities or channels you can help reach.',
    'Look over the Evidence Resource Library on saferi.org so you know the materials we share.',
    'Reply to this email with your availability and any outreach experience you want us to know about.',
  ],
  digital: [
    'Introduce yourself in the team chat and note your technical strengths (web, data, tooling, design).',
    'Browse the public site (saferi.org) and jot down anything you would improve.',
    'Reply to this email with your GitHub handle (or portfolio) so we can share the right access.',
  ],
  experts: [
    'Introduce yourself in the team chat and tell us your field and areas of expertise.',
    'Read a couple of the published policy analyses in the Evidence Resource Library to see our house style.',
    'Reply to this email with the topics you would most like to research or review.',
  ],
  general: [
    'Introduce yourself in the team chat so we can point you toward the right work.',
    'Take a look around saferi.org to get a feel for what the Institute publishes.',
    'Reply to this email with the kinds of tasks you would enjoy and your general availability.',
  ],
};

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

exports.onVolunteerSignup = onDocumentCreated('volunteers/{volunteerId}', async (event) => {
  const snap = event.data;
  if (!snap) return;

  const v = snap.data() || {};
  const id = event.params.volunteerId;
  const name = (v.fullName || 'A new applicant').trim();
  const email = (v.email || '').trim();
  const group = TASK_GROUP_LABELS[v.taskGroup] || v.taskGroup || 'Not specified';
  const mail = db.collection('mail');
  const tasks = [];

  // --- 1) Alert to the Foundation ---------------------------------------
  const rows = [
    ['Name', name],
    ['Email', email],
    ['Phone', v.phone],
    ['Location', v.location],
    ['Professional title', v.professionalTitle],
    ['Organization', v.organization],
    ['Area of interest', group],
    ['Legitimacy score', v.legitimacyScore != null ? String(v.legitimacyScore) : ''],
  ].filter(([, val]) => val !== undefined && val !== null && String(val).trim() !== '');

  const textRows = rows.map(([k, val]) => `${k}: ${val}`).join('\n');
  const htmlRows = rows.map(([k, val]) =>
    `<tr><td style="padding:4px 14px 4px 0;color:#5b5f78;">${esc(k)}</td>` +
    `<td style="padding:4px 0;color:#1e2148;"><strong>${esc(val)}</strong></td></tr>`
  ).join('');

  tasks.push(mail.add({
    to: ALERT_RECIPIENTS,
    replyTo: email || undefined,
    message: {
      subject: `New volunteer application — ${name}`,
      text:
        'A new volunteer application was submitted on saferi.org.\n\n' +
        `${textRows}` +
        (v.experience ? `\n\nExperience summary:\n${v.experience}` : '') +
        `\n\nReview it in the admin panel (Volunteer Queue) or in Firestore (volunteers/${id}).`,
      html:
        '<div style="font-family:Inter,Arial,sans-serif;color:#1e2148;">' +
        '<h2 style="margin:0 0 12px;">New volunteer application</h2>' +
        '<p style="margin:0 0 16px;color:#5b5f78;">Submitted on saferi.org.</p>' +
        `<table style="border-collapse:collapse;font-size:14px;">${htmlRows}</table>` +
        (v.experience
          ? '<p style="margin:16px 0 4px;color:#5b5f78;">Experience summary:</p>' +
            `<p style="margin:0;color:#1e2148;">${esc(v.experience)}</p>`
          : '') +
        `<p style="margin:20px 0 0;font-size:13px;color:#8a8ca3;">Application ID: ${esc(id)}</p>` +
        '</div>',
    },
  }));

  // --- 2) Confirmation to the applicant ---------------------------------
  if (email) {
    const first = name.split(' ')[0] || 'there';
    tasks.push(mail.add({
      to: [email],
      message: {
        subject: 'We received your SAFE Research Institute volunteer application',
        text:
          `Hi ${first},\n\n` +
          'Thank you for applying to volunteer with the SAFE Research Institute, the ' +
          'educational platform of the Science and Freedom for Everyone Foundation.\n\n' +
          `We've received your application${v.taskGroup ? ` for ${group}` : ''} and our team ` +
          'will review it. Applications are typically reviewed within five to seven business ' +
          "days, and we'll follow up by email.\n\n" +
          "If you didn't submit this application, you can disregard this message.\n\n" +
          'With appreciation,\nThe SAFE Research Institute',
        html:
          '<div style="font-family:Inter,Arial,sans-serif;color:#1e2148;line-height:1.6;">' +
          `<p>Hi ${esc(first)},</p>` +
          '<p>Thank you for applying to volunteer with the <strong>SAFE Research Institute</strong>, ' +
          'the educational platform of the Science and Freedom for Everyone Foundation.</p>' +
          `<p>We've received your application${v.taskGroup ? ` for <strong>${esc(group)}</strong>` : ''} ` +
          'and our team will review it. Applications are typically reviewed within five to seven ' +
          "business days, and we'll follow up by email.</p>" +
          '<p style="color:#5b5f78;font-size:13px;">If you didn\'t submit this application, you can ' +
          'disregard this message.</p>' +
          '<p>With appreciation,<br>The SAFE Research Institute</p>' +
          '</div>',
      },
    }));
  }

  await Promise.all(tasks);
});

// ---------------------------------------------------------------------------
// Helpers for the onboarding email
// ---------------------------------------------------------------------------
function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Builds a one-click "Add to Google Calendar" link for the recurring weekly
 * meeting. Returns null when the meeting is disabled. Uses the next upcoming
 * occurrence of the configured weekday as the first event; the RRULE makes it
 * repeat weekly, and the ctz parameter pins it to the meeting timezone so the
 * hour is interpreted correctly regardless of where the volunteer opens it.
 */
function buildCalendarUrl() {
  const m = ONBOARDING.meeting;
  if (!m || !m.enabled) return null;

  const now = new Date();
  const today = now.getUTCDay();
  let delta = (m.dayOfWeek - today + 7) % 7;
  if (delta === 0) delta = 7; // always schedule the next one, never "today"
  const next = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + delta
  ));

  const y = next.getUTCFullYear();
  const mo = pad2(next.getUTCMonth() + 1);
  const d = pad2(next.getUTCDate());

  const endTotal = m.startHour * 60 + m.durationMinutes;
  const endH = Math.floor(endTotal / 60);
  const endMin = endTotal % 60;

  const start = `${y}${mo}${d}T${pad2(m.startHour)}0000`;
  const end = `${y}${mo}${d}T${pad2(endH)}${pad2(endMin)}00`;
  const byDay = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][m.dayOfWeek];

  const params = [
    'action=TEMPLATE',
    `text=${encodeURIComponent(m.title)}`,
    `dates=${start}/${end}`,
    `recur=${encodeURIComponent(`RRULE:FREQ=WEEKLY;BYDAY=${byDay}`)}`,
    `ctz=${encodeURIComponent(m.timezone)}`,
    'details=' + encodeURIComponent(
      'Weekly SAFE Research Institute team meeting.' +
      (m.meetLink ? `\n\nJoin: ${m.meetLink}` : '')
    ),
  ];
  if (m.meetLink) params.push(`location=${encodeURIComponent(m.meetLink)}`);

  return `https://calendar.google.com/calendar/render?${params.join('&')}`;
}

function ctaButton(href, label) {
  return (
    `<a href="${esc(href)}" ` +
    'style="display:inline-block;margin:6px 8px 6px 0;padding:12px 22px;' +
    'background:#1e2148;color:#ffffff;text-decoration:none;border-radius:8px;' +
    'font-weight:600;font-size:14px;">' + esc(label) + '</a>'
  );
}

/**
 * Sends the approved volunteer their welcome + onboarding email by enqueuing
 * a message into the `mail` collection (delivered by the Trigger Email
 * extension over SMTP). The email is task-group-aware and carries one-click
 * buttons to join the team chat and add the weekly meeting to their calendar.
 */
exports.onVolunteerApproved = onDocumentUpdated('volunteers/{volunteerId}', async (event) => {
  const before = event.data && event.data.before ? event.data.before.data() : null;
  const after = event.data && event.data.after ? event.data.after.data() : null;
  if (!before || !after) return;

  // Only act on the pending -> approved transition. This ignores later edits
  // (e.g. adding admin notes) so the volunteer is never emailed twice.
  if (before.status === 'approved' || after.status !== 'approved') return;

  const email = (after.email || '').trim();
  if (!email) return;

  const name = (after.fullName || 'there').trim();
  const first = name.split(' ')[0] || 'there';
  const groupCode = after.taskGroup || 'general';
  const group = TASK_GROUP_LABELS[groupCode] || groupCode || 'General Volunteer';
  const steps = ONBOARDING_NEXT_STEPS[groupCode] || ONBOARDING_NEXT_STEPS.general;

  const chatUrl = (ONBOARDING.chatSpaceUrl || '').trim();
  const calUrl = buildCalendarUrl();

  // Plain-text body
  const textSteps = steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const textLinks = [
    chatUrl ? `Join the team chat: ${chatUrl}` : null,
    calUrl ? `Add the weekly meeting to your calendar: ${calUrl}` : null,
  ].filter(Boolean).join('\n');

  const text =
    `Hi ${first},\n\n` +
    'Great news — your application to volunteer with the SAFE Research Institute, the ' +
    'educational platform of the Science and Freedom for Everyone Foundation, has been approved. ' +
    "We're glad to have you.\n\n" +
    `Your focus area: ${group}\n\n` +
    'Next steps:\n' + textSteps + '\n\n' +
    (textLinks ? textLinks + '\n\n' : '') +
    'If you have any questions, just reply to this email.\n\n' +
    'Welcome aboard,\nThe SAFE Research Institute';

  // HTML body
  const htmlSteps = steps.map((s) => `<li style="margin:0 0 8px;">${esc(s)}</li>`).join('');
  const buttons =
    (chatUrl ? ctaButton(chatUrl, 'Join the team chat') : '') +
    (calUrl ? ctaButton(calUrl, 'Add the weekly meeting') : '');

  const html =
    '<div style="font-family:Inter,Arial,sans-serif;color:#1e2148;line-height:1.6;max-width:600px;">' +
    `<p>Hi ${esc(first)},</p>` +
    '<p>Great news — your application to volunteer with the <strong>SAFE Research Institute</strong>, ' +
    'the educational platform of the Science and Freedom for Everyone Foundation, has been ' +
    "<strong>approved</strong>. We're glad to have you.</p>" +
    '<p style="margin:18px 0 4px;color:#5b5f78;">Your focus area</p>' +
    `<p style="margin:0 0 18px;padding:10px 14px;background:#f5f6fb;border-left:3px solid #1e2148;` +
    `border-radius:4px;"><strong>${esc(group)}</strong></p>` +
    '<p style="margin:0 0 6px;"><strong>Next steps</strong></p>' +
    `<ol style="margin:0 0 20px;padding-left:20px;">${htmlSteps}</ol>` +
    (buttons ? `<div style="margin:0 0 20px;">${buttons}</div>` : '') +
    '<p style="color:#5b5f78;">If you have any questions, just reply to this email.</p>' +
    '<p>Welcome aboard,<br>The SAFE Research Institute</p>' +
    '</div>';

  await db.collection('mail').add({
    to: [email],
    replyTo: ALERT_RECIPIENTS[0],
    message: {
      subject: 'Welcome to the SAFE Research Institute — your application is approved',
      text,
      html,
    },
  });
});
