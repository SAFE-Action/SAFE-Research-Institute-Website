/* ============================================
   SAFE Research Institute - Admin Panel
   Manages blog queue, policies, videos, users,
   and volunteer queue from a single dashboard.
   ============================================ */

import { db, auth } from './firebase-config.js';
import { signInWithGoogle, logOut, onAuth, isAdmin } from './auth.js';
import { extractYouTubeId, timeAgo } from './shared.js';
import { initVolunteerQueue, loadVolunteers } from './volunteer-admin.js';
import {
  collection, query, where, orderBy, getDocs, doc, getDoc, setDoc,
  updateDoc, deleteDoc, addDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// --- DOM References ---
const authGate = document.getElementById('authGate');
const accessDenied = document.getElementById('accessDenied');
const adminDashboard = document.getElementById('adminDashboard');
const googleSignInBtn = document.getElementById('googleSignInBtn');
const adminSignOutBtn = document.getElementById('adminSignOutBtn');
const accessDeniedSignOut = document.getElementById('accessDeniedSignOut');
const adminUserPhoto = document.getElementById('adminUserPhoto');
const adminUserName = document.getElementById('adminUserName');
const adminUserEmail = document.getElementById('adminUserEmail');

// Tab elements
const tabButtons = document.querySelectorAll('.admin-tab');
const tabContents = document.querySelectorAll('.admin-tab-content');

// Confirm dialog
const confirmDialog = document.getElementById('confirmDialog');
const confirmBackdrop = document.getElementById('confirmBackdrop');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const confirmYes = document.getElementById('confirmYes');
const confirmNo = document.getElementById('confirmNo');

// --- State ---
let currentUser = null;
let currentAdminStatus = false;
let pendingArticles = [];
let allPolicies = [];
let allVideos = [];
let allUsers = [];
let policyEasyMDE = null;
let policyMDEInitialized = false;
let currentPreviewArticleId = null;
let confirmResolve = null;

// US states list for checkboxes
const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
  'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
  'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
  'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
  'Wisconsin','Wyoming','All States'
];

// =========================================
// AUTH
// =========================================

onAuth(async (user) => {
  currentUser = user;

  if (user) {
    // Check admin status
    currentAdminStatus = await isAdmin(user.uid);

    if (currentAdminStatus) {
      // Show admin dashboard
      authGate.style.display = 'none';
      accessDenied.style.display = 'none';
      adminDashboard.style.display = '';

      // Populate user bar
      adminUserPhoto.src = user.photoURL || '';
      adminUserPhoto.alt = user.displayName || 'Admin';
      adminUserName.textContent = user.displayName || 'Admin';
      adminUserEmail.textContent = user.email || '';

      // Load data for the active tab
      loadActiveTabData();
    } else {
      // Signed in but not admin
      authGate.style.display = 'none';
      accessDenied.style.display = '';
      adminDashboard.style.display = 'none';
    }
  } else {
    // Not signed in
    authGate.style.display = '';
    accessDenied.style.display = 'none';
    adminDashboard.style.display = 'none';
    currentAdminStatus = false;
  }
});

googleSignInBtn.addEventListener('click', async () => {
  try {
    await signInWithGoogle();
  } catch (err) {
    console.error('Sign-in failed:', err);
  }
});

adminSignOutBtn.addEventListener('click', async () => {
  try {
    await logOut();
  } catch (err) {
    console.error('Sign-out failed:', err);
  }
});

accessDeniedSignOut.addEventListener('click', async () => {
  try {
    await logOut();
  } catch (err) {
    console.error('Sign-out failed:', err);
  }
});

// =========================================
// TAB SWITCHING
// =========================================

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const targetTab = btn.dataset.tab;

    // Update tab button states
    tabButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    // Update tab content panels
    tabContents.forEach((panel) => {
      panel.classList.remove('active');
    });
    const targetPanel = document.getElementById('tab-' + targetTab);
    if (targetPanel) {
      targetPanel.classList.add('active');
    }

    // Load data for the newly selected tab
    loadTabData(targetTab);
  });
});

