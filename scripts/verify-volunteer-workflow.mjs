#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const files = {
  html: readFileSync('volunteer.html', 'utf8'),
  volunteerJs: readFileSync('js/volunteer.js', 'utf8'),
  adminJs: readFileSync('js/volunteer-admin.js', 'utf8'),
  rules: readFileSync('firestore.rules', 'utf8'),
  appsScript: readFileSync('google-apps-script/onboarding.gs', 'utf8')
};

let failures = 0;

function fail(message) {
  console.error(`ERROR: ${message}`);
  failures += 1;
}

function requireIncludes(label, text, needle) {
  if (!text.includes(needle)) {
    fail(`${label} is missing ${needle}`);
  }
}

function requirePattern(label, text, pattern) {
  if (!pattern.test(text)) {
    fail(`${label} does not match ${pattern}`);
  }
}

const formElementIds = [
  'volFullName',
  'volEmail',
  'volPhone',
  'volLocation',
  'volTitle',
  'volOrganization',
  'volLinkedin',
  'volResume',
  'volTaskGroup',
  'volOutreachExp',
  'volPublicSpeaking',
  'volPortfolio',
  'volLegislativeExp',
  'volExperience',
  'volSkills',
  'volCommitConfirm',
  'volHearAbout',
  'volCheckCOI',
  'volCheckConf',
  'volCheckNP',
  'signatureCanvas'
];

for (const id of formElementIds) {
  requireIncludes('volunteer.html', files.html, `id="${id}"`);
  requireIncludes('js/volunteer.js', files.volunteerJs, `'${id}'`);
}

for (const name of ['techSkills', 'policyAreas', 'volMeetingAvail']) {
  requireIncludes('volunteer.html', files.html, `name="${name}"`);
  requireIncludes('js/volunteer.js', files.volunteerJs, `name="${name}"`);
}

for (const value of ['both', 'agenda-only', 'working-only']) {
  requireIncludes('volunteer.html', files.html, `value="${value}"`);
  requireIncludes('google-apps-script/onboarding.gs', files.appsScript, `'${value}'`);
}

requireIncludes('volunteer.html resume limit', files.html, 'max 512KB');
requireIncludes('js/volunteer.js resume limit', files.volunteerJs, 'MAX_RESUME_BYTES = 512 * 1024');

const firestoreFields = [
  'uid',
  'fullName',
  'email',
  'phone',
  'location',
  'professionalTitle',
  'organization',
  'linkedin',
  'resumeBase64',
  'resumeFileName',
  'taskGroup',
  'experience',
  'skills',
  'outreachExperience',
  'publicSpeaking',
  'techSkills',
  'portfolioUrl',
  'legislativeExperience',
  'policyAreas',
  'commitmentConfirmed',
  'meetingAvailability',
  'hearAbout',
  'coiAcknowledged',
  'confidentialityAgreed',
  'nonPartisanPledge',
  'agreementVersion',
  'signatureDataUrl',
  'signedAt',
  'legitimacyScore',
  'legitimacyBreakdown',
  'applicationSchemaVersion',
  'status',
  'submittedBy',
  'submittedByEmail',
  'submittedByDisplayName',
  'sourceUrl',
  'userAgent',
  'submittedAt'
];

for (const field of firestoreFields) {
  requirePattern('js/volunteer.js Firestore payload', files.volunteerJs, new RegExp(`\\b${field}\\s*:`));
}

for (const adminField of [
  'Signed-In Account',
  'Commitment Confirmed',
  'COI Acknowledged',
  'Confidentiality Agreed',
  'Non-Partisan Pledge',
  'Agreement Version',
  'Signed',
  'Resume/CV',
  'Digital Signature'
]) {
  requireIncludes('js/volunteer-admin.js detail panel', files.adminJs, adminField);
}

for (const webhookNeedle of [
  'secret: GAS_SHARED_SECRET',
  "action: 'onboard'",
  'volunteer: {',
  'agreementVersion: vol.agreementVersion'
]) {
  requireIncludes('js/volunteer-admin.js webhook payload', files.adminJs, webhookNeedle);
}

requireIncludes('firestore.rules volunteer create rule', files.rules, 'request.resource.data.uid == request.auth.uid');
requirePattern('js/volunteer.js Firestore uid', files.volunteerJs, /\buid:\s*currentUser\s*\?\s*currentUser\.uid/);
requireIncludes('google-apps-script/onboarding.gs action', files.appsScript, "payload.action === 'onboard'");
requireIncludes('google-apps-script/onboarding.gs availability normalization', files.appsScript, 'function normalizeMeetingAvailability');

if (failures > 0) {
  console.error(`Volunteer workflow verification failed with ${failures} issue(s).`);
  process.exit(1);
}

console.log('Volunteer workflow verification passed.');
