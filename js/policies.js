/* ============================================
   SAFE Research Institute - Model Policy Library
   Loads published policies from Firestore,
   supports search, category/state filtering, and
   policy detail modal with Markdown rendering.
   ============================================ */

import { db } from './firebase-config.js';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// --- DOM References ---
const policyGrid = document.getElementById('policyGrid');
const policyEmptyState = document.getElementById('policyEmptyState');
const searchInput = document.getElementById('policySearch');
const categoryFilter = document.getElementById('categoryFilter');
const stateFilter = document.getElementById('stateFilter');

// Modal elements
const policyModal = document.getElementById('policyModal');
const policyModalBackdrop = document.getElementById('policyModalBackdrop');
const policyModalClose = document.getElementById('policyModalClose');
const policyModalCategory = document.getElementById('policyModalCategory');
const policyModalTitle = document.getElementById('policyModalTitle');
const policyModalStates = document.getElementById('policyModalStates');
const policyModalDate = document.getElementById('policyModalDate');
const policyModalActions = document.getElementById('policyModalActions');
const policyPdfBtn = document.getElementById('policyPdfBtn');
const policyModalBody = document.getElementById('policyModalBody');

// --- State ---
let allPolicies = [];

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => {
  loadPolicies();
  bindEvents();
});

/**
 * Fetch all published policies from Firestore, ordered by createdAt descending.
 */
async function loadPolicies() {
  try {
    const policiesRef = collection(db, 'policies');
    const q = query(
      policiesRef,
      where('status', '==', 'published'),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    allPolicies = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    renderPolicyGrid(allPolicies);
  } catch (error) {
    console.error('Error loading policies:', error);
    showEmptyState();
  }
}

/**
 * Format a Firestore Timestamp or Date into a readable date string.
 * @param {Object|Date|string} timestamp - Firestore Timestamp, Date, or date string.
 * @returns {string} Formatted date string.
 */
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
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Build a single policy card element using safe DOM methods.
 * @param {Object} policy - Policy data object.
 * @returns {HTMLElement} The policy card element.
 */
function buildPolicyCard(policy) {
  const card = document.createElement('article');
  card.className = 'policy-card';
  card.dataset.id = policy.id;

  // Category tag
  const categoryTag = document.createElement('span');
  categoryTag.className = 'policy-card-category';
  categoryTag.textContent = policy.category || 'Other';
  card.appendChild(categoryTag);

  // Title
  const titleEl = document.createElement('h3');
  titleEl.className = 'policy-card-title';
  titleEl.textContent = policy.title || '';
  card.appendChild(titleEl);

  // Summary
  const summaryEl = document.createElement('p');
  summaryEl.className = 'policy-card-summary';
  summaryEl.textContent = policy.summary || '';
  card.appendChild(summaryEl);

  // State applicability badges
  const statesContainer = document.createElement('div');
  statesContainer.className = 'policy-card-states';
  const states = policy.stateApplicability || [];
  const maxVisible = 5;
  const visibleStates = states.slice(0, maxVisible);
  const remaining = states.length - maxVisible;

  visibleStates.forEach(state => {
    const badge = document.createElement('span');
    badge.className = 'state-badge';
    badge.textContent = state;
    statesContainer.appendChild(badge);
  });

  if (remaining > 0) {
    const moreBadge = document.createElement('span');
    moreBadge.className = 'state-badge state-badge-more';
    moreBadge.textContent = '+' + remaining + ' more';
    statesContainer.appendChild(moreBadge);
  }

  card.appendChild(statesContainer);

  // "Read Full Policy" button
  const ctaBtn = document.createElement('button');
  ctaBtn.className = 'policy-card-cta';
  ctaBtn.type = 'button';
  ctaBtn.textContent = 'Read Full Policy';
  ctaBtn.setAttribute('aria-label', 'Read full policy: ' + (policy.title || ''));
  ctaBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openPolicyDetail(policy.id);
  });
  card.appendChild(ctaBtn);

  // Card click also opens detail
  card.addEventListener('click', () => openPolicyDetail(policy.id));

  return card;
}

/**
 * Render policy cards into the grid using safe DOM methods.
 * @param {Array} policies - Array of policy data objects.
 */
function renderPolicyGrid(policies) {
  if (!policies || policies.length === 0) {
    showEmptyState();
    return;
  }

  policyEmptyState.style.display = 'none';
  policyGrid.style.display = '';

  // Clear existing content
  while (policyGrid.firstChild) {
    policyGrid.removeChild(policyGrid.firstChild);
  }

  // Build and append each card
  policies.forEach(policy => {
    policyGrid.appendChild(buildPolicyCard(policy));
  });
}

/**
 * Show the empty state message and hide the grid.
 */
function showEmptyState() {
  policyGrid.style.display = 'none';
  policyEmptyState.style.display = '';
}

/**
 * Filter and re-render policies based on current search text, category, and state selection.
 */
function filterPolicies() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value;
  const selectedState = stateFilter.value;

  let filtered = allPolicies;

  // Category filter
  if (selectedCategory !== 'All') {
    filtered = filtered.filter(p => p.category === selectedCategory);
  }

  // State filter
  if (selectedState !== 'All') {
    filtered = filtered.filter(p => {
      const states = p.stateApplicability || [];
      return states.includes(selectedState) || states.includes('All States');
    });
  }

  // Text search across title and summary
  if (searchTerm) {
    filtered = filtered.filter(p => {
      const title = (p.title || '').toLowerCase();
      const summary = (p.summary || '').toLowerCase();
      return title.includes(searchTerm) || summary.includes(searchTerm);
    });
  }

  renderPolicyGrid(filtered);
}