function getActiveTab() {
  const activeBtn = document.querySelector('.admin-tab.active');
  return activeBtn ? activeBtn.dataset.tab : 'blog-queue';
}

function loadActiveTabData() {
  loadTabData(getActiveTab());
}

function loadTabData(tabName) {
  switch (tabName) {
    case 'blog-queue':
      loadPendingArticles();
      break;
    case 'policy-editor':
      loadPolicies();
      break;
    case 'video-manager':
      loadVideos();
      break;
    case 'users':
      loadUsers();
      break;
    case 'volunteer-queue':
      initVolunteerQueue();
      break;
  }
}

// =========================================
// CONFIRMATION DIALOG
// =========================================

function showConfirmDialog(title, message) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmDialog.style.display = '';

  return new Promise((resolve) => {
    confirmResolve = resolve;
  });
}

function hideConfirmDialog() {
  confirmDialog.style.display = 'none';
  confirmResolve = null;
}

confirmYes.addEventListener('click', () => {
  if (confirmResolve) confirmResolve(true);
  hideConfirmDialog();
});

confirmNo.addEventListener('click', () => {
  if (confirmResolve) confirmResolve(false);
  hideConfirmDialog();
});

confirmBackdrop.addEventListener('click', () => {
  if (confirmResolve) confirmResolve(false);
  hideConfirmDialog();
});

// =========================================
// HELPER: Format date
// =========================================

