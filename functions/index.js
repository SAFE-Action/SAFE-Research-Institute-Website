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

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
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
