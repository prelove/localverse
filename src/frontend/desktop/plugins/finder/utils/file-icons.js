/**
 * File icon utilities
 * Maps file extensions to appropriate icons
 */

const FILE_ICONS = {
  // Documents
  'pdf': '📄',
  'doc': '📝',
  'docx': '📝',
  'txt': '📝',
  'md': '📝',
  'markdown': '📝',
  
  // Spreadsheets
  'xls': '📊',
  'xlsx': '📊',
  'csv': '📊',
  
  // Presentations
  'ppt': '📊',
  'pptx': '📊',
  
  // Images
  'jpg': '🖼️',
  'jpeg': '🖼️',
  'png': '🖼️',
  'gif': '🖼️',
  'svg': '🖼️',
  'webp': '🖼️',
  'bmp': '🖼️',
  'ico': '🖼️',
  
  // Code
  'js': '📜',
  'ts': '📜',
  'jsx': '📜',
  'tsx': '📜',
  'java': '☕',
  'py': '🐍',
  'rb': '💎',
  'php': '🐘',
  'go': '🐹',
  'rs': '🦀',
  'c': '📜',
  'cpp': '📜',
  'h': '📜',
  'hpp': '📜',
  'cs': '📜',
  'sh': '📜',
  'bash': '📜',
  
  // Web
  'html': '🌐',
  'htm': '🌐',
  'css': '🎨',
  'scss': '🎨',
  'sass': '🎨',
  'less': '🎨',
  
  // Data
  'json': '📋',
  'xml': '📋',
  'yaml': '📋',
  'yml': '📋',
  'toml': '📋',
  'ini': '⚙️',
  'conf': '⚙️',
  'config': '⚙️',
  
  // Archives
  'zip': '🗜️',
  'rar': '🗜️',
  '7z': '🗜️',
  'tar': '🗜️',
  'gz': '🗜️',
  'bz2': '🗜️',
  
  // Media
  'mp3': '🎵',
  'wav': '🎵',
  'flac': '🎵',
  'mp4': '🎬',
  'avi': '🎬',
  'mkv': '🎬',
  'mov': '🎬',
  
  // Database
  'db': '🗄️',
  'sqlite': '🗄️',
  'sql': '🗄️',
  
  // Other
  'log': '📋',
  'exe': '⚙️',
  'dll': '⚙️',
  'so': '⚙️',
  'jar': '☕'
};

const CATEGORY_ICONS = {
  document: '📄',
  image: '🖼️',
  code: '📜',
  archive: '🗜️',
  media: '🎵',
  folder: '📁',
  unknown: '📄'
};

/**
 * Get icon for a file based on its extension
 * @param {Object} file - File object with extension property
 * @returns {string} - Icon emoji
 */
export function getFileIcon(file) {
  if (file.isDirectory) {
    return CATEGORY_ICONS.folder;
  }
  
  const ext = file.extension?.toLowerCase();
  return FILE_ICONS[ext] || CATEGORY_ICONS.unknown;
}

/**
 * Get file category from extension
 * @param {string} extension - File extension
 * @returns {string} - Category name
 */
export function getFileCategory(extension) {
  if (!extension) return 'unknown';
  
  const ext = extension.toLowerCase();
  
  // Documents
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'markdown', 'rtf', 'odt'].includes(ext)) {
    return 'document';
  }
  
  // Images
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)) {
    return 'image';
  }
  
  // Code
  if (['js', 'ts', 'jsx', 'tsx', 'java', 'py', 'rb', 'php', 'go', 'rs', 
       'c', 'cpp', 'h', 'hpp', 'cs', 'sh', 'bash', 'html', 'css', 'scss'].includes(ext)) {
    return 'code';
  }
  
  // Archives
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
    return 'archive';
  }
  
  // Media
  if (['mp3', 'wav', 'flac', 'mp4', 'avi', 'mkv', 'mov'].includes(ext)) {
    return 'media';
  }
  
  return 'other';
}

/**
 * Get category icon
 * @param {string} category - Category name
 * @returns {string} - Icon emoji
 */
export function getCategoryIcon(category) {
  return CATEGORY_ICONS[category] || CATEGORY_ICONS.unknown;
}