function formatDate(timestamp) {
  if (!timestamp) return '';
  let date;
  if (timestamp && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    date = new Date(timestamp);
  }
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// =========================================
// HELPER: Sanitize + render markdown safely
// Uses DOMPurify to sanitize, then a
// <template> element for safe DOM insertion.
// This is the same pattern as policies.js.
// =========================================

function sanitizeHtml(html) {
  if (typeof DOMPurify !== 'undefined') {
    return DOMPurify.sanitize(html);
  }
  // Fallback: strip all tags
  const div = document.createElement('div');
  div.textContent = html;
  return div.textContent;
}

/**
 * Render sanitized Markdown content into a container.
 * Parses Markdown with marked.js, sanitizes with DOMPurify,
 * then inserts via <template> element for safe DOM insertion.
 * @param {HTMLElement} container - Target container.
 * @param {string} markdownText - Raw Markdown string.
 */
function renderMarkdownSafe(container, markdownText) {
  container.replaceChildren();
  if (markdownText && typeof marked !== 'undefined') {
    const rawHtml = marked.parse(markdownText);
    const safeHtml = sanitizeHtml(rawHtml);
    // Use DOMParser for safe insertion (same pattern as policies.js renderSanitizedContent)
    const parser = new DOMParser();
    const parsedDoc = parser.parseFromString(safeHtml, 'text/html');
    while (parsedDoc.body.firstChild) {
      container.appendChild(parsedDoc.body.firstChild);
    }
  } else {
    const p = document.createElement('p');
    p.textContent = markdownText || 'No content available.';
    container.appendChild(p);
  }
}

// =========================================
// TAB 1: BLOG QUEUE
// =========================================

const pendingArticlesList = document.getElementById('pendingArticlesList');
const pendingArticlesEmpty = document.getElementById('pendingArticlesEmpty');
const articlePreviewPanel = document.getElementById('articlePreviewPanel');
const previewTitle = document.getElementById('previewTitle');
const previewMeta = document.getElementById('previewMeta');
const previewBody = document.getElementById('previewBody');
const closePreviewBtn = document.getElementById('closePreviewBtn');
const approveArticleBtn = document.getElementById('approveArticleBtn');
const rejectArticleBtn = document.getElementById('rejectArticleBtn');

async function loadPendingArticles() {
  pendingArticlesList.replaceChildren();
  const loading = document.createElement('p');
  loading.style.cssText = 'text-align:center;color:var(--silver);padding:40px 0;';
  loading.textContent = 'Loading pending articles...';
  pendingArticlesList.appendChild(loading);
  pendingArticlesEmpty.style.display = 'none';
  articlePreviewPanel.style.display = 'none';

  try {
    const q = query(
      collection(db, 'articles'),
      where('status', '==', 'pending_review'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);

    pendingArticles = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderArticleList();
  } catch (err) {
    console.error('Error loading pending articles:', err);
    pendingArticlesList.replaceChildren();
    const errMsg = document.createElement('p');
    errMsg.style.cssText = 'text-align:center;color:var(--red-accent);padding:40px 0;';
    errMsg.textContent = 'Failed to load articles.';
    pendingArticlesList.appendChild(errMsg);
  }
}

function renderArticleList() {
  pendingArticlesList.replaceChildren();

  if (pendingArticles.length === 0) {
    pendingArticlesEmpty.style.display = '';
    return;
  }

  pendingArticlesEmpty.style.display = 'none';

  pendingArticles.forEach((article) => {
    const row = document.createElement('div');
    row.className = 'article-list-item';

    const infoDiv = document.createElement('div');
    infoDiv.className = 'article-list-item-info';

    const titleEl = document.createElement('h4');
    titleEl.className = 'article-list-item-title';
    titleEl.textContent = article.title || 'Untitled';

    const metaDiv = document.createElement('div');
    metaDiv.className = 'article-list-item-meta';

    const authorSpan = document.createElement('span');
    authorSpan.textContent = article.authorName || 'Unknown Author';

    const categorySpan = document.createElement('span');
    categorySpan.className = 'article-list-item-category';
    categorySpan.textContent = article.category || '';

    const dateSpan = document.createElement('span');
    dateSpan.className = 'article-list-item-date';
    dateSpan.textContent = article.createdAt ? formatDate(article.createdAt) : 'Pending';

    metaDiv.appendChild(authorSpan);
    metaDiv.appendChild(categorySpan);
    metaDiv.appendChild(dateSpan);

    infoDiv.appendChild(titleEl);
    infoDiv.appendChild(metaDiv);

    const actionsDiv = document.createElement('div');
    actionsDiv.style.cssText = 'display:flex;gap:8px;align-items:center;flex-shrink:0;';

    const previewBtn = document.createElement('button');
    previewBtn.className = 'admin-btn-edit';
    previewBtn.type = 'button';
    previewBtn.textContent = 'Preview';
    previewBtn.addEventListener('click', () => previewArticle(article.id));

    const approveBtn = document.createElement('button');
    approveBtn.className = 'btn btn-primary';
    approveBtn.type = 'button';
    approveBtn.textContent = 'Approve';
    approveBtn.style.cssText = 'padding:8px 16px;font-size:0.82rem;';
    approveBtn.addEventListener('click', () => approveArticle(article.id));

    const rejectBtn = document.createElement('button');
    rejectBtn.className = 'admin-btn-delete';
    rejectBtn.type = 'button';
    rejectBtn.textContent = 'Reject';
    rejectBtn.addEventListener('click', () => rejectArticle(article.id));

    actionsDiv.appendChild(previewBtn);
    actionsDiv.appendChild(approveBtn);
    actionsDiv.appendChild(rejectBtn);

    row.appendChild(infoDiv);
    row.appendChild(actionsDiv);
    pendingArticlesList.appendChild(row);
  });
}

function previewArticle(articleId) {
  const article = pendingArticles.find(a => a.id === articleId);
  if (!article) return;

  currentPreviewArticleId = articleId;

  previewTitle.textContent = article.title || 'Untitled';

  previewMeta.replaceChildren();
  const metaText = document.createElement('span');
  metaText.textContent = [
    article.authorName || 'Unknown',
    article.category || '',
    article.createdAt ? formatDate(article.createdAt) : ''
  ].filter(Boolean).join(' \u2022 ');
  previewMeta.appendChild(metaText);

  renderMarkdownSafe(previewBody, article.body);

  articlePreviewPanel.style.display = '';
  articlePreviewPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

closePreviewBtn.addEventListener('click', () => {
  articlePreviewPanel.style.display = 'none';
  currentPreviewArticleId = null;
});

approveArticleBtn.addEventListener('click', async () => {
  if (!currentPreviewArticleId) return;
  await approveArticle(currentPreviewArticleId);
});

rejectArticleBtn.addEventListener('click', async () => {
  if (!currentPreviewArticleId) return;
  await rejectArticle(currentPreviewArticleId);
});

async function approveArticle(articleId) {
  try {
    const articleRef = doc(db, 'articles', articleId);
    await updateDoc(articleRef, {
      status: 'published',
      publishedAt: serverTimestamp()
    });

    // Remove from local list
    pendingArticles = pendingArticles.filter(a => a.id !== articleId);
    renderArticleList();

    // Hide preview if it was showing this article
    if (currentPreviewArticleId === articleId) {
      articlePreviewPanel.style.display = 'none';
      currentPreviewArticleId = null;
    }
  } catch (err) {
    console.error('Error approving article:', err);
  }
}

async function rejectArticle(articleId) {
  try {
    const articleRef = doc(db, 'articles', articleId);
    await updateDoc(articleRef, {
      status: 'rejected'
    });

    // Remove from local list
    pendingArticles = pendingArticles.filter(a => a.id !== articleId);
    renderArticleList();

    // Hide preview if it was showing this article
    if (currentPreviewArticleId === articleId) {
      articlePreviewPanel.style.display = 'none';
      currentPreviewArticleId = null;
    }
  } catch (err) {
    console.error('Error rejecting article:', err);
  }
}

// =========================================
// TAB 2: POLICY EDITOR
// =========================================

const policyTableContainer = document.getElementById('policyTableContainer');
const policyTableEmpty = document.getElementById('policyTableEmpty');
const policyFormContainer = document.getElementById('policyFormContainer');
const policyForm = document.getElementById('policyForm');
const policyFormTitle = document.getElementById('policyFormTitle');
const policyEditId = document.getElementById('policyEditId');
const policyTitleInput = document.getElementById('policyTitleInput');
const policyCategoryInput = document.getElementById('policyCategoryInput');
const policySummaryInput = document.getElementById('policySummaryInput');
const policyBodyInput = document.getElementById('policyBodyInput');
const policyPdfInput = document.getElementById('policyPdfInput');
const policyStatusInput = document.getElementById('policyStatusInput');
const addPolicyBtn = document.getElementById('addPolicyBtn');
const cancelPolicyBtn = document.getElementById('cancelPolicyBtn');
const stateCheckboxes = document.getElementById('stateCheckboxes');

// Build state checkboxes
function buildStateCheckboxes() {
  stateCheckboxes.replaceChildren();
  US_STATES.forEach((state) => {
    const label = document.createElement('label');
    label.className = 'admin-checkbox-label';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = state;
    cb.name = 'stateApplicability';

    const span = document.createElement('span');
    span.textContent = state;

    label.appendChild(cb);
    label.appendChild(span);
    stateCheckboxes.appendChild(label);
  });
}

buildStateCheckboxes();

function getSelectedStates() {
  const checkboxes = stateCheckboxes.querySelectorAll('input[name="stateApplicability"]:checked');
  return Array.from(checkboxes).map(cb => cb.value);
}

function setSelectedStates(states) {
  const checkboxes = stateCheckboxes.querySelectorAll('input[name="stateApplicability"]');
  checkboxes.forEach(cb => {
    cb.checked = states.includes(cb.value);
  });
}

async function loadPolicies() {
  policyTableContainer.replaceChildren();
  const loading = document.createElement('p');
  loading.style.cssText = 'text-align:center;color:var(--silver);padding:40px 0;';
  loading.textContent = 'Loading policies...';
  policyTableContainer.appendChild(loading);
  policyTableEmpty.style.display = 'none';

  try {
    const q = query(collection(db, 'policies'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    allPolicies = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPolicyTable();
  } catch (err) {
    console.error('Error loading policies:', err);
    policyTableContainer.replaceChildren();
    const errMsg = document.createElement('p');
    errMsg.style.cssText = 'text-align:center;color:var(--red-accent);padding:40px 0;';
    errMsg.textContent = 'Failed to load policies.';
    policyTableContainer.appendChild(errMsg);
  }
}

function renderPolicyTable() {
  policyTableContainer.replaceChildren();

  if (allPolicies.length === 0) {
    policyTableEmpty.style.display = '';
    return;
  }

  policyTableEmpty.style.display = 'none';

  const table = document.createElement('table');
  table.className = 'admin-table';

  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Title', 'Category', 'Status', 'Date', 'Actions'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  allPolicies.forEach((policy) => {
    const row = document.createElement('tr');

    const tdTitle = document.createElement('td');
    tdTitle.textContent = policy.title || 'Untitled';
    row.appendChild(tdTitle);

    const tdCat = document.createElement('td');
    tdCat.textContent = policy.category || '';
    row.appendChild(tdCat);

    const tdStatus = document.createElement('td');
    const statusBadge = document.createElement('span');
    statusBadge.className = 'status-badge ' + (policy.status === 'published' ? 'status-published' : 'status-draft');
    statusBadge.textContent = policy.status === 'published' ? 'Published' : 'Draft';
    tdStatus.appendChild(statusBadge);
    row.appendChild(tdStatus);

    const tdDate = document.createElement('td');
    tdDate.textContent = policy.createdAt ? formatDate(policy.createdAt) : '';
    row.appendChild(tdDate);

    const tdActions = document.createElement('td');
    tdActions.style.cssText = 'display:flex;gap:8px;';

    const editBtn = document.createElement('button');
    editBtn.className = 'admin-btn-edit';
    editBtn.type = 'button';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => showPolicyForm(policy.id));

    const delBtn = document.createElement('button');
    delBtn.className = 'admin-btn-delete';
    delBtn.type = 'button';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => deletePolicy(policy.id));

    tdActions.appendChild(editBtn);
    tdActions.appendChild(delBtn);
    row.appendChild(tdActions);

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  policyTableContainer.appendChild(table);
}

function initPolicyEasyMDE() {
  if (policyMDEInitialized) return;

  const textarea = document.getElementById('policyBodyInput');
  if (!textarea) return;

  policyEasyMDE = new EasyMDE({
    element: textarea,
    placeholder: 'Write the policy body in Markdown...',
    spellChecker: false,
    autosave: { enabled: false },
    status: ['lines', 'words'],
    toolbar: [
      'bold', 'italic', 'heading', '|',
      'quote', 'unordered-list', 'ordered-list', '|',
      'link', 'image', 'table', '|',
      'preview', 'side-by-side', 'fullscreen', '|',
      'guide'
    ],
    minHeight: '250px'
  });

  policyMDEInitialized = true;
}

function showPolicyForm(policyId) {
  policyFormContainer.style.display = '';
  initPolicyEasyMDE();

  if (policyId) {
    // Editing existing policy
    const policy = allPolicies.find(p => p.id === policyId);
    if (!policy) return;

    policyFormTitle.textContent = 'Edit Policy';
    policyEditId.value = policyId;
    policyTitleInput.value = policy.title || '';
    policyCategoryInput.value = policy.category || '';
    policySummaryInput.value = policy.summary || '';
    policyPdfInput.value = policy.pdfUrl || '';
    policyStatusInput.value = policy.status || 'draft';
    setSelectedStates(policy.stateApplicability || []);

    if (policyEasyMDE) {
      policyEasyMDE.value(policy.body || '');
    }
  } else {
    // New policy
    policyFormTitle.textContent = 'Add New Policy';
    policyEditId.value = '';
    policyForm.reset();
    setSelectedStates([]);

    if (policyEasyMDE) {
      policyEasyMDE.value('');
    }
  }

  policyFormContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

addPolicyBtn.addEventListener('click', () => showPolicyForm(null));

cancelPolicyBtn.addEventListener('click', () => {
  policyFormContainer.style.display = 'none';
});

policyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  await savePolicyForm();
});

async function savePolicyForm() {
  const editId = policyEditId.value;
  const title = policyTitleInput.value.trim();
  const category = policyCategoryInput.value;
  const summary = policySummaryInput.value.trim();
  const body = policyEasyMDE ? policyEasyMDE.value().trim() : '';
  const pdfUrl = policyPdfInput.value.trim();
  const status = policyStatusInput.value;
  const stateApplicability = getSelectedStates();

  if (!title || !category || !summary) {
    return;
  }

  const savePolicyBtn = document.getElementById('savePolicyBtn');
  savePolicyBtn.disabled = true;
  savePolicyBtn.textContent = 'Saving...';

  try {
    const data = {
      title,
      category,
      summary,
      body,
      pdfUrl,
      status,
      stateApplicability,
      updatedAt: serverTimestamp()
    };

    if (editId) {
      // Update existing
      const policyRef = doc(db, 'policies', editId);
      await updateDoc(policyRef, data);
    } else {
      // Create new
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'policies'), data);
    }

    policyFormContainer.style.display = 'none';
    await loadPolicies();
  } catch (err) {
    console.error('Error saving policy:', err);
  } finally {
    savePolicyBtn.disabled = false;
    savePolicyBtn.textContent = 'Save Policy';
  }
}

