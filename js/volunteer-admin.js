/* ============================================
   SAFE Research Institute - Volunteer Admin Module
   Manages the Volunteer Queue tab in the admin
   panel. Imported by admin.js.
   ============================================ */

import { db } from './firebase-config.js';
import { timeAgo } from './shared.js';
import {
  collection, query, where, orderBy, getDocs,
  doc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// --- EmailJS Config (placeholders) ---
const EMAILJS_SERVICE_ID = 'YOUR_EMAILJS_SERVICE_ID';
const EMAILJS_WELCOME_TEMPLATE_ID = 'YOUR_WELCOME_TEMPLATE';
const GAS_WEBHOOK_URL = ''; // Empty = manual mode, user fills with deployed Apps Script URL
const GOOGLE_CHAT_INVITE_LINK = ''; // Admin configures
const GOOGLE_CALENDAR_LINK = ''; // Admin configures

// --- State ---
let allVolunteers = [];
let currentDetailId = null;

// --- Task Group Labels ---
const TASK_GROUP_LABELS = {
  advocates: 'Advocates - Public Outreach',
  digital: 'Digital - Technical Infrastructure',
  experts: 'Experts - Legislation Analysis',
  general: 'General Volunteer'
};

// --- DOM References ---
const volStatPending = document.getElementById('volStatPending');
const volStatApproved = document.getElementById('volStatApproved');
const volStatRejected = document.getElementById('volStatRejected');
const volStatusFilter = document.getElementById('volStatusFilter');
const volTaskGroupFilter = document.getElementById('volTaskGroupFilter');
const volApplicationList = document.getElementById('volApplicationList');
const volDetailPanel = document.getElementById('volDetailPanel');

// =========================================
// INITIALIZATION
// =========================================

/**
 * Called when admin opens the volunteer queue tab.
 * Loads volunteers and renders the list.
 */
export async function initVolunteerQueue() {
  // Populate task group filter options
  populateTaskGroupFilter();

  // Attach filter listeners
  if (volStatusFilter) {
    volStatusFilter.addEventListener('change', handleFilterChange);
  }
  if (volTaskGroupFilter) {
    volTaskGroupFilter.addEventListener('change', handleFilterChange);
  }

  // Load volunteers with default filter (pending)
  await loadVolunteers('pending', 'all');
}

function populateTaskGroupFilter() {
  if (!volTaskGroupFilter) return;

  // Check if already populated beyond the default "All" option
  if (volTaskGroupFilter.options.length > 1) return;

  Object.entries(TASK_GROUP_LABELS).forEach(([value, label]) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    volTaskGroupFilter.appendChild(opt);
  });
}

async function handleFilterChange() {
  const statusFilter = volStatusFilter ? volStatusFilter.value : 'all';
  const groupFilter = volTaskGroupFilter ? volTaskGroupFilter.value : 'all';
  await loadVolunteers(statusFilter, groupFilter);
}

// =========================================
// LOAD VOLUNTEERS
// =========================================

/**
 * Query Firestore for volunteers, update stats.
 * @param {string} statusFilter - 'all', 'pending', 'approved', 'rejected'
 * @param {string} groupFilter - 'all', 'advocates', 'digital', 'experts', 'general'
 */
export async function loadVolunteers(statusFilter, groupFilter) {
  if (volApplicationList) {
    volApplicationList.replaceChildren();
    const loading = document.createElement('p');
    loading.style.cssText = 'text-align:center;color:var(--silver);padding:40px 0;';
    loading.textContent = 'Loading volunteer applications...';
    volApplicationList.appendChild(loading);
  }

  try {
    // Build query - always order by submission date
    let q;

    if (statusFilter && statusFilter !== 'all') {
      q = query(
        collection(db, 'volunteers'),
        where('status', '==', statusFilter),
        orderBy('submittedAt', 'desc')
      );
    } else {
      q = query(
        collection(db, 'volunteers'),
        orderBy('submittedAt', 'desc')
      );
    }

    const snapshot = await getDocs(q);
    let volunteers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Client-side filter by task group if needed
    if (groupFilter && groupFilter !== 'all') {
      volunteers = volunteers.filter((v) => v.taskGroup === groupFilter);
    }

    allVolunteers = volunteers;

    // Update stats (from all data, not filtered)
    await updateStats();

    // Render list
    renderVolunteerList(volunteers);
  } catch (err) {
    console.error('Error loading volunteers:', err);
    if (volApplicationList) {
      volApplicationList.replaceChildren();
      const errMsg = document.createElement('p');
      errMsg.style.cssText = 'text-align:center;color:var(--red-accent);padding:40px 0;';
      errMsg.textContent = 'Failed to load volunteer applications.';
      volApplicationList.appendChild(errMsg);
    }
  }
}

