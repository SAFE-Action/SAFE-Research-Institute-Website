/* ============================================
   SAFE Research Institute - Blog Page
   Loads published articles from Firestore,
   supports search, category filtering, and
   article detail modal with Markdown rendering.
   ============================================ */

import { db } from './firebase-config.js';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { timeAgo } from './shared.js';

// --- DOM References ---
const blogGrid = document.getElementById('blogGrid');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('blogSearch');
const categoryFilter = document.getElementById('categoryFilter');

// Modal elements
const articleModal = document.getElementById('articleModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalClose = document.getElementById('modalClose');
const modalCategory = document.getElementById('modalCategory');
const modalTitle = document.getElementById('modalTitle');
const modalAuthorPhoto = document.getElementById('modalAuthorPhoto');
const modalAuthorName = document.getElementById('modalAuthorName');
const modalDate = document.getElementById('modalDate');
const modalBody = document.getElementById('modalBody');

// --- State ---
let allArticles = [];

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => {
  loadArticles();
  bindEvents();
});

/**
 * Fetch all published articles from Firestore, ordered by publishedAt descending.
 */
async function loadArticles() {
  try {
    const articlesRef = collection(db, 'articles');
    const q = query(
      articlesRef,
      where('status', '==', 'published'),
      orderBy('publishedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    allArticles = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    renderArticles(allArticles);
  } catch (error) {
    console.error('Error loading articles:', error);
    showEmptyState();
  }
}

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str - Raw string.
 * @returns {string} Escaped string safe for text insertion.
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/**
 * Build a single article card element using safe DOM methods.
 * @param {Object} article - Article data object.
 * @returns {HTMLElement} The article card element.
 */
function buildArticleCard(article) {
  const dateStr = article.publishedAt ? timeAgo(article.publishedAt) : '';
  const authorInitial = article.authorName ? article.authorName.charAt(0).toUpperCase() : '?';

  const card = document.createElement('article');
  card.className = 'article-card';
  card.dataset.id = article.id;
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', 'Read article: ' + (article.title || ''));

  // Category tag
  const topDiv = document.createElement('div');
  topDiv.className = 'article-card-top';
  const categorySpan = document.createElement('span');
  categorySpan.className = 'article-card-category';
  categorySpan.textContent = article.category || '';
  topDiv.appendChild(categorySpan);
  card.appendChild(topDiv);

  // Title
  const titleEl = document.createElement('h3');
  titleEl.className = 'article-card-title';
  titleEl.textContent = article.title || '';
  card.appendChild(titleEl);

  // Summary
  const summaryEl = document.createElement('p');
  summaryEl.className = 'article-card-summary';
  summaryEl.textContent = article.summary || '';
  card.appendChild(summaryEl);

  // Meta row: avatar + author + date
  const metaDiv = document.createElement('div');
  metaDiv.className = 'article-card-meta';

  if (article.authorPhoto) {
    const avatarImg = document.createElement('img');
    avatarImg.src = article.authorPhoto;
    avatarImg.alt = article.authorName || 'Author';
    avatarImg.className = 'article-card-avatar';
    metaDiv.appendChild(avatarImg);
  } else {
    const avatarPlaceholder = document.createElement('div');
    avatarPlaceholder.className = 'article-card-avatar article-card-avatar-placeholder';
    avatarPlaceholder.textContent = authorInitial;
    metaDiv.appendChild(avatarPlaceholder);
  }

  const metaText = document.createElement('div');
  metaText.className = 'article-card-meta-text';

  const authorSpan = document.createElement('span');
  authorSpan.className = 'article-card-author';
  authorSpan.textContent = article.authorName || '';
  metaText.appendChild(authorSpan);

  const dateSpan = document.createElement('span');
  dateSpan.className = 'article-card-date';
  dateSpan.textContent = dateStr;
  metaText.appendChild(dateSpan);

  metaDiv.appendChild(metaText);
  card.appendChild(metaDiv);

  // Event listeners
  card.addEventListener('click', () => openArticle(article.id));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openArticle(article.id);
    }
  });

  return card;
}

/**
 * Render article cards into the grid using safe DOM methods.
 * @param {Array} articles - Array of article data objects.
 */