async function deletePolicy(policyId) {
  const confirmed = await showConfirmDialog(
    'Delete Policy',
    'Are you sure you want to delete this policy? This action cannot be undone.'
  );

  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, 'policies', policyId));
    allPolicies = allPolicies.filter(p => p.id !== policyId);
    renderPolicyTable();
  } catch (err) {
    console.error('Error deleting policy:', err);
  }
}

// =========================================
// TAB 3: VIDEO MANAGER
// =========================================

const videoTableContainer = document.getElementById('videoTableContainer');
const videoTableEmpty = document.getElementById('videoTableEmpty');
const videoFormContainer = document.getElementById('videoFormContainer');
const videoForm = document.getElementById('videoForm');
const videoFormTitle = document.getElementById('videoFormTitle');
const videoEditId = document.getElementById('videoEditId');
const videoTitleInput = document.getElementById('videoTitleInput');
const videoUrlInput = document.getElementById('videoUrlInput');
const videoCategoryInput = document.getElementById('videoCategoryInput');
const videoOrderInput = document.getElementById('videoOrderInput');
const videoDescInput = document.getElementById('videoDescInput');
const addVideoBtn = document.getElementById('addVideoBtn');
const cancelVideoBtn = document.getElementById('cancelVideoBtn');

async function loadVideos() {
  videoTableContainer.replaceChildren();
  const loading = document.createElement('p');
  loading.style.cssText = 'text-align:center;color:var(--silver);padding:40px 0;';
  loading.textContent = 'Loading videos...';
  videoTableContainer.appendChild(loading);
  videoTableEmpty.style.display = 'none';

  try {
    const q = query(collection(db, 'videos'), orderBy('order', 'asc'));
    const snapshot = await getDocs(q);

    allVideos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderVideoTable();
  } catch (err) {
    console.error('Error loading videos:', err);
    videoTableContainer.replaceChildren();
    const errMsg = document.createElement('p');
    errMsg.style.cssText = 'text-align:center;color:var(--red-accent);padding:40px 0;';
    errMsg.textContent = 'Failed to load videos.';
    videoTableContainer.appendChild(errMsg);
  }
}