/**
 * Sanitize HTML string using DOMPurify if available, otherwise a conservative fallback.
 * @param {string} html - Raw HTML string.
 * @returns {string} Sanitized HTML string safe for DOM insertion.
 */
function sanitizeHtml(html) {
  if (typeof DOMPurify !== 'undefined') {
    return DOMPurify.sanitize(html);
  }

  // Fallback: use the browser DOM parser and whitelist safe tags
  const parser = new DOMParser();
  const parsedDoc = parser.parseFromString(html, 'text/html');
  const allowedTags = new Set([
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'P', 'BR', 'HR',
    'UL', 'OL', 'LI',
    'STRONG', 'B', 'EM', 'I', 'U', 'S', 'DEL',
    'A', 'BLOCKQUOTE', 'PRE', 'CODE',
    'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD',
    'IMG', 'FIGURE', 'FIGCAPTION',
    'DIV', 'SPAN', 'SUP', 'SUB'
  ]);
  const allowedAttrs = new Set(['href', 'src', 'alt', 'title', 'class', 'id']);

  function cleanNode(node) {
    const children = Array.from(node.childNodes);
    children.forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (!allowedTags.has(child.tagName)) {
          const text = document.createTextNode(child.textContent);
          node.replaceChild(text, child);
        } else {
          Array.from(child.attributes).forEach(attr => {
            if (!allowedAttrs.has(attr.name)) {
              child.removeAttribute(attr.name);
            }
            if ((attr.name === 'href' || attr.name === 'src') && attr.value.trim().toLowerCase().startsWith('javascript:')) {
              child.removeAttribute(attr.name);
            }
          });
          cleanNode(child);
        }
      }
    });
  }

  cleanNode(parsedDoc.body);
  return parsedDoc.body.innerHTML;
}

/**
 * Render sanitized HTML content into a container using safe DOM insertion.
 * Parses the sanitized string into DOM nodes and appends them,
 * avoiding direct innerHTML assignment on the final target.
 * @param {HTMLElement} container - The target container element.
 * @param {string} sanitizedHtml - HTML string already sanitized by DOMPurify or fallback.
 */
function renderSanitizedContent(container, sanitizedHtml) {
  container.replaceChildren();
  const template = document.createElement('template');
  template.innerHTML = sanitizedHtml;
  container.appendChild(template.content);
}

/**
 * Open the policy detail modal for a given policy ID.
 * Fetches the full document and renders Markdown body.
 * @param {string} policyId - Firestore document ID.
 */
async function openPolicyDetail(policyId) {
  // First check local cache
  let policy = allPolicies.find(p => p.id === policyId);

  // If body is missing from the cached version, fetch the full document
  if (!policy || !policy.body) {
    try {
      const docRef = doc(db, 'policies', policyId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        policy = { id: docSnap.id, ...docSnap.data() };
      } else {
        console.error('Policy not found:', policyId);
        return;
      }
    } catch (error) {
      console.error('Error fetching policy:', error);
      return;
    }
  }

  // Populate modal with safe text content
  policyModalCategory.textContent = policy.category || '';
  policyModalTitle.textContent = policy.title || '';
  policyModalDate.textContent = policy.createdAt ? formatDate(policy.createdAt) : '';

  // Render state badges in modal
  while (policyModalStates.firstChild) {
    policyModalStates.removeChild(policyModalStates.firstChild);
  }
  const states = policy.stateApplicability || [];
  states.forEach(state => {
    const badge = document.createElement('span');
    badge.className = 'state-badge';
    badge.textContent = state;
    policyModalStates.appendChild(badge);
  });

  // PDF download button
  if (policy.pdfUrl) {
    policyPdfBtn.href = policy.pdfUrl;
    policyModalActions.style.display = '';
  } else {
    policyPdfBtn.href = '#';
    policyModalActions.style.display = 'none';
  }

  // Render Markdown to HTML using marked.js, then sanitize and insert safely
  if (policy.body && typeof marked !== 'undefined') {
    const rawHtml = marked.parse(policy.body);
    const safeHtml = sanitizeHtml(rawHtml);
    renderSanitizedContent(policyModalBody, safeHtml);
  } else {
    policyModalBody.replaceChildren();
    const fallback = document.createElement('p');
    fallback.textContent = 'Policy content is not available.';
    policyModalBody.appendChild(fallback);
  }

  // Show modal
  policyModal.classList.add('active');
  policyModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // Focus the close button for accessibility
  policyModalClose.focus();
}

/**
 * Close the policy detail modal.
 */
function closePolicyModal() {
  policyModal.classList.remove('active');
  policyModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

/**
 * Bind event listeners for search, filters, and modal controls.
 */
function bindEvents() {
  // Search input with debounce (300ms)
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(filterPolicies, 300);
  });

  // Category filter
  categoryFilter.addEventListener('change', filterPolicies);

  // State filter
  stateFilter.addEventListener('change', filterPolicies);

  // Modal close
  policyModalClose.addEventListener('click', closePolicyModal);
  policyModalBackdrop.addEventListener('click', closePolicyModal);

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && policyModal.classList.contains('active')) {
      closePolicyModal();
    }
  });
}
