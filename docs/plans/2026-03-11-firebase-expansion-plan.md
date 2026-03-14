# SAFE Research Institute Firebase Expansion — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Firebase-powered seminar booking, guest blog with Google auth, YouTube video curation, model policy library, science communicator education, and admin panel to the existing static SAFE Research Institute website.

**Architecture:** Static HTML/CSS/JS site extended with Firebase SDK (Auth + Firestore). All new pages share the existing design system (navy/gold, Inter font). Firebase Auth handles Google Sign-In. Firestore stores articles, policies, videos, and user roles. Admin panel is a protected page with tabbed CMS interface.

**Tech Stack:** Firebase Auth, Firestore, Firebase Hosting, EasyMDE (Markdown editor), marked.js (Markdown renderer), Google Calendar embed, YouTube embed API

---

### Task 1: Firebase Setup & Shared Infrastructure

**Files:**
- Create: `js/firebase-config.js`
- Create: `js/auth.js`
- Create: `js/shared.js`
- Create: `firestore.rules`
- Create: `firebase.json`
- Modify: `index.html:39-45` (update nav links)
- Modify: `css/style.css` (append new page styles)

**Step 1: Create `js/firebase-config.js`**

This file initializes Firebase with project config. The actual config values will be populated after the user creates a Firebase project.

```javascript
// js/firebase-config.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
```

**Step 2: Create `js/auth.js`**

Shared auth utilities: sign in, sign out, auth state listener, admin check.

```javascript
// js/auth.js
import { auth, db } from './firebase-config.js';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const provider = new GoogleAuthProvider();

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, provider);
  const userRef = doc(db, 'users', result.user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      name: result.user.displayName,
      email: result.user.email,
      photo: result.user.photoURL,
      role: 'contributor',
      createdAt: new Date()
    });
  }
  return result.user;
}

export async function logOut() {
  await signOut(auth);
}

export function onAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function isAdmin(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() && snap.data().role === 'admin';
}
```

**Step 3: Create `js/shared.js`**

Shared utilities: HTML templates for header/footer, markdown rendering, slug generation.

```javascript
// js/shared.js
export function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function extractYouTubeId(url) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\s]+)/);
  return match ? match[1] : null;
}

export function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 604800 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
  ];
  for (const i of intervals) {
    const count = Math.floor(seconds / i.seconds);
    if (count >= 1) return `${count} ${i.label}${count > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}