function renderVideoTable() {
  videoTableContainer.replaceChildren();

  if (allVideos.length === 0) {
    videoTableEmpty.style.display = '';
    return;
  }

  videoTableEmpty.style.display = 'none';

  const table = document.createElement('table');
  table.className = 'admin-table';

  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Order', 'Title', 'Category', 'YouTube ID', 'Actions'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  allVideos.forEach((video) => {
    const row = document.createElement('tr');

    const tdOrder = document.createElement('td');
    tdOrder.textContent = video.order != null ? video.order : 0;
    row.appendChild(tdOrder);

    const tdTitle = document.createElement('td');
    tdTitle.textContent = video.title || 'Untitled';
    row.appendChild(tdTitle);

    const tdCat = document.createElement('td');
    tdCat.textContent = video.category || '';
    row.appendChild(tdCat);

    const tdYT = document.createElement('td');
    const ytId = video.youtubeId || extractYouTubeId(video.youtubeUrl) || '';
    tdYT.textContent = ytId;
    tdYT.style.cssText = 'font-family:var(--font-mono);font-size:0.82rem;';
    row.appendChild(tdYT);

    const tdActions = document.createElement('td');
    tdActions.style.cssText = 'display:flex;gap:8px;';

    const editBtn = document.createElement('button');
    editBtn.className = 'admin-btn-edit';
    editBtn.type = 'button';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => showVideoForm(video.id));

    const delBtn = document.createElement('button');
    delBtn.className = 'admin-btn-delete';
    delBtn.type = 'button';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => deleteVideo(video.id));

    tdActions.appendChild(editBtn);
    tdActions.appendChild(delBtn);
    row.appendChild(tdActions);

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  videoTableContainer.appendChild(table);
}

