/**
 * LinkParser - Parses and handles bidirectional links in Wiki cards
 * Supports [[Card Title]] syntax
 */
class LinkParser {
  constructor() {
    this.linkRegex = /\[\[([^\]]+)\]\]/g;
    this.tagRegex = /#([a-zA-Z0-9_\u4e00-\u9fa5]+)/g;
  }

  /**
   * Parse links from content
   * @param {string} content - Markdown content
   * @returns {Array} Array of link objects
   */
  parseLinks(content) {
    if (!content) return [];
    
    const links = [];
    let match;
    
    // Reset regex state
    this.linkRegex.lastIndex = 0;
    
    while ((match = this.linkRegex.exec(content)) !== null) {
      links.push({
        text: match[1].trim(),
        start: match.index,
        end: match.index + match[0].length,
        raw: match[0]
      });
    }
    
    return links;
  }

  /**
   * Parse tags from content
   * @param {string} content - Markdown content
   * @returns {Array} Array of tag strings
   */
  parseTags(content) {
    if (!content) return [];
    
    const tags = new Set();
    let match;
    
    // Reset regex state
    this.tagRegex.lastIndex = 0;
    
    while ((match = this.tagRegex.exec(content)) !== null) {
      tags.add(match[1]);
    }
    
    return Array.from(tags);
  }

  /**
   * Render links as HTML
   * @param {string} content - Markdown content
   * @param {Array} cards - All available cards
   * @param {Function} onLinkClick - Callback for link clicks
   * @returns {string} Content with rendered links
   */
  renderLinks(content, cards = [], onLinkClick = null) {
    if (!content) return '';
    
    // Create a map of card titles to IDs for quick lookup
    const cardMap = new Map();
    cards.forEach(card => {
      cardMap.set(card.title.toLowerCase(), card.id);
    });
    
    return content.replace(this.linkRegex, (match, cardTitle) => {
      const trimmedTitle = cardTitle.trim();
      const cardId = cardMap.get(trimmedTitle.toLowerCase());
      
      if (cardId) {
        // Existing card - create clickable link
        const onClick = onLinkClick 
          ? `onclick="event.preventDefault(); (${onLinkClick.toString()})('${cardId}')"`
          : '';
        return `<a href="#/wiki/card/${cardId}" class="wiki-link" data-card-id="${cardId}" ${onClick}>${this.escapeHtml(trimmedTitle)}</a>`;
      } else {
        // Non-existing card - show as missing
        return `<span class="wiki-link-missing" title="Card not found">${this.escapeHtml(trimmedTitle)}</span>`;
      }
    });
  }

  /**
   * Find backlinks for a card
   * @param {string} cardId - Target card ID
   * @param {string} cardTitle - Target card title
   * @param {Array} allCards - All cards to search
   * @returns {Array} Array of cards that link to the target
   */
  findBacklinks(cardId, cardTitle, allCards) {
    if (!cardTitle || !allCards) return [];
    
    const backlinks = [];
    const targetTitleLower = cardTitle.toLowerCase();
    
    for (const card of allCards) {
      if (card.id === cardId) continue;
      
      const links = this.parseLinks(card.content);
      const hasLink = links.some(link => 
        link.text.toLowerCase() === targetTitleLower
      );
      
      if (hasLink) {
        backlinks.push({
          cardId: card.id,
          cardTitle: card.title,
          columnId: card.columnId
        });
      }
    }
    
    return backlinks;
  }

  /**
   * Get all linked card titles from content
   * @param {string} content - Markdown content
   * @returns {Array} Array of unique card titles
   */
  getLinkedTitles(content) {
    const links = this.parseLinks(content);
    return [...new Set(links.map(link => link.text))];
  }

  /**
   * Update links when a card title changes
   * @param {string} oldTitle - Old card title
   * @param {string} newTitle - New card title
   * @param {string} content - Content to update
   * @returns {string} Updated content
   */
  updateLinksForRename(oldTitle, newTitle, content) {
    if (!content || !oldTitle || !newTitle) return content;
    
    const oldLinkPattern = `\\[\\[${this.escapeRegex(oldTitle)}\\]\\]`;
    const regex = new RegExp(oldLinkPattern, 'gi');
    
    return content.replace(regex, `[[${newTitle}]]`);
  }

  /**
   * Check if content has any links
   * @param {string} content - Markdown content
   * @returns {boolean} True if content has links
   */
  hasLinks(content) {
    if (!content) return false;
    this.linkRegex.lastIndex = 0;
    return this.linkRegex.test(content);
  }

  /**
   * Check if content has any tags
   * @param {string} content - Markdown content
   * @returns {boolean} True if content has tags
   */
  hasTags(content) {
    if (!content) return false;
    this.tagRegex.lastIndex = 0;
    return this.tagRegex.test(content);
  }

  /**
   * Insert a link at cursor position
   * @param {string} content - Current content
   * @param {number} cursorPos - Cursor position
   * @param {string} cardTitle - Card title to link
   * @returns {Object} Updated content and new cursor position
   */
  insertLink(content, cursorPos, cardTitle) {
    const linkText = `[[${cardTitle}]]`;
    const before = content.slice(0, cursorPos);
    const after = content.slice(cursorPos);
    
    return {
      content: before + linkText + after,
      cursorPos: cursorPos + linkText.length
    };
  }

  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Escape regex special characters
   * @param {string} string - String to escape
   * @returns {string} Escaped string
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Extract link context (surrounding text)
   * @param {string} content - Full content
   * @param {Object} link - Link object with start/end positions
   * @param {number} contextLength - Characters before and after
   * @returns {string} Context string
   */
  getLinkContext(content, link, contextLength = 50) {
    const start = Math.max(0, link.start - contextLength);
    const end = Math.min(content.length, link.end + contextLength);
    
    let context = content.slice(start, end);
    
    // Add ellipsis if truncated
    if (start > 0) context = '...' + context;
    if (end < content.length) context = context + '...';
    
    return context.trim();
  }

  /**
   * Validate link syntax
   * @param {string} linkText - Link text to validate
   * @returns {boolean} True if valid
   */
  isValidLink(linkText) {
    return /^\[\[.+\]\]$/.test(linkText);
  }

  /**
   * Convert plain text references to links
   * @param {string} content - Content to process
   * @param {Array} cardTitles - Available card titles
   * @returns {string} Content with auto-linked references
   */
  autoLinkReferences(content, cardTitles) {
    if (!content || !cardTitles || cardTitles.length === 0) return content;
    
    let result = content;
    
    // Sort by length (longest first) to avoid partial matches
    const sortedTitles = [...cardTitles].sort((a, b) => b.length - a.length);
    
    for (const title of sortedTitles) {
      // Only auto-link if not already linked
      const pattern = new RegExp(`(?<!\\[\\[)${this.escapeRegex(title)}(?!\\]\\])`, 'gi');
      result = result.replace(pattern, `[[${title}]]`);
    }
    
    return result;
  }
}

export default LinkParser;
