/* ============================================
   SAFE Research Institute - Writing Portal
   ============================================ */

import { db, auth } from './firebase-config.js';
import { signInWithGoogle, logOut, onAuth, isAdmin } from './auth.js';
import { slugify } from './shared.js';
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// --- DOM References ---
const authGate = document.getElementById('authGate');
const writerDashboard = document.getElementById('writerDashboard');
const googleSignInBtn = document.getElementById('googleSignInBtn');
const signOutBtn = document.getElementById('signOutBtn');
const userPhoto = document.getElementById('userPhoto');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');
const articleForm = document.getElementById('articleForm');
const titleInput = document.getElementById('articleTitle');
const categorySelect = document.getElementById('articleCategory');
const summaryTextarea = document.getElementById('articleSummary');
const formMessage = document.getElementById('formMessage');
const myArticlesList = document.getElementById('myArticlesList');
const myArticlesEmpty = document.getElementById('myArticlesEmpty');
const tabButtons = document.querySelectorAll('.writer-tab');
const tabContents = document.querySelectorAll('.writer-tab-content');

// --- State ---
let currentUser = null;
let easyMDE = null;

// --- Auth State Listener ---
onAuth(async (user) => {
  currentUser = user;

  if (user) {
    // User is signed in — show dashboard
    authGate.style.display = 'none';
    writerDashboard.style.display = '';

    // Populate user bar
    userPhoto.src = user.photoURL || '';
    userPhoto.alt = user.displayName || 'User';
    userName.textContent = user.displayName || 'Writer';
    userEmail.textContent = user.email || '';

    // Initialize EasyMDE if not already done
    initEasyMDE();

    // Load articles for "My Articles" tab
    loadMyArticles();
  } else {
    // Not signed in — show gate
    authGate.style.display = '';
    writerDashboard.style.display = 'none';
  }
});

// --- Google Sign-In ---
googleSignInBtn.addEventListener('click', async () => {
  try {
    await signInWithGoogle();
  } catch (err) {
    console.error('Sign-in failed:', err);
  }
});

// --- Sign Out ---
signOutBtn.addEventListener('click', async () => {
  try {
    await logOut();
  } catch (err) {
    console.error('Sign-out failed:', err);
  }
});

// --- Tab Switching ---
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
    const targetPanel = document.getElementById(`tab-${targetTab}`);
    if (targetPanel) {
      targetPanel.classList.add('active');
    }

    // Reinitialize EasyMDE when switching to "New Article" tab
    if (targetTab === 'new-article') {
      initEasyMDE();
    }

    // Reload articles when switching to "My Articles" tab
    if (targetTab === 'my-articles') {
      loadMyArticles();
    }
  });
});

// --- Initialize EasyMDE ---
function initEasyMDE() {
  if (easyMDE) return; // Already initialized

  const bodyTextarea = document.getElementById('articleBody');
  if (!bodyTextarea) return;

  easyMDE = new EasyMDE({
    element: bodyTextarea,
    placeholder: 'Write your article body in Markdown...',
    spellChecker: false,
    autosave: {
      enabled: false
    },
    status: ['lines', 'words'],
    toolbar: [
      'bold', 'italic', 'heading', '|',
      'quote', 'unordered-list', 'ordered-list', '|',
      'link', 'image', 'table', '|',
      'preview', 'side-by-side', 'fullscreen', '|',
      'guide'
    ],
    minHeight: '300px'
  });
}

// --- Submit Article ---
articleForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!currentUser) {
    showMessage('You must be signed in to submit an article.', 'error');
    return;
  }

  const title = titleInput.value.trim();
  const category = categorySelect.value;
  const summary = summaryTextarea.value.trim();
  const body = easyMDE ? easyMDE.value().trim() : '';

  // Validation
  if (!title) {
    showMessage('Please enter a title.', 'error');
    return;
  }
  if (!category) {
    showMessage('Please select a category.', 'error');
    return;
  }
  if (!summary) {
    showMessage('Please enter a summary.', 'error');
    return;
  }
  if (!body) {
    showMessage('Please write the article body.', 'error');
    return;
  }

  // Disable submit button
  const submitBtn = document.getElementById('submitArticleBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    await addDoc(collection(db, 'articles'), {
      title: title,
      slug: slugify(title),
      summary: summary,
      body: body,
      category: category,
      status: 'pending_review',
      authorId: currentUser.uid,
      authorName: currentUser.displayName,
      authorPhoto: currentUser.photoURL,
      createdAt: serverTimestamp(),
      publishedAt: null
    });

    showMessage('Article submitted successfully! It will be reviewed by an editor before publishing.', 'success');
    clearForm();
  } catch (err) {
    console.error('Error submitting article:', err);
    showMessage('Failed to submit article. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Article';
  }
});