```

**Step 4: Create `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /articles/{articleId} {
      allow read: if resource.data.status == "published" || request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null && (
        request.auth.uid == resource.data.authorId ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin"
      );
      allow delete: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }
    match /policies/{policyId} {
      allow read: if resource.data.status == "published";
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }
    match /videos/{videoId} {
      allow read: if true;
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }
    match /users/{userId} {
      allow read: if request.auth.uid == userId || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
      allow create: if request.auth.uid == userId;
      allow update: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }
  }
}
```

**Step 5: Create `firebase.json`**

```json
{
  "hosting": {
    "public": ".",
    "ignore": ["firebase.json", "**/node_modules/**", "docs/**"],
    "rewrites": [],
    "headers": [
      {
        "source": "**/*.html",
        "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
      }
    ]
  },
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

**Step 6: Update navigation in `index.html:39-45`**

Replace the nav links block in `index.html` (and all other HTML files) with the expanded nav:

```html
<div class="nav-links" id="navLinks">
  <a href="seminars.html">Seminars</a>
  <a href="blog.html">Blog</a>
  <a href="videos.html">Videos</a>
  <a href="policies.html">Policies</a>
  <a href="education.html">Education</a>
  <a href="index.html#why">About</a>
  <a href="index.html#taskforce" class="nav-cta">Join a Task Force</a>
</div>
```

Apply the same nav update to: `terms.html`, `privacy.html`, `conflict-of-interest.html`, `gift-acceptance.html`.

**Step 7: Verify navigation renders correctly**

Load the site in preview, confirm all new nav links appear and the layout doesn't break at desktop and mobile widths.

**Step 8: Commit**

```bash
git add js/firebase-config.js js/auth.js js/shared.js firestore.rules firebase.json index.html terms.html privacy.html conflict-of-interest.html gift-acceptance.html
git commit -m "feat: add Firebase infrastructure, auth utilities, and updated navigation"
```

---

### Task 2: Seminars Page

**Files:**
- Create: `seminars.html`

**Step 1: Create `seminars.html`**

Full page with: hero section, upcoming seminars (static placeholder cards), embedded Google Calendar booking widget (iframe placeholder), past seminars section. Uses same marquee bar, header, footer as index.html.

Key sections:
- **Hero:** "Monthly Research Seminars" title, description about Google Meet sessions
- **Upcoming Seminars:** 2-3 placeholder cards with date, topic, speaker fields
- **Book a Session:** Prominent section with a placeholder `<iframe>` for Google Calendar Appointment Schedule (user will paste their calendar embed URL)
- **Past Seminars:** Grid cards linking to YouTube recordings (placeholder)

Use existing CSS classes: `.section`, `.section-alt`, `.section-header`, `.section-label`, `.content-card`, `.content-grid`, `.btn`, etc.

Add a comment `<!-- REPLACE_WITH_GOOGLE_CALENDAR_EMBED -->` where the iframe goes so the user knows where to paste their appointment schedule URL.

**Step 2: Verify page renders correctly**

Preview at desktop and mobile breakpoints.

**Step 3: Commit**

```bash
git add seminars.html
git commit -m "feat: add seminars page with booking widget placeholder"
```

---

### Task 3: Blog Page (Public)

**Files:**
- Create: `blog.html`
- Create: `js/blog.js`
- Modify: `css/style.css` (append blog-specific styles)

**Step 1: Create `blog.html`**

Page structure:
- Hero: "Research Blog" with subtitle about expert contributions
- Search bar + category filter dropdown
- Article cards grid (loaded from Firestore via `js/blog.js`)
- Each card shows: category tag, title, summary, author photo + name, date
- Clicking a card expands to full article view (rendered Markdown) in a modal or inline expand

**Step 2: Create `js/blog.js`**

Firebase module script that:
- Imports from `firebase-config.js`
- Queries Firestore `articles` collection where `status == "published"`, ordered by `publishedAt` desc
- Renders article cards into the grid
- Implements search (filters by title/summary text match client-side)
- Implements category filter dropdown
- Handles article detail view: when a card is clicked, fetches full article body, renders Markdown to HTML using `marked.js` (loaded via CDN), displays in a modal overlay
- Includes `<script type="module">` tag in the HTML

**Step 3: Add blog-specific CSS to `css/style.css`**

Append styles for:
- `.blog-search` — search bar styling matching existing form controls
- `.blog-filters` — filter bar layout
- `.article-card` — extends `.content-card` with author avatar + metadata row
- `.article-modal` — full-screen overlay for reading articles
- `.article-content` — rendered Markdown styling (h1-h6, p, code, blockquote, lists)

**Step 4: Verify blog page renders with empty state**

Should show "No articles published yet" message when Firestore is empty.

**Step 5: Commit**

```bash
git add blog.html js/blog.js css/style.css
git commit -m "feat: add public blog page with Firestore integration"
```

---

### Task 4: Writing Portal (Authenticated)

**Files:**
- Create: `write.html`
- Create: `js/write.js`
- Modify: `css/style.css` (append writer styles)

**Step 1: Create `write.html`**

Page structure:
- Auth gate: if not signed in, show sign-in prompt with Google button
- If signed in, show:
  - **Writer Dashboard:** tabs for "New Article" and "My Articles"
  - **New Article form:** title input, category dropdown (Science, Policy, Public Health, Opinion, How-To), summary textarea, EasyMDE Markdown editor for body, Submit button
  - **My Articles tab:** list of user's articles with status badges (draft/pending/published/rejected)

Load EasyMDE via CDN: `https://cdn.jsdelivr.net/npm/easymde/dist/easymde.min.css` and `https://cdn.jsdelivr.net/npm/easymde/dist/easymde.min.js`

**Step 2: Create `js/write.js`**

Firebase module script that:
- Imports auth utilities from `auth.js` and Firestore from `firebase-config.js`
- On page load, checks auth state — shows sign-in or dashboard
- Google Sign-In button handler
- Initializes EasyMDE on the textarea
- Submit handler: creates Firestore doc in `articles` collection with `status: "pending_review"`, `authorId`, `authorName`, `authorPhoto` from Firebase Auth user, `slug` from `shared.js slugify()`
- "My Articles" tab: queries Firestore where `authorId == currentUser.uid`, renders list with status badges
- Sign out button

**Step 3: Add writer CSS to `css/style.css`**

Append styles for:
- `.auth-gate` — centered sign-in prompt
- `.google-btn` — styled Google sign-in button (white bg, Google colors)
- `.writer-tabs` — tab navigation for dashboard
- `.writer-tab-content` — tab panels
- `.status-badge` — colored badges for draft/pending/published/rejected
- `.article-list-item` — row layout for My Articles list

**Step 4: Verify auth flow works**

Sign in with Google, see dashboard, sign out returns to auth gate. (Requires Firebase project to be configured.)

**Step 5: Commit**

```bash
git add write.html js/write.js css/style.css
git commit -m "feat: add authenticated writing portal with EasyMDE editor"
```

---

### Task 5: Videos Page

**Files:**
- Create: `videos.html`
- Create: `js/videos.js`
- Modify: `css/style.css` (append video styles)

**Step 1: Create `videos.html`**

Page structure:
- Hero: "Science Communication Hub" title
- Category filter tabs: All | Seminars | Science Communication | How-To Guides
- Video card grid loaded from Firestore via `js/videos.js`
- Each card: YouTube thumbnail (from `youtubeId`), title, category badge, description
- Clicking a card opens embedded YouTube player in a modal

**Step 2: Create `js/videos.js`**

Firebase module script that:
- Queries Firestore `videos` collection ordered by `order` field
- Renders video cards with YouTube thumbnails (`https://img.youtube.com/vi/{youtubeId}/mqdefault.jpg`)
- Category filter: re-renders grid filtered by selected category
- Modal with embedded YouTube iframe player on card click

**Step 3: Add video CSS to `css/style.css`**

Append styles for:
- `.video-card` — card with thumbnail aspect ratio container
- `.video-thumbnail` — 16:9 aspect ratio image container
- `.video-modal` — overlay with responsive YouTube iframe
- `.category-tabs` — horizontal tab filter bar
- `.category-tab.active` — active state styling

**Step 4: Verify page renders with empty state**

**Step 5: Commit**

```bash
git add videos.html js/videos.js css/style.css
git commit -m "feat: add video hub page with YouTube embeds from Firestore"
```

---

### Task 6: Model Policy Library

**Files:**
- Create: `policies.html`
- Create: `js/policies.js`
- Modify: `css/style.css` (append policy styles)

**Step 1: Create `policies.html`**

Page structure:
- Hero: "Model Policy Library" title, subtitle about evidence-based legislation templates
- Search bar + filter row: category dropdown (Scope of Practice, Informed Consent, Certificate of Need, Public Health Infrastructure, Other) + state dropdown (All States, then A-Z state list)
- Policy card grid from Firestore
- Each card: category tag, title, summary, state applicability badges, "Read Full Policy" button
- Clicking "Read Full Policy" expands to full text view (rendered Markdown) with optional PDF download button

**Step 2: Create `js/policies.js`**

Firebase module script that:
- Queries Firestore `policies` collection where `status == "published"`
- Renders policy cards into grid
- Search: client-side text match on title + summary
- Category filter: Firestore query with `.where('category', '==', selected)`
- State filter: client-side filter on `stateApplicability` array (contains selected state or "all")
- Detail view: expand card to show full `body` rendered as Markdown, plus PDF download link if `pdfUrl` exists

**Step 3: Add policy CSS to `css/style.css`**

Append styles for:
- `.policy-card` — card layout with state badges
- `.state-badge` — small pill badges for state applicability
- `.policy-detail` — expanded view with rich text content
- `.policy-filters` — search + filter row layout
- `.pdf-download-btn` — download button styling

**Step 4: Verify empty state rendering**

**Step 5: Commit**

```bash
git add policies.html js/policies.js css/style.css
git commit -m "feat: add model policy library with search and state filtering"
```

---

### Task 7: Education Page

**Files:**
- Create: `education.html`

**Step 1: Create `education.html`**

Static content page with:
- Hero: "Become a Science Communicator" title
- Section 1: "How to Become a Science Communicator" — step-by-step guide with icon cards
- Section 2: "Working with Legislators" — best practices for presenting research to lawmakers
- Section 3: "Communicating Research to the Public" — tips for translating complex science
- Section 4: "Resources & Reading Lists" — curated links to external resources, internal seminars, blog posts

Uses existing CSS classes: `.section`, `.pillars-grid`, `.pillar-card`, `.why-grid`, `.content-grid`, etc.

**Step 2: Verify page renders correctly**

**Step 3: Commit**

```bash
git add education.html
git commit -m "feat: add science communicator education page"
```

---

### Task 8: Admin Panel

**Files:**
- Create: `admin.html`
- Create: `js/admin.js`
- Modify: `css/style.css` (append admin styles)

**Step 1: Create `admin.html`**

Page structure:
- Auth gate: Google Sign-In required, then admin role check
- If not admin: "Access denied" message
- If admin: tabbed interface with 4 tabs:
  - **Blog Queue** — list of pending articles with approve/reject buttons, preview panel
  - **Policy Editor** — CRUD table of policies with Add/Edit/Delete, edit form with title/category/states/summary/body(EasyMDE)/pdfUrl fields
  - **Video Manager** — CRUD table of videos with Add/Edit/Delete/Reorder, form with title/youtubeUrl/category/description fields
  - **Users** — list of all users with role dropdown (contributor/admin)

**Step 2: Create `js/admin.js`**

Firebase module script that:
- Checks auth + admin role on load
- **Blog Queue tab:** queries articles where `status == "pending_review"`, renders list, approve button sets `status: "published"` + `publishedAt: new Date()`, reject button sets `status: "rejected"`
- **Policy Editor tab:** full CRUD on `policies` collection. Add/edit form with EasyMDE for body field. Delete with confirmation. Category and state multi-select.
- **Video Manager tab:** full CRUD on `videos` collection. YouTube ID auto-extracted from URL using `shared.js extractYouTubeId()`. Reorder via `order` field.
- **Users tab:** lists all users from `users` collection, admin can change `role` field via dropdown.

**Step 3: Add admin CSS to `css/style.css`**

Append styles for:
- `.admin-layout` — full-width admin layout
- `.admin-tabs` — tab bar styling
- `.admin-table` — data table styling
- `.admin-form` — form layout for CRUD operations
- `.admin-actions` — approve/reject button group
- `.admin-preview` — article preview panel
- `.access-denied` — centered denial message

**Step 4: Verify admin panel loads and shows access denied for non-admin**

**Step 5: Commit**

```bash
git add admin.html js/admin.js css/style.css
git commit -m "feat: add admin panel with blog, policy, video, and user management"
```

---

### Task 9: Final Integration & Polish

**Files:**
- Modify: `index.html` (update Research & Resources section to pull from Firestore)
- Modify: `js/main.js` (add Firestore integration for homepage)
- Modify: `css/style.css` (any responsive fixes)

**Step 1: Update homepage Research & Resources block**

Modify the 3 content cards in the `#news` section of `index.html`:
- Card 1 "Featured Guest Blog": dynamically load latest published article from Firestore
- Card 2 "Science News": link to blog page with "Science" category filter
- Card 3 "Policy Templates": link to policies page

Add a `<script type="module">` block or separate JS file that fetches the latest article and populates card 1.

**Step 2: Cross-page link verification**

Verify all inter-page links work: nav links, footer links, CTA buttons, card links.

**Step 3: Responsive testing**

Test all new pages at mobile (375px), tablet (768px), desktop (1440px) viewports.

**Step 4: Commit**

```bash
git add index.html js/main.js css/style.css
git commit -m "feat: integrate homepage with Firestore and final polish"
```

---

## Execution Notes

- **Firebase project must be created first** before any Firestore/Auth code can be tested. The user should create a Firebase project and web app, then paste config values into `js/firebase-config.js`.
- **First admin user** must be manually set in Firestore console: create a doc in `users` collection with the user's Firebase UID and `role: "admin"`.
- **Google Calendar embed URL** must be obtained from the user's Google Workspace and pasted into `seminars.html`.
- All Firebase SDK imports use CDN ES module imports — no build step required.
- EasyMDE and marked.js loaded via CDN — no npm install needed.