function showVideoForm(videoId) {
  videoFormContainer.style.display = '';

  if (videoId) {
    // Editing existing video
    const video = allVideos.find(v => v.id === videoId);
    if (!video) return;

    videoFormTitle.textContent = 'Edit Video';
    videoEditId.value = videoId;
    videoTitleInput.value = video.title || '';
    videoUrlInput.value = video.youtubeUrl || '';
    videoCategoryInput.value = video.category || '';
    videoOrderInput.value = video.order != null ? video.order : 0;
    videoDescInput.value = video.description || '';
  } else {
    // New video
    videoFormTitle.textContent = 'Add New Video';
    videoEditId.value = '';
    videoForm.reset();
    videoOrderInput.value = '0';
  }

  videoFormContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

addVideoBtn.addEventListener('click', () => showVideoForm(null));

cancelVideoBtn.addEventListener('click', () => {
  videoFormContainer.style.display = 'none';
});

videoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  await saveVideoForm();
});

async function saveVideoForm() {
  const editId = videoEditId.value;
  const title = videoTitleInput.value.trim();
  const youtubeUrl = videoUrlInput.value.trim();
  const category = videoCategoryInput.value;
  const order = parseInt(videoOrderInput.value, 10) || 0;
  const description = videoDescInput.value.trim();

  if (!title || !youtubeUrl || !category) {
    return;
  }

  const youtubeId = extractYouTubeId(youtubeUrl);

  const saveVideoBtn = document.getElementById('saveVideoBtn');
  saveVideoBtn.disabled = true;
  saveVideoBtn.textContent = 'Saving...';

  try {
    const data = {
      title,
      youtubeUrl,
      youtubeId: youtubeId || '',
      category,
      order,
      description,
      updatedAt: serverTimestamp()
    };

    if (editId) {
      // Update existing
      const videoRef = doc(db, 'videos', editId);
      await updateDoc(videoRef, data);
    } else {
      // Create new
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'videos'), data);
    }

    videoFormContainer.style.display = 'none';
    await loadVideos();
  } catch (err) {
    console.error('Error saving video:', err);
  } finally {
    saveVideoBtn.disabled = false;
    saveVideoBtn.textContent = 'Save Video';
  }
}