async function updateStats() {
  try {
    // Count by status
    const pendingQ = query(collection(db, 'volunteers'), where('status', '==', 'pending'));
    const approvedQ = query(collection(db, 'volunteers'), where('status', '==', 'approved'));
    const rejectedQ = query(collection(db, 'volunteers'), where('status', '==', 'rejected'));

    const [pendingSnap, approvedSnap, rejectedSnap] = await Promise.all([
      getDocs(pendingQ),
      getDocs(approvedQ),
      getDocs(rejectedQ)
    ]);

    if (volStatPending) volStatPending.textContent = pendingSnap.size;
    if (volStatApproved) volStatApproved.textContent = approvedSnap.size;
    if (volStatRejected) volStatRejected.textContent = rejectedSnap.size;
  } catch (err) {
    console.warn('Error updating volunteer stats:', err);
  }
}

// =========================================
// RENDER LIST
// =========================================

/**
 * Build volunteer list items with score badges.
 * @param {Array} volunteers
 */
export function renderVolunteerList(volunteers) {
  if (!volApplicationList) return;
  volApplicationList.replaceChildren();

  if (volunteers.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.style.padding = '40px 0';

    const h3 = document.createElement('h3');
    h3.textContent = 'No applications found';
    const p = document.createElement('p');
    p.textContent = 'No volunteer applications match the current filters.';
    p.style.color = 'var(--silver)';

    empty.appendChild(h3);
    empty.appendChild(p);
    volApplicationList.appendChild(empty);
    return;
  }

  volunteers.forEach((vol) => {
    const row = document.createElement('div');
    row.className = 'article-list-item';
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => showVolunteerDetail(vol.id));

    // Info section
    const infoDiv = document.createElement('div');
    infoDiv.className = 'article-list-item-info';

    const titleEl = document.createElement('h4');
    titleEl.className = 'article-list-item-title';
    titleEl.textContent = vol.fullName || 'Unnamed Applicant';

    const metaDiv = document.createElement('div');
    metaDiv.className = 'article-list-item-meta';

    const groupSpan = document.createElement('span');
    groupSpan.className = 'article-list-item-category';
    groupSpan.textContent = TASK_GROUP_LABELS[vol.taskGroup] || vol.taskGroup || '';

    const dateSpan = document.createElement('span');
    dateSpan.className = 'article-list-item-date';
    dateSpan.textContent = vol.submittedAt ? timeAgo(vol.submittedAt) : 'Pending';

    const emailSpan = document.createElement('span');
    emailSpan.style.cssText = 'color:var(--silver);font-size:0.82rem;';
    emailSpan.textContent = vol.email || '';

    metaDiv.appendChild(groupSpan);
    metaDiv.appendChild(emailSpan);
    metaDiv.appendChild(dateSpan);

    infoDiv.appendChild(titleEl);
    infoDiv.appendChild(metaDiv);

    // Right side: score badge + status
    const rightDiv = document.createElement('div');
    rightDiv.style.cssText = 'display:flex;gap:12px;align-items:center;flex-shrink:0;';

    // Score badge
    const scoreBadge = document.createElement('span');
    const score = vol.legitimacyScore || 0;
    scoreBadge.style.cssText = `
      display:inline-flex;align-items:center;justify-content:center;
      width:36px;height:36px;border-radius:50%;font-weight:700;font-size:0.85rem;
      background:${score >= 7 ? 'rgba(39,174,96,0.1)' : score >= 4 ? 'rgba(200,168,85,0.15)' : 'rgba(192,57,43,0.1)'};
      color:${score >= 7 ? 'var(--green-muted)' : score >= 4 ? 'var(--accent-dark)' : 'var(--red-accent)'};
      border:1px solid ${score >= 7 ? 'rgba(39,174,96,0.2)' : score >= 4 ? 'rgba(200,168,85,0.25)' : 'rgba(192,57,43,0.2)'};
    `;
    scoreBadge.textContent = score;
    scoreBadge.title = 'Legitimacy Score';

    // Status badge
    const statusBadge = document.createElement('span');
    const statusClass = vol.status === 'approved' ? 'status-published' : vol.status === 'rejected' ? 'status-rejected' : 'status-pending';
    statusBadge.className = 'status-badge ' + statusClass;
    statusBadge.textContent = (vol.status || 'pending').charAt(0).toUpperCase() + (vol.status || 'pending').slice(1);

    rightDiv.appendChild(scoreBadge);
    rightDiv.appendChild(statusBadge);

    row.appendChild(infoDiv);
    row.appendChild(rightDiv);
    volApplicationList.appendChild(row);
  });
}