function renderArticles(articles) {
  if (!articles || articles.length === 0) {
    showEmptyState();
    return;
  }

  emptyState.style.display = 'none';
  blogGrid.style.display = '';

  // Clear existing content
  while (blogGrid.firstChild) {
    blogGrid.removeChild(blogGrid.firstChild);
  }

  // Build and append each card
  articles.forEach(article => {
    blogGrid.appendChild(buildArticleCard(article));
  });
}

/**
 * Show the empty state message and hide the grid.
 */
function showEmptyState() {
  blogGrid.style.display = 'none';
  emptyState.style.display = '';
}

/**
 * Sanitize HTML string by stripping dangerous elements and attributes.
 * Uses DOMPurify if available, otherwise falls back to a conservative
 * DOM-based sanitizer that only allows safe content tags.
 * @param {string} html - Raw HTML string.
 * @returns {string} Sanitized HTML string.
 */
function sanitizeHtml(html) {
  // Use DOMPurify if loaded
  if (typeof DOMPurify !== 'undefined') {
    return DOMPurify.sanitize(html);
  }

  // Fallback: use the browser DOM parser and whitelist safe tags
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
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
          // Replace disallowed elements with their text content
          const text = document.createTextNode(child.textContent);
          node.replaceChild(text, child);
        } else {
          // Remove disallowed attributes
          Array.from(child.attributes).forEach(attr => {
            if (!allowedAttrs.has(attr.name)) {
              child.removeAttribute(attr.name);
            }
            // Ensure hrefs and srcs are not javascript: protocol
            if ((attr.name === 'href' || attr.name === 'src') && attr.value.trim().toLowerCase().startsWith('javascript:')) {
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
 * Open the article detail modal for a given article ID.
 * Fetches the full document and renders Markdown body.
 * @param {string} articleId - Firestore document ID.
 */
async function openArticle(articleId) {
  // First check local cache
  let article = allArticles.find(a => a.id === articleId);

  // If body is missing from the cached version, fetch the full document
  if (!article || !article.body) {
    try {
      const docRef = doc(db, 'articles', articleId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        article = { id: docSnap.id, ...docSnap.data() };
      } else {
        console.error('Article not found:', articleId);
        return;
      }
    } catch (error) {
      console.error('Error fetching article:', error);
      return;
    }
  }

  // Populate modal with safe text content
  modalCategory.textContent = article.category || '';
  modalTitle.textContent = article.title || '';
  modalAuthorName.textContent = article.authorName || '';
  modalDate.textContent = article.publishedAt ? timeAgo(article.publishedAt) : '';

  if (article.authorPhoto) {
    modalAuthorPhoto.src = article.authorPhoto;
    modalAuthorPhoto.alt = article.authorName || 'Author';
    modalAuthorPhoto.style.display = '';
  } else {
    modalAuthorPhoto.style.display = 'none';
  }

  // Render Markdown to HTML using marked.js, then sanitize
  if (article.body && typeof marked !== 'undefined') {
    const rawHtml = marked.parse(article.body);
    const safeHtml = sanitizeHtml(rawHtml);
    modalBody.replaceChildren();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = safeHtml;
    modalBody.appendChild(wrapper);
  } else {
    modalBody.replaceChildren();
    const fallback = document.createElement('p');
    fallback.textContent = 'Article content is not available.';
    modalBody.appendChild(fallback);
  }

  // Show modal
  articleModal.classList.add('active');
  articleModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // Focus the close button for accessibility
  modalClose.focus();
}

/**
 * Close the article detail modal.
 */
function closeModal() {
  articleModal.classList.remove('active');
  articleModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

/**
 * Filter and re-render articles based on current search text and category selection.
 */
function filterArticles() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value;

  let filtered = allArticles;

  // Category filter
  if (selectedCategory !== 'All') {
    filtered = filtered.filter(a => a.category === selectedCategory);
  }

  // Text search across title and summary
  if (searchTerm) {
    filtered = filtered.filter(a => {
      const title = (a.title || '').toLowerCase();
      const summary = (a.summary || '').toLowerCase();
      return title.includes(searchTerm) || summary.includes(searchTerm);
    });
  }

  renderArticles(filtered);
}

/**
 * Bind event listeners for search, filter, and modal controls.
 */
function bindEvents() {
  // Search input with debounce
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(filterArticles, 300);
  });

  // Category filter
  categoryFilter.addEventListener('change', filterArticles);

  // Modal close
  modalClose.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', closeModal);

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && articleModal.classList.contains('active')) {
      closeModal();
    }
  });
}