async function deleteVideo(videoId) {
  const confirmed = await showConfirmDialog(
    'Delete Video',
    'Are you sure you want to delete this video? This action cannot be undone.'
  );

  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, 'videos', videoId));
    allVideos = allVideos.filter(v => v.id !== videoId);
    renderVideoTable();
  } catch (err) {
    console.error('Error deleting video:', err);
  }
}

// =========================================
// TAB 4: USERS
// =========================================

const userListContainer = document.getElementById('userListContainer');
const userListEmpty = document.getElementById('userListEmpty');

async function loadUsers() {
  userListContainer.replaceChildren();
  const loading = document.createElement('p');
  loading.style.cssText = 'text-align:center;color:var(--silver);padding:40px 0;';
  loading.textContent = 'Loading users...';
  userListContainer.appendChild(loading);
  userListEmpty.style.display = 'none';

  try {
    const snapshot = await getDocs(collection(db, 'users'));

    allUsers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderUserList();
  } catch (err) {
    console.error('Error loading users:', err);
    userListContainer.replaceChildren();
    const errMsg = document.createElement('p');
    errMsg.style.cssText = 'text-align:center;color:var(--red-accent);padding:40px 0;';
    errMsg.textContent = 'Failed to load users.';
    userListContainer.appendChild(errMsg);
  }
}

