/* ============================================
   SAFE Research Institute - Videos Page
   Loads videos from Firestore, supports
   category filtering, and plays videos in
   a responsive YouTube modal.
   ============================================ */

import { db } from './firebase-config.js';
import { collection, query, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { extractYouTubeId } from './shared.js';

// --- DOM References ---
const videoGrid = document.getElementById('videoGrid');
const videoEmptyState = document.getElementById('videoEmptyState');
const categoryTabs = document.getElementById('categoryTabs');
const videoModal = document.getElementById('videoModal');
const videoModalBackdrop = document.getElementById('videoModalBackdrop');
const videoModalClose = document.getElementById('videoModalClose');
const videoModalTitle = document.getElementById('videoModalTitle');
const videoModalIframeWrap = document.getElementById('videoModalIframeWrap');

// --- State ---
let allVideos = [];
let activeCategory = 'All';

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => {
  loadVideos();
  bindEvents();
});

/**
 * Fetch all videos from Firestore, ordered by the `order` field ascending.
 */
async function loadVideos() {
  try {
    const videosRef = collection(db, 'videos');
    const q = query(videosRef, orderBy('order', 'asc'));
    const snapshot = await getDocs(q);

    allVideos = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        title: data.title || '',
        youtubeUrl: data.youtubeUrl || '',
        youtubeId: data.youtubeId || extractYouTubeId(data.youtubeUrl) || '',
        category: data.category || '',
        description: data.description || '',
        order: data.order || 0
      };
    });

    renderVideoGrid(allVideos);
  } catch (error) {
    console.error('Error loading videos:', error);
    showEmptyState();
  }
}

/**
 * Build a single video card element using safe DOM methods.
 * @param {Object} video - Video data object.
 * @returns {HTMLElement} The video card element.
 */
function buildVideoCard(video) {
  const card = document.createElement('article');
  card.className = 'video-card';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', 'Play video: ' + video.title);

  // Thumbnail container
  const thumbWrap = document.createElement('div');
  thumbWrap.className = 'video-thumbnail';

  const thumbImg = document.createElement('img');
  thumbImg.src = video.youtubeId
    ? 'https://img.youtube.com/vi/' + video.youtubeId + '/mqdefault.jpg'
    : '';
  thumbImg.alt = video.title;
  thumbImg.loading = 'lazy';
  thumbWrap.appendChild(thumbImg);

  // Play overlay icon
  const playOverlay = document.createElement('div');
  playOverlay.className = 'video-play-overlay';
  const playSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  playSvg.setAttribute('viewBox', '0 0 24 24');
  playSvg.setAttribute('fill', 'currentColor');
  const playPath = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  playPath.setAttribute('points', '5 3 19 12 5 21 5 3');
  playSvg.appendChild(playPath);
  playOverlay.appendChild(playSvg);
  thumbWrap.appendChild(playOverlay);

  card.appendChild(thumbWrap);

  // Content area
  const content = document.createElement('div');
  content.className = 'video-card-content';

  // Category badge
  const categoryBadge = document.createElement('span');
  categoryBadge.className = 'video-card-category';
  categoryBadge.textContent = video.category;
  content.appendChild(categoryBadge);

  // Title
  const titleEl = document.createElement('h3');
  titleEl.className = 'video-card-title';
  titleEl.textContent = video.title;
  content.appendChild(titleEl);

  // Description snippet
  const descEl = document.createElement('p');
  descEl.className = 'video-card-description';
  descEl.textContent = video.description;
  content.appendChild(descEl);

  card.appendChild(content);

  // Event listeners
  card.addEventListener('click', () => {
    openVideoModal(video.youtubeId, video.title);
  });
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openVideoModal(video.youtubeId, video.title);
    }
  });

  return card;
}

/**
 * Render video cards into the grid using safe DOM methods.
 * Filters by the currently active category.
 * @param {Array} videos - Array of video data objects.
 */
function renderVideoGrid(videos) {
  let filtered = videos;

  if (activeCategory !== 'All') {
    filtered = videos.filter(v => v.category === activeCategory);
  }

  if (!filtered || filtered.length === 0) {
    showEmptyState();
    return;
  }

  videoEmptyState.style.display = 'none';
  videoGrid.style.display = '';

  // Clear existing content
  while (videoGrid.firstChild) {
    videoGrid.removeChild(videoGrid.firstChild);
  }

  // Build and append each card
  filtered.forEach(video => {
    videoGrid.appendChild(buildVideoCard(video));
  });
}

/**
 * Show the empty state message and hide the grid.
 */
function showEmptyState() {
  videoGrid.style.display = 'none';
  videoEmptyState.style.display = '';
}

/**
 * Open the video modal with a responsive YouTube iframe embed.
 * @param {string} youtubeId - The YouTube video ID.
 * @param {string} title - The video title.
 */
function openVideoModal(youtubeId, title) {
  if (!youtubeId) return;

  // Set title
  videoModalTitle.textContent = title || '';

  // Clear any existing iframe
  while (videoModalIframeWrap.firstChild) {
    videoModalIframeWrap.removeChild(videoModalIframeWrap.firstChild);
  }

  // Create iframe
  const iframe = document.createElement('iframe');
  iframe.src = 'https://www.youtube.com/embed/' + youtubeId + '?autoplay=1&rel=0';
  iframe.setAttribute('frameborder', '0');
  iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
  iframe.setAttribute('allowfullscreen', '');
  iframe.title = title || 'YouTube Video';
  videoModalIframeWrap.appendChild(iframe);

  // Show modal
  videoModal.classList.add('active');
  videoModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // Focus close button for accessibility
  videoModalClose.focus();
}

/**
 * Close the video modal, remove iframe to stop playback.
 */
function closeVideoModal() {
  videoModal.classList.remove('active');
  videoModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';

  // Remove iframe to stop playback
  while (videoModalIframeWrap.firstChild) {
    videoModalIframeWrap.removeChild(videoModalIframeWrap.firstChild);
  }

  // Clear title
  videoModalTitle.textContent = '';
}

/**
 * Update the active category tab and re-render the grid.
 * @param {string} category - The selected category.
 */
function setActiveCategory(category) {
  activeCategory = category;

  // Update tab active states
  const tabs = categoryTabs.querySelectorAll('.category-tab');
  tabs.forEach(tab => {
    const isActive = tab.dataset.category === category;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  // Re-render grid with new filter
  renderVideoGrid(allVideos);
}

/**
 * Bind event listeners for category tabs and modal controls.
 */
function bindEvents() {
  // Category tab clicks
  categoryTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.category-tab');
    if (tab && tab.dataset.category) {
      setActiveCategory(tab.dataset.category);
    }
  });

  // Modal close button
  videoModalClose.addEventListener('click', closeVideoModal);

  // Modal backdrop click
  videoModalBackdrop.addEventListener('click', closeVideoModal);

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && videoModal.classList.contains('active')) {
      closeVideoModal();
    }
  });
}
