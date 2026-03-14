# SAFE Research Institute Website — Firebase Expansion Design

**Date:** 2026-03-11
**Status:** Approved

## Overview

Expand the existing static SAFE Research Institute website with Firebase-powered features: seminar booking, guest blog with auth, YouTube video curation, model policy library, science communication education, and an admin panel.

## Stack

- **Existing:** Static HTML/CSS/JS (Inter font, navy/gold design system)
- **New:** Firebase Auth (Google Sign-In), Firestore, Firebase Hosting
- **Scheduling:** Google Calendar Appointment Schedules (embedded)
- **Blog editor:** EasyMDE (lightweight Markdown editor)

## Architecture

### Firebase Project Setup

- Firebase Auth with Google provider enabled
- Firestore database with collections: `articles`, `policies`, `videos`, `users`
- Security rules: public read for published content, authenticated write for contributors, admin-only for approvals/CMS operations
- Admin role stored in Firestore `users` collection (`role: "admin"`)

### New Pages

| Page | Path | Auth Required | Description |
|------|------|---------------|-------------|
| Seminars | `/seminars.html` | No | Google Calendar booking widget + upcoming/past events |
| Blog | `/blog.html` | No | Published articles grid with search |
| Write | `/write.html` | Google Sign-In | Markdown editor for submitting articles |
| Videos | `/videos.html` | No | Curated YouTube embeds by category |
| Policies | `/policies.html` | No | Model policy library with search/filter |
| Education | `/education.html` | No | Science communicator guides + resources |
| Admin | `/admin.html` | Admin only | CMS for blog approvals, policies, videos |

### Feature Details

#### 1. Seminar Booking (`seminars.html`)

- Embedded Google Calendar Appointment Schedule iframe
- Monthly recurring seminars — visitors pick a slot, get Google Meet link automatically
- Page sections:
  - **Upcoming Seminars** — next scheduled events with topic/speaker info
  - **Book a Session** — embedded scheduling widget
  - **Past Seminars** — links to YouTube recordings
- No custom backend needed — Google Calendar handles scheduling

#### 2. Guest Blog (`blog.html` + `write.html`)

**Public blog page (`blog.html`):**
- Fetches published articles from Firestore (`status: "published"`)
- Card grid layout matching existing design
- Search by title/topic, filter by category
- Individual article view rendered from Markdown

**Writing portal (`write.html`):**
- Firebase Auth Google Sign-In gate
- EasyMDE Markdown editor with preview
- Form fields: title, category (dropdown), summary, body (markdown)
- Submit button sets `status: "pending_review"`
- Writer dashboard: see own drafts, pending, published articles

**Firestore `articles` collection schema:**
```
{
  id: auto,
  title: string,
  slug: string,
  category: string,
  summary: string,
  body: string (markdown),
  authorId: string (Firebase UID),
  authorName: string,
  authorPhoto: string (Google profile URL),
  status: "draft" | "pending_review" | "published" | "rejected",
  createdAt: timestamp,
  updatedAt: timestamp,
  publishedAt: timestamp | null
}
```

#### 3. YouTube Video Hub (`videos.html`)

- Admin adds videos via CMS (YouTube URL, title, category, description)
- Categories: Seminars, Science Communication, How-To Guides
- Video cards with embedded YouTube player on click/expand
- Responsive grid layout

**Firestore `videos` collection schema:**
```
{
  id: auto,
  title: string,
  youtubeUrl: string,
  youtubeId: string (extracted from URL),
  category: "seminars" | "science-communication" | "how-to",
  description: string,
  order: number,
  createdAt: timestamp
}
```

#### 4. Model Policy Library (`policies.html`)

- Searchable/filterable policy template library
- Filter by: category, state applicability
- Each policy shows: title, summary, full text, optional PDF download
- Categories: Scope of Practice, Informed Consent, Certificate of Need, Public Health Infrastructure, etc.

**Firestore `policies` collection schema:**
```
{
  id: auto,
  title: string,
  slug: string,
  category: string,
  stateApplicability: string[] (e.g., ["all"] or ["CA", "FL", "TX"]),
  summary: string,
  body: string (rich text / markdown),
  pdfUrl: string | null,
  status: "draft" | "published",
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### 5. Science Communicator Education (`education.html`)

- Primarily static content with curated sections:
  - How to Become a Science Communicator
  - Working with Legislators
  - Communicating Research to the Public
  - Resources & Reading Lists
- Links to relevant seminars, blog posts, and videos
- Can be enhanced later with CMS-managed content

#### 6. Admin Panel (`admin.html`)

- Protected by Firebase Auth + admin role check
- Tabbed interface:
  - **Blog Queue:** Review pending articles, approve/reject with notes
  - **Policy Editor:** CRUD for model policy templates (rich text editor)
  - **Video Manager:** Add/edit/remove/reorder YouTube videos
  - **User Management:** View contributors, assign admin roles
- Same design system (navy/gold, Inter font) as main site

### Firestore Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Articles: public read for published, auth write, admin approve
    match /articles/{articleId} {
      allow read: if resource.data.status == "published" || request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null && (
        request.auth.uid == resource.data.authorId ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin"
      );
    }
    // Policies: public read for published, admin write
    match /policies/{policyId} {
      allow read: if resource.data.status == "published";
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }
    // Videos: public read, admin write
    match /videos/{videoId} {
      allow read: if true;
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }
    // Users: self-read, admin write
    match /users/{userId} {
      allow read: if request.auth.uid == userId || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
      allow create: if request.auth.uid == userId;
    }
  }
}
```

### Navigation Updates

Add to main nav: **Seminars** | **Blog** | **Videos** | **Policies** | **Education**

Keep existing: Our Work | About | Task Forces | Research | Contact | Join a Task Force (CTA)

New nav structure:
```
Logo | Seminars | Blog | Videos | Policies | Education | About | [Join a Task Force]
```

### Design Continuity

All new pages use:
- Same `css/style.css` design system (extended with new component styles)
- Same header/footer/marquee bar
- Same navy/gold color scheme, Inter font
- Card-based layouts matching existing pillar/taskforce cards
- Responsive breakpoints already defined

## What's NOT in Scope

- Custom video hosting (YouTube only)
- Payment processing / donations (Givebutter integration is separate)
- SAFE Action 501(c)(4) site (separate domain)
- Real-time collaborative editing on blog posts
- Comments on blog posts (can be added later)