// =========================================
// DETAIL PANEL
// =========================================

/**
 * Show expanded detail panel for a volunteer.
 * @param {string} volunteerId
 */
export function showVolunteerDetail(volunteerId) {
  const vol = allVolunteers.find((v) => v.id === volunteerId);
  if (!vol || !volDetailPanel) return;

  currentDetailId = volunteerId;
  volDetailPanel.style.display = '';
  volDetailPanel.replaceChildren();

  // Build detail panel
  const panel = document.createElement('div');
  panel.className = 'vol-detail-panel';

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn btn-sm btn-dark';
  closeBtn.textContent = 'Close';
  closeBtn.style.marginBottom = '20px';
  closeBtn.addEventListener('click', () => {
    volDetailPanel.style.display = 'none';
    currentDetailId = null;
  });
  panel.appendChild(closeBtn);

  // Header
  const header = document.createElement('h3');
  header.style.cssText = 'font-size:1.3rem;margin-bottom:4px;';
  header.textContent = vol.fullName || 'Unnamed Applicant';
  panel.appendChild(header);

  const subHeader = document.createElement('p');
  subHeader.style.cssText = 'color:var(--silver);margin-bottom:24px;font-size:0.9rem;';
  subHeader.textContent = `${vol.professionalTitle || ''} ${vol.organization ? '| ' + vol.organization : ''} | ${TASK_GROUP_LABELS[vol.taskGroup] || vol.taskGroup}`;
  panel.appendChild(subHeader);

  // Detail grid
  const grid = document.createElement('div');
  grid.className = 'vol-detail-grid';

  const fields = [
    { label: 'Email', value: vol.email },
    { label: 'Phone', value: vol.phone || 'Not provided' },
    { label: 'Location', value: vol.location },
    { label: 'Professional Title', value: vol.professionalTitle },
    { label: 'Organization', value: vol.organization || 'Not provided' },
    { label: 'Task Group', value: TASK_GROUP_LABELS[vol.taskGroup] || vol.taskGroup },
    { label: 'Meeting Availability', value: vol.meetingAvailability || 'Not specified' },
    { label: 'How Heard About SAFE', value: vol.hearAbout || 'Not provided' },
    { label: 'Status', value: (vol.status || 'pending').charAt(0).toUpperCase() + (vol.status || 'pending').slice(1) },
    { label: 'Submitted', value: vol.submittedAt ? new Date(vol.submittedAt.toDate ? vol.submittedAt.toDate() : vol.submittedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown' }
  ];

  fields.forEach(({ label, value }) => {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'vol-detail-field';

    const labelEl = document.createElement('div');
    labelEl.className = 'vol-detail-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('div');
    valueEl.className = 'vol-detail-value';
    valueEl.textContent = value;

    fieldDiv.appendChild(labelEl);
    fieldDiv.appendChild(valueEl);
    grid.appendChild(fieldDiv);
  });

  panel.appendChild(grid);

  // LinkedIn link
  if (vol.linkedin) {
    const linkedinDiv = document.createElement('div');
    linkedinDiv.style.cssText = 'margin:16px 0;';
    const linkedinLink = document.createElement('a');
    linkedinLink.href = vol.linkedin;
    linkedinLink.target = '_blank';
    linkedinLink.rel = 'noopener noreferrer';
    linkedinLink.textContent = 'View LinkedIn Profile';
    linkedinLink.style.cssText = 'color:var(--blue-link);font-weight:500;';
    linkedinDiv.appendChild(linkedinLink);
    panel.appendChild(linkedinDiv);
  }

  // Experience
  if (vol.experience) {
    const expSection = document.createElement('div');
    expSection.style.cssText = 'margin:20px 0;';

    const expLabel = document.createElement('div');
    expLabel.className = 'vol-detail-label';
    expLabel.textContent = 'Relevant Experience';
    expSection.appendChild(expLabel);

    const expValue = document.createElement('p');
    expValue.style.cssText = 'color:var(--slate);line-height:1.7;margin-top:4px;';
    expValue.textContent = vol.experience;
    expSection.appendChild(expValue);

    panel.appendChild(expSection);
  }

  // Skills
  if (vol.skills) {
    const skillSection = document.createElement('div');
    skillSection.style.cssText = 'margin:16px 0;';

    const skillLabel = document.createElement('div');
    skillLabel.className = 'vol-detail-label';
    skillLabel.textContent = 'Skills & Expertise';
    skillSection.appendChild(skillLabel);

    const skillValue = document.createElement('p');
    skillValue.style.cssText = 'color:var(--slate);line-height:1.7;margin-top:4px;';
    skillValue.textContent = vol.skills;
    skillSection.appendChild(skillValue);

    panel.appendChild(skillSection);
  }

  // Conditional group-specific fields
  if (vol.taskGroup === 'advocates') {
    if (vol.outreachExperience) {
      appendTextSection(panel, 'Outreach Experience', vol.outreachExperience);
    }
    appendTextSection(panel, 'Public Speaking', vol.publicSpeaking ? 'Yes' : 'No');
  }

  if (vol.taskGroup === 'digital') {
    if (vol.techSkills && vol.techSkills.length > 0) {
      appendTextSection(panel, 'Technical Skills', vol.techSkills.join(', '));
    }
    if (vol.portfolioUrl) {
      const portDiv = document.createElement('div');
      portDiv.style.cssText = 'margin:12px 0;';
      const portLabel = document.createElement('div');
      portLabel.className = 'vol-detail-label';
      portLabel.textContent = 'Portfolio';
      portDiv.appendChild(portLabel);
      const portLink = document.createElement('a');
      portLink.href = vol.portfolioUrl;
      portLink.target = '_blank';
      portLink.rel = 'noopener noreferrer';
      portLink.textContent = vol.portfolioUrl;
      portLink.style.cssText = 'color:var(--blue-link);word-break:break-all;';
      portDiv.appendChild(portLink);
      panel.appendChild(portDiv);
    }
  }

  if (vol.taskGroup === 'experts') {
    if (vol.legislativeExperience) {
      appendTextSection(panel, 'Legislative Experience', vol.legislativeExperience);
    }
    if (vol.policyAreas && vol.policyAreas.length > 0) {
      appendTextSection(panel, 'Policy Areas', vol.policyAreas.join(', '));
    }
  }

  // Score breakdown
  const scoreSection = document.createElement('div');
  scoreSection.style.cssText = 'margin:24px 0;';

  const scoreTitle = document.createElement('div');
  scoreTitle.className = 'vol-detail-label';
  scoreTitle.textContent = `Legitimacy Score: ${vol.legitimacyScore || 0} / 10`;
  scoreTitle.style.marginBottom = '12px';
  scoreSection.appendChild(scoreTitle);

  const scoreBreakdown = document.createElement('div');
  scoreBreakdown.className = 'vol-score-breakdown';

  if (vol.legitimacyBreakdown) {
    Object.values(vol.legitimacyBreakdown).forEach((criterion) => {
      const bar = document.createElement('div');
      bar.className = 'vol-score-bar';

      const barLabel = document.createElement('span');
      barLabel.style.cssText = 'font-size:0.82rem;color:var(--steel);min-width:220px;';
      barLabel.textContent = criterion.label;

      const barTrack = document.createElement('div');
      barTrack.style.cssText = 'flex:1;height:8px;background:var(--light-gray);border-radius:4px;overflow:hidden;';

      const barFill = document.createElement('div');
      barFill.className = 'vol-score-bar-fill';
      const maxPts = criterion.label.includes('120') || criterion.label.includes('depth') ? 2 : criterion.label.includes('optional') || criterion.label.includes('title') ? 1 : 2;
      barFill.style.cssText = `width:${(criterion.points / Math.max(maxPts, 1)) * 100}%;height:100%;background:${criterion.points > 0 ? 'var(--accent)' : 'var(--light-gray)'};border-radius:4px;transition:width 0.3s;`;

      barTrack.appendChild(barFill);

      const pts = document.createElement('span');
      pts.style.cssText = 'font-size:0.82rem;font-weight:600;min-width:30px;text-align:right;';
      pts.textContent = `+${criterion.points}`;

      bar.appendChild(barLabel);
      bar.appendChild(barTrack);
      bar.appendChild(pts);
      scoreBreakdown.appendChild(bar);
    });
  }

  scoreSection.appendChild(scoreBreakdown);
  panel.appendChild(scoreSection);

  // Signature preview
  if (vol.signatureDataUrl) {
    const sigSection = document.createElement('div');
    sigSection.style.cssText = 'margin:20px 0;';

    const sigLabel = document.createElement('div');
    sigLabel.className = 'vol-detail-label';
    sigLabel.textContent = 'Digital Signature';
    sigLabel.style.marginBottom = '8px';
    sigSection.appendChild(sigLabel);

    const sigImg = document.createElement('img');
    sigImg.src = vol.signatureDataUrl;
    sigImg.alt = 'Volunteer signature';
    sigImg.className = 'vol-signature-preview';
    sigSection.appendChild(sigImg);

    panel.appendChild(sigSection);
  }

  // Resume download
  if (vol.resumeBase64 && vol.resumeFileName) {
    const resumeSection = document.createElement('div');
    resumeSection.style.cssText = 'margin:16px 0;';

    const resumeLabel = document.createElement('div');
    resumeLabel.className = 'vol-detail-label';
    resumeLabel.textContent = 'Resume/CV';
    resumeLabel.style.marginBottom = '4px';
    resumeSection.appendChild(resumeLabel);

    const resumeLink = document.createElement('a');
    resumeLink.href = vol.resumeBase64;
    resumeLink.download = vol.resumeFileName;
    resumeLink.textContent = vol.resumeFileName;
    resumeLink.style.cssText = 'color:var(--blue-link);font-weight:500;';
    resumeSection.appendChild(resumeLink);

    panel.appendChild(resumeSection);
  }

  // Admin notes
  const notesSection = document.createElement('div');
  notesSection.className = 'vol-admin-notes';

  const notesLabel = document.createElement('label');
  notesLabel.className = 'vol-detail-label';
  notesLabel.textContent = 'Admin Notes';
  notesLabel.style.marginBottom = '8px';
  notesLabel.style.display = 'block';
  notesSection.appendChild(notesLabel);

  const notesTextarea = document.createElement('textarea');
  notesTextarea.className = 'form-control';
  notesTextarea.id = 'volAdminNotes';
  notesTextarea.rows = 3;
  notesTextarea.placeholder = 'Add notes about this applicant...';
  notesTextarea.value = vol.adminNotes || '';
  notesSection.appendChild(notesTextarea);

  panel.appendChild(notesSection);

  // Action buttons
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'vol-admin-actions';

  if (vol.status === 'pending') {
    const approveBtn = document.createElement('button');
    approveBtn.type = 'button';
    approveBtn.className = 'btn btn-primary';
    approveBtn.style.cssText = 'background:var(--green-muted);border-color:var(--green-muted);';
    approveBtn.textContent = 'Approve and Onboard';
    approveBtn.addEventListener('click', () => approveVolunteer(vol.id));

    const rejectBtn = document.createElement('button');
    rejectBtn.type = 'button';
    rejectBtn.className = 'btn btn-danger';
    rejectBtn.style.cssText = 'background:var(--red-accent);border-color:var(--red-accent);color:#fff;padding:12px 28px;border-radius:var(--radius-sm);font-weight:600;cursor:pointer;';
    rejectBtn.textContent = 'Reject';
    rejectBtn.addEventListener('click', () => {
      const notes = document.getElementById('volAdminNotes');
      rejectVolunteer(vol.id, notes ? notes.value : '');
    });

    actionsDiv.appendChild(approveBtn);
    actionsDiv.appendChild(rejectBtn);
  } else {
    const statusInfo = document.createElement('p');
    statusInfo.style.cssText = 'color:var(--silver);font-style:italic;';
    statusInfo.textContent = `This application has been ${vol.status}.`;
    actionsDiv.appendChild(statusInfo);
  }

  panel.appendChild(actionsDiv);
  volDetailPanel.appendChild(panel);

  // Scroll detail into view
  volDetailPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function appendTextSection(parent, label, value) {
  const section = document.createElement('div');
  section.style.cssText = 'margin:12px 0;';

  const labelEl = document.createElement('div');
  labelEl.className = 'vol-detail-label';
  labelEl.textContent = label;
  section.appendChild(labelEl);

  const valueEl = document.createElement('p');
  valueEl.style.cssText = 'color:var(--slate);line-height:1.7;margin-top:4px;';
  valueEl.textContent = value;
  section.appendChild(valueEl);

  parent.appendChild(section);
}

// =========================================
// APPROVE / REJECT
// =========================================

/**
 * Approve a volunteer and send welcome email.
 * @param {string} volunteerId
 */
export async function approveVolunteer(volunteerId) {
  const vol = allVolunteers.find((v) => v.id === volunteerId);
  if (!vol) return;

  try {
    const notes = document.getElementById('volAdminNotes');
    const volRef = doc(db, 'volunteers', volunteerId);
    await updateDoc(volRef, {
      status: 'approved',
      adminNotes: notes ? notes.value : '',
      reviewedAt: serverTimestamp(),
      reviewedBy: 'admin'
    });

    // Send welcome email via EmailJS
    try {
      if (typeof emailjs !== 'undefined' && EMAILJS_SERVICE_ID !== 'YOUR_EMAILJS_SERVICE_ID') {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_WELCOME_TEMPLATE_ID, {
          to_email: vol.email,
          volunteer_name: vol.fullName,
          task_group: TASK_GROUP_LABELS[vol.taskGroup] || vol.taskGroup,
          google_chat_link: GOOGLE_CHAT_INVITE_LINK || 'Link will be provided by your team lead.',
          calendar_link: GOOGLE_CALENDAR_LINK || 'Calendar invite will be sent separately.'
        });
      }
    } catch (emailErr) {
      console.warn('Welcome email failed (non-critical):', emailErr);
    }

    // Call webhook if configured
    if (GAS_WEBHOOK_URL) {
      try {
        await fetch(GAS_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          mode: 'no-cors',
          body: JSON.stringify({
            action: 'volunteer_approved',
            volunteerId: volunteerId,
            name: vol.fullName,
            email: vol.email,
            taskGroup: vol.taskGroup,
            score: vol.legitimacyScore
          })
        });
      } catch (webhookErr) {
        console.warn('Webhook call failed (non-critical):', webhookErr);
      }
    }

    // Refresh list
    await handleFilterChange();

    // Close detail panel
    volDetailPanel.style.display = 'none';
    currentDetailId = null;

  } catch (err) {
    console.error('Error approving volunteer:', err);
    alert('Failed to approve volunteer. Please try again.');
  }
}

/**
 * Reject a volunteer with optional reason.
 * @param {string} volunteerId
 * @param {string} reason
 */
export async function rejectVolunteer(volunteerId, reason) {
  try {
    const volRef = doc(db, 'volunteers', volunteerId);
    await updateDoc(volRef, {
      status: 'rejected',
      adminNotes: reason || '',
      reviewedAt: serverTimestamp(),
      reviewedBy: 'admin'
    });

    // Refresh list
    await handleFilterChange();

    // Close detail panel
    volDetailPanel.style.display = 'none';
    currentDetailId = null;

  } catch (err) {
    console.error('Error rejecting volunteer:', err);
    alert('Failed to reject volunteer. Please try again.');
  }
}