// --- Load My Articles ---
async function loadMyArticles() {
  if (!currentUser) return;

  // Show loading state
  myArticlesList.replaceChildren();
  const loadingMsg = document.createElement('p');
  loadingMsg.style.cssText = 'text-align:center;color:var(--silver);padding:40px 0;';
  loadingMsg.textContent = 'Loading your articles...';
  myArticlesList.appendChild(loadingMsg);
  myArticlesEmpty.style.display = 'none';

  try {
    const q = query(
      collection(db, 'articles'),
      where('authorId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);

    myArticlesList.replaceChildren();

    if (snapshot.empty) {
      myArticlesEmpty.style.display = '';
      return;
    }

    myArticlesEmpty.style.display = 'none';

    snapshot.forEach((docSnap) => {
      const article = docSnap.data();
      const status = article.status || 'draft';
      const statusLabel = formatStatus(status);
      const statusClass = statusColorClass(status);
      const date = article.createdAt
        ? article.createdAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : 'Pending';

      // Build article list item using safe DOM methods
      const row = document.createElement('div');
      row.className = 'article-list-item';

      const infoDiv = document.createElement('div');
      infoDiv.className = 'article-list-item-info';

      const titleEl = document.createElement('h4');
      titleEl.className = 'article-list-item-title';
      titleEl.textContent = article.title;

      const metaDiv = document.createElement('div');
      metaDiv.className = 'article-list-item-meta';

      const categorySpan = document.createElement('span');
      categorySpan.className = 'article-list-item-category';
      categorySpan.textContent = article.category || '';

      const dateSpan = document.createElement('span');
      dateSpan.className = 'article-list-item-date';
      dateSpan.textContent = date;

      metaDiv.appendChild(categorySpan);
      metaDiv.appendChild(dateSpan);
      infoDiv.appendChild(titleEl);
      infoDiv.appendChild(metaDiv);

      const badge = document.createElement('span');
      badge.className = `status-badge ${statusClass}`;
      badge.textContent = statusLabel;

      row.appendChild(infoDiv);
      row.appendChild(badge);
      myArticlesList.appendChild(row);
    });
  } catch (err) {
    console.error('Error loading articles:', err);
    myArticlesList.replaceChildren();
    const errorMsg = document.createElement('p');
    errorMsg.style.cssText = 'text-align:center;color:var(--red-accent);padding:40px 0;';
    errorMsg.textContent = 'Failed to load articles. Please try again.';
    myArticlesList.appendChild(errorMsg);
  }
}

// --- Helpers ---

function formatStatus(status) {
  const map = {
    'draft': 'Draft',
    'pending_review': 'Pending Review',
    'published': 'Published',
    'rejected': 'Rejected'
  };
  return map[status] || status;
}

function statusColorClass(status) {
  const map = {
    'draft': 'status-draft',
    'pending_review': 'status-pending',
    'published': 'status-published',
    'rejected': 'status-rejected'
  };
  return map[status] || 'status-draft';
}

function showMessage(text, type) {
  formMessage.textContent = text;
  formMessage.className = 'writer-form-message';
  formMessage.classList.add(type === 'success' ? 'message-success' : 'message-error');
  formMessage.style.display = '';

  // Auto-hide after 6 seconds
  setTimeout(() => {
    formMessage.style.display = 'none';
  }, 6000);
}

function clearForm() {
  titleInput.value = '';
  categorySelect.value = '';
  summaryTextarea.value = '';
  if (easyMDE) {
    easyMDE.value('');
  }
}
