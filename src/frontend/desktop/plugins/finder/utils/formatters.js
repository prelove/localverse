/**
 * Formatting utilities for file information
 */

/**
 * Format file size to human-readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size string
 */
export function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes == null) return '-';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return (bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
}

/**
 * Format timestamp to relative time string
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} - Relative time string (e.g., "2天前", "1小时前")
 */
export function formatDate(timestamp) {
  if (!timestamp) return '-';
  
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(months / 12);
  
  if (years > 0) {
    return `${years}年前`;
  } else if (months > 0) {
    return `${months}月前`;
  } else if (days > 0) {
    return `${days}天前`;
  } else if (hours > 0) {
    return `${hours}小时前`;
  } else if (minutes > 0) {
    return `${minutes}分钟前`;
  } else {
    return '刚刚';
  }
}

/**
 * Format absolute date
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} - Formatted date string
 */
export function formatAbsoluteDate(timestamp) {
  if (!timestamp) return '-';
  
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
export function escapeHtml(text) {
  if (text == null) return '';
  
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Highlight matching text in search results
 * @param {string} text - Original text
 * @param {string} query - Search query
 * @returns {string} - HTML with highlighted text
 */
export function highlightMatch(text, query) {
  if (!text || !query) return escapeHtml(text);
  
  const escapedText = escapeHtml(text);
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  
  return escapedText.replace(regex, '<mark>$1</mark>');
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
export function truncate(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Build FTS5 query from user input
 * @param {string} query - User search query
 * @returns {string} - FTS5 query
 */
export function buildFtsQuery(query) {
  if (!query) return '';
  
  // Escape FTS5 special characters
  query = query.replace(/[:"*]/g, ' ');
  
  // Split into terms
  const terms = query.trim().split(/\s+/).filter(t => t.length > 0);
  
  if (terms.length === 0) return '';
  
  // Build query with prefix matching
  return terms.map(term => `${term}*`).join(' ');
}