function renderUserList() {
  userListContainer.replaceChildren();

  if (allUsers.length === 0) {
    userListEmpty.style.display = '';
    return;
  }

  userListEmpty.style.display = 'none';

  const table = document.createElement('table');
  table.className = 'admin-table';

  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Photo', 'Name', 'Email', 'Role', 'Actions'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  allUsers.forEach((user) => {
    const row = document.createElement('tr');

    // Photo
    const tdPhoto = document.createElement('td');
    if (user.photoURL) {
      const img = document.createElement('img');
      img.src = user.photoURL;
      img.alt = user.displayName || '';
      img.style.cssText = 'width:36px;height:36px;border-radius:50%;object-fit:cover;';
      tdPhoto.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.style.cssText = 'width:36px;height:36px;border-radius:50%;background:var(--light-gray);display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;color:var(--silver);';
      placeholder.textContent = (user.displayName || 'U').charAt(0).toUpperCase();
      tdPhoto.appendChild(placeholder);
    }
    row.appendChild(tdPhoto);

    // Name
    const tdName = document.createElement('td');
    tdName.textContent = user.displayName || '';
    tdName.style.fontWeight = '600';
    row.appendChild(tdName);

    // Email
    const tdEmail = document.createElement('td');
    tdEmail.textContent = user.email || '';
    tdEmail.style.cssText = 'color:var(--silver);font-size:0.88rem;';
    row.appendChild(tdEmail);

    // Role dropdown
    const tdRole = document.createElement('td');
    const roleSelect = document.createElement('select');
    roleSelect.className = 'form-control';
    roleSelect.style.cssText = 'padding:6px 12px;font-size:0.85rem;min-width:130px;';

    const optContributor = document.createElement('option');
    optContributor.value = 'contributor';
    optContributor.textContent = 'Contributor';
    roleSelect.appendChild(optContributor);

    const optAdmin = document.createElement('option');
    optAdmin.value = 'admin';
    optAdmin.textContent = 'Admin';
    roleSelect.appendChild(optAdmin);

    roleSelect.value = user.role || 'contributor';
    roleSelect.dataset.uid = user.id;
    tdRole.appendChild(roleSelect);
    row.appendChild(tdRole);

    // Save button
    const tdActions = document.createElement('td');
    const saveBtn = document.createElement('button');
    saveBtn.className = 'admin-btn-edit';
    saveBtn.type = 'button';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', async () => {
      const newRole = roleSelect.value;
      await updateUserRole(user.id, newRole);
      saveBtn.textContent = 'Saved!';
      setTimeout(() => { saveBtn.textContent = 'Save'; }, 2000);
    });
    tdActions.appendChild(saveBtn);
    row.appendChild(tdActions);

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  userListContainer.appendChild(table);
}

async function updateUserRole(uid, newRole) {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { role: newRole });

    // Update local cache
    const userIndex = allUsers.findIndex(u => u.id === uid);
    if (userIndex !== -1) {
      allUsers[userIndex].role = newRole;
    }
  } catch (err) {
    console.error('Error updating user role:', err);
  }
}
