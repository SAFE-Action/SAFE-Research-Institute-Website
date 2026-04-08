/* ============================================
   SAFE Research Institute - Policy Detail Page
   Loads a single policy by ID from markdown files,
   renders the full content with sidebar.
   ============================================ */

// --- Policy manifest (must match policies.js) ---
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
const breadcrumbCategory = document.getElementById('breadcrumbCategory');
const breadcrumbTitle = document.getElementById('breadcrumbTitle');
const policyType = document.getElementById('policyType');
const policyCategory = document.getElementById('policyCategory');
const policyTitle = document.getElementById('policyTitle');
const policyStates = document.getElementById('policyStates');
const policyDate = document.getElementById('policyDate');
const policyActions = document.getElementById('policyActions');
const policyPdfBtn = document.getElementById('policyPdfBtn');
const policyShareBtn = document.getElementById('policyShareBtn');
const policyBody = document.getElementById('policyBody');
const relatedPolicies = document.getElementById('relatedPolicies');

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const policyId = params.get('id');
  if (policyId) {
    loadPolicy(policyId);
  } else {
    showError('No policy specified.');
  }
});

/**
 * Parse YAML frontmatter from a markdown string.
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

    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

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
 * Sanitize HTML using DOMPurify or a conservative DOM-based fallback.
 */
function sanitizeHtml(html) {
  if (typeof DOMPurify !== 'undefined') {
    return DOMPurify.sanitize(html);
  }
  // Fallback: use DOM parser with allowlist
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const allowedTags = new Set([
    'H1','H2','H3','H4','H5','H6','P','BR','HR',
    'UL','OL','LI','STRONG','B','EM','I','U','S','DEL',
    'A','BLOCKQUOTE','PRE','CODE',
    'TABLE','THEAD','TBODY','TR','TH','TD',
    'DIV','SPAN','SUP','SUB'
  ]);
  const allowedAttrs = new Set(['href','src','alt','title','class','id']);
  function cleanNode(node) {
    Array.from(node.childNodes).forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (!allowedTags.has(child.tagName)) {
          const text = document.createTextNode(child.textContent);
          node.replaceChild(text, child);
        } else {
          Array.from(child.attributes).forEach(attr => {
            if (!allowedAttrs.has(attr.name)) {
              child.removeAttribute(attr.name);
            }
            if ((attr.name === 'href' || attr.name === 'src') &&
                attr.value.trim().toLowerCase().startsWith('javascript:')) {
              child.removeAttribute(attr.name);
            }
          });
          cleanNode(child);
        }
      }
    });
  }
  cleanNode(doc.body);
  return doc.body.innerHTML;
}

/**
 * Render sanitized HTML into a container using safe template insertion.
 */
function renderSanitizedContent(container, sanitizedHtml) {
  container.replaceChildren();
  const template = document.createElement('template');
  template.innerHTML = sanitizedHtml;
  container.appendChild(template.content);
}

/**
 * Load all policies, find the one matching the ID, and render it.
 */
async function loadPolicy(policyId) {
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

    const allPolicies = results.filter(Boolean);
    const policy = allPolicies.find(p => p.id === policyId);

    if (!policy) {
      showError('Policy not found.');
      return;
    }

    renderPolicy(policy);
    renderRelated(allPolicies, policy);
    bindShareButton();

  } catch (error) {
    console.error('Error loading policy:', error);
    showError('Error loading policy. Please try again.');
  }
}

/**
 * Render the full policy detail.
 */
function renderPolicy(policy) {
  document.title = (policy.title || 'Policy') + ' | SAFE Research Institute';

  // Breadcrumb
  breadcrumbCategory.textContent = policy.category || '';
  breadcrumbTitle.textContent = policy.title || '';

  // Meta badges
  policyType.textContent = policy.type || '';
  policyCategory.textContent = policy.category || '';
  policyCategory.dataset.cat = policy.category || '';

  // Title
  policyTitle.textContent = policy.title || '';

  // States
  policyStates.replaceChildren();
  const states = policy.stateApplicability || [];
  states.forEach(state => {
    const badge = document.createElement('span');
    badge.className = 'state-badge';
    badge.textContent = state;
    policyStates.appendChild(badge);
  });

  // Date
  if (policy.updatedAt) {
    const date = new Date(policy.updatedAt + 'T00:00:00');
    if (!isNaN(date.getTime())) {
      policyDate.textContent = 'Last updated ' + date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  }

  // PDF button
  if (policy.pdfUrl) {
    policyPdfBtn.href = policy.pdfUrl;
    policyActions.style.display = '';
  } else {
    policyActions.style.display = '';
    policyPdfBtn.style.display = 'none';
  }

  // Body content - render markdown safely
  if (policy.body && typeof marked !== 'undefined') {
    const rawHtml = marked.parse(policy.body);
    const safeHtml = sanitizeHtml(rawHtml);
    renderSanitizedContent(policyBody, safeHtml);
  } else {
    policyBody.replaceChildren();
    const fallback = document.createElement('p');
    fallback.textContent = 'Policy content is not available.';
    policyBody.appendChild(fallback);
  }
}

/**
 * Render related policies in the sidebar.
 */
function renderRelated(allPolicies, currentPolicy) {
  const related = allPolicies.filter(
    p => p.id !== currentPolicy.id && p.category === currentPolicy.category
  );

  const toShow = related.length > 0
    ? related
    : allPolicies.filter(p => p.id !== currentPolicy.id).slice(0, 3);

  relatedPolicies.replaceChildren();

  if (toShow.length === 0) {
    const msg = document.createElement('p');
    msg.style.cssText = 'color:var(--steel);font-size:0.88rem;';
    msg.textContent = 'No related policies yet.';
    relatedPolicies.appendChild(msg);
    return;
  }

  toShow.forEach(p => {
    const link = document.createElement('a');
    link.className = 'policy-sidebar-item';
    link.href = 'policy.html?id=' + encodeURIComponent(p.id);

    const title = document.createElement('div');
    title.className = 'policy-sidebar-item-title';
    title.textContent = p.title || '';
    link.appendChild(title);

    const cat = document.createElement('div');
    cat.className = 'policy-sidebar-item-cat';
    cat.textContent = p.type || '';
    link.appendChild(cat);

    relatedPolicies.appendChild(link);
  });
}

/**
 * Bind the share button to copy the current URL.
 */
function bindShareButton() {
  if (!policyShareBtn) return;
  policyShareBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      const originalText = policyShareBtn.textContent;
      policyShareBtn.textContent = 'Link copied!';
      setTimeout(() => {
        policyShareBtn.textContent = originalText;
      }, 2000);
    } catch {
      window.prompt('Copy this link:', window.location.href);
    }
  });
}

/**
 * Show an error message in the body area.
 */
function showError(message) {
  policyBody.replaceChildren();
  const container = document.createElement('div');
  container.style.cssText = 'text-align:center;padding:60px 0;';

  const msg = document.createElement('p');
  msg.style.cssText = 'color:var(--steel);font-size:1rem;margin-bottom:16px;';
  msg.textContent = message;
  container.appendChild(msg);

  const backLink = document.createElement('a');
  backLink.href = 'policies.html';
  backLink.textContent = 'Return to Policy Library';
  backLink.style.cssText = 'color:var(--accent);font-weight:600;';
  container.appendChild(backLink);

  policyBody.appendChild(container);
}
