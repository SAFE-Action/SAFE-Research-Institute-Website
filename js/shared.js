/* ============================================
   SAFE Research Institute - Shared Utility Functions
   ============================================ */

/**
 * Convert a text string into a URL-friendly slug.
 * Lowercases, replaces non-alphanumeric characters with hyphens,
 * collapses consecutive hyphens, and trims leading/trailing hyphens.
 * @param {string} text - The input string.
 * @returns {string} The slugified string.
 */
export function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-')   // Replace spaces and non-word chars with hyphens
    .replace(/^-+|-+$/g, '');     // Remove leading/trailing hyphens
}

/**
 * Extract a YouTube video ID from various YouTube URL formats.
 * Supports standard watch URLs, short URLs (youtu.be), and embed URLs.
 * @param {string} url - A YouTube URL.
 * @returns {string|null} The video ID, or null if not found.
 */
export function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Return a human-readable relative time string (e.g. "3 hours ago").
 * Accepts a Date object, a Firestore Timestamp, or a date string.
 * @param {Date|{toDate: function}|string|number} date - The date to format.
 * @returns {string} A relative time string.
 */
export function timeAgo(date) {
  // Handle Firestore Timestamps
  if (date && typeof date.toDate === 'function') {
    date = date.toDate();
  }
  // Ensure we have a Date object
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  if (isNaN(date.getTime())) return '';

  const now = Date.now();
  const seconds = Math.floor((now - date.getTime()) / 1000);

  if (seconds < 0) return 'just now';

  const intervals = [
    { label: 'year',   seconds: 31536000 },
    { label: 'month',  seconds: 2592000 },
    { label: 'week',   seconds: 604800 },
    { label: 'day',    seconds: 86400 },
    { label: 'hour',   seconds: 3600 },
    { label: 'minute', seconds: 60 }
  ];

  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) {
      return `${count} ${interval.label}${count !== 1 ? 's' : ''} ago`;
    }
  }

  return 'just now';
}
