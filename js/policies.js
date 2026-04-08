/* ============================================
   SAFE Research Institute - Model Policy Library
   Loads policies from local markdown files,
   renders color-coded cards with filtering.
   ============================================ */

// --- Policy manifest (add new policy filenames here) ---
const POLICY_FILES = [
  'evidence-based-immunization-guidance-act.md',
  'vaccine-coverage-guarantee-act.md',
  'interstate-public-health-collaboration-resolution.md',
  'immunization-provider-access-expansion-act.md',
  'medical-only-immunization-exemption-act.md',
  'pharmacist-immunization-authority-act.md',
  'scientific-integrity-research-act.md',
  'equitable-immunization-access-act.md'
];

// --- DOM References ---
const policyGrid = document.getElementById('policyGrid');
const policyEmptyState = document.getElementById('policyEmptyState');
const searchInput = document.getElementById('policySearch');
const typeFilter = document.getElementById('typeFilter');
const categoryFilter = document.getElementById('categoryFilter');
const stateFilter = document.getElementById('stateFilter');
const resultsCount = document.getElementById('policyResultsCount');

// --- State ---
let allPolicies = [];

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => {
  loadPolicies();
  bindEvents();
});

/**
 * Parse YAML frontmatter from a markdown string.
 * Returns { meta: {}, body: "" }
 */
function parseMarkdown(text) {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: text };

  const yamlStr = match[1];
  const body = match[2].trim();
  const meta = {};

  yamlStr.split('\n').forEach(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();

    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // Parse arrays
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1)
        .split(',')
        .map(s => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    }

    meta[key] = value;
  });

  return { meta, body };
}

/**
 * Fetch all policy markdown files and parse them.
 */
async function loadPolicies() {
  try {
    const results = await Promise.all(
      POLICY_FILES.map(async (filename) => {
        try {
          const res = await fetch('policies/' + filename);
          if (!res.ok) return null;
          const text = await res.text();
          const { meta, body } = parseMarkdown(text);
          return { ...meta, body, filename };
        } catch {
          return null;
        }
      })
    );

    allPolicies = results.filter(Boolean);
    renderPolicyGrid(allPolicies);
  } catch (error) {
    console.error('Error loading policies:', error);
    showEmptyState();
  }
}

/**
 * Format a date string for display.
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Count applicable states from stateApplicability array.
 */
function stateCountLabel(states) {
  if (!states || !Array.isArray(states)) return '';
  if (states.includes('All States')) return 'All states';
  return states.length + ' applicable state' + (states.length !== 1 ? 's' : '');
}

/**
 * Build a single color-coded policy card element.
 */
function buildPolicyCard(policy) {
  const card = document.createElement('a');
  card.className = 'policy-card';
  card.href = 'policy.html?id=' + encodeURIComponent(policy.id);

  // Color stripe
  const stripe = document.createElement('div');
  stripe.className = 'policy-card-stripe';
  stripe.dataset.cat = policy.category || '';
  card.appendChild(stripe);

  // Card body
  const body = document.createElement('div');
  body.className = 'policy-card-body';

  // Meta row: type + category pill
  const meta = document.createElement('div');
  meta.className = 'policy-card-meta';

  const typeLabel = document.createElement('span');
  typeLabel.className = 'policy-card-type';
  typeLabel.textContent = policy.type || '';
  meta.appendChild(typeLabel);

  const catPill = document.createElement('span');
  catPill.className = 'policy-category-pill';
  catPill.dataset.cat = policy.category || '';
  catPill.textContent = policy.category || '';
  meta.appendChild(catPill);

  body.appendChild(meta);

  // Title
  const titleEl = document.createElement('h3');
  titleEl.className = 'policy-card-title';
  titleEl.textContent = policy.title || '';
  body.appendChild(titleEl);

  // Summary
  const summaryEl = document.createElement('p');
  summaryEl.className = 'policy-card-summary';
  summaryEl.textContent = policy.summary || '';
  body.appendChild(summaryEl);

  // Footer: state count + date
  const footer = document.createElement('div');
  footer.className = 'policy-card-footer';

  const statesLabel = document.createElement('span');
  statesLabel.textContent = stateCountLabel(policy.stateApplicability);
  footer.appendChild(statesLabel);

  const dot = document.createElement('span');
  dot.className = 'dot';
  footer.appendChild(dot);

  const dateLabel = document.createElement('span');
  dateLabel.textContent = 'Updated ' + formatDate(policy.updatedAt);
  footer.appendChild(dateLabel);

  body.appendChild(footer);
  card.appendChild(body);

  return card;
}

/**
 * Render policy cards into the grid.
 */
function renderPolicyGrid(policies) {
  if (!policies || policies.length === 0) {
    showEmptyState();
    updateResultsCount(0);
    return;
  }

  policyEmptyState.style.display = 'none';
  policyGrid.style.display = '';

  while (policyGrid.firstChild) {
    policyGrid.removeChild(policyGrid.firstChild);
  }

  policies.forEach(policy => {
    policyGrid.appendChild(buildPolicyCard(policy));
  });

  updateResultsCount(policies.length);
}

/**
 * Update the results count label.
 */
function updateResultsCount(count) {
  if (resultsCount) {
    resultsCount.textContent = 'Showing ' + count + ' polic' + (count === 1 ? 'y' : 'ies');
  }
}

/**
 * Show the empty state message and hide the grid.
 */
function showEmptyState() {
  policyGrid.style.display = 'none';
  policyEmptyState.style.display = '';
}

/**
 * Filter and re-render policies based on current filters.
 */
function filterPolicies() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const selectedType = typeFilter.value;
  const selectedCategory = categoryFilter.value;
  const selectedState = stateFilter.value;

  let filtered = allPolicies;

  // Type filter
  if (selectedType !== 'All') {
    filtered = filtered.filter(p => p.type === selectedType);
  }

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
 * Bind event listeners for search and filters.
 */
function bindEvents() {
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(filterPolicies, 300);
  });

  typeFilter.addEventListener('change', filterPolicies);
  categoryFilter.addEventListener('change', filterPolicies);
  stateFilter.addEventListener('change', filterPolicies);
}
