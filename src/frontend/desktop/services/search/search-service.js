/**
 * Search Service
 * Provides full-text search capabilities across cards, tasks, files, and chat
 */

/**
 * Search service implementation
 */
class SearchService {
  constructor(config = {}) {
    this.config = {
      useMock: config.useMock !== false, // Default to mock mode
      apiBase: config.apiBase || '/api/local/search',
      ...config
    };
  }

  /**
   * Global search across all entity types
   * @param {string} query - Search query
   * @param {SearchOptions} options - Search options
   * @returns {Promise<SearchResults>}
   */
  async search(query, options = {}) {
    if (this.config.useMock) {
      return this._mockSearch(query, options);
    }

    const response = await fetch(this.config.apiBase, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, ...options })
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Search cards
   * @param {string} query - Search query
   * @param {EntitySearchOptions} options - Search options
   * @returns {Promise<Array<SearchResultItem>>}
   */
  async searchCards(query, options = {}) {
    if (this.config.useMock) {
      return this._mockSearchCards(query, options);
    }

    const response = await fetch(`${this.config.apiBase}/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, ...options })
    });

    if (!response.ok) {
      throw new Error(`Card search failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results;
  }

  /**
   * Search tasks
   * @param {string} query - Search query
   * @param {EntitySearchOptions} options - Search options
   * @returns {Promise<Array<SearchResultItem>>}
   */
  async searchTasks(query, options = {}) {
    if (this.config.useMock) {
      return this._mockSearchTasks(query, options);
    }

    const response = await fetch(`${this.config.apiBase}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, ...options })
    });

    if (!response.ok) {
      throw new Error(`Task search failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results;
  }

  /**
   * Search files
   * @param {string} query - Search query
   * @param {FileSearchOptions} options - Search options
   * @returns {Promise<Array<SearchResultItem>>}
   */
  async searchFiles(query, options = {}) {
    if (this.config.useMock) {
      return this._mockSearchFiles(query, options);
    }

    const response = await fetch(`${this.config.apiBase}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, ...options })
    });

    if (!response.ok) {
      throw new Error(`File search failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results;
  }

  /**
   * Search chat messages
   * @param {string} query - Search query
   * @param {ChatSearchOptions} options - Search options
   * @returns {Promise<Array<SearchResultItem>>}
   */
  async searchChat(query, options = {}) {
    if (this.config.useMock) {
      return this._mockSearchChat(query, options);
    }

    const response = await fetch(`${this.config.apiBase}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, ...options })
    });

    if (!response.ok) {
      throw new Error(`Chat search failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results;
  }

  /**
   * Reindex search indices
   * @param {string} entityType - Optional entity type to reindex
   * @returns {Promise<void>}
   */
  async reindex(entityType = null) {
    if (this.config.useMock) {
      console.log(`Mock reindex for ${entityType || 'all'}`);
      return;
    }

    const response = await fetch(`${this.config.apiBase}/reindex`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType })
    });

    if (!response.ok) {
      throw new Error(`Reindex failed: ${response.statusText}`);
    }
  }

  /**
   * Get index statistics
   * @returns {Promise<IndexStats>}
   */
  async getIndexStats() {
    if (this.config.useMock) {
      return this._mockGetIndexStats();
    }

    const response = await fetch(`${this.config.apiBase}/stats`);

    if (!response.ok) {
      throw new Error(`Get stats failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get search suggestions
   * @param {string} prefix - Search prefix
   * @param {number} limit - Maximum number of suggestions
   * @returns {Promise<Array<string>>}
   */
  async getSuggestions(prefix, limit = 10) {
    if (this.config.useMock) {
      return this._mockGetSuggestions(prefix, limit);
    }

    const params = new URLSearchParams({ prefix, limit: limit.toString() });
    const response = await fetch(`${this.config.apiBase}/suggestions?${params}`);

    if (!response.ok) {
      throw new Error(`Get suggestions failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.suggestions;
  }

  /**
   * Get search history
   * @param {number} limit - Maximum number of history items
   * @returns {Promise<Array<SearchHistoryItem>>}
   */
  async getHistory(limit = 20) {
    if (this.config.useMock) {
      return this._mockGetHistory(limit);
    }

    const params = new URLSearchParams({ limit: limit.toString() });
    const response = await fetch(`${this.config.apiBase}/history?${params}`);

    if (!response.ok) {
      throw new Error(`Get history failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.history;
  }

  /**
   * Clear search history
   * @returns {Promise<void>}
   */
  async clearHistory() {
    if (this.config.useMock) {
      console.log('Mock clear history');
      return;
    }

    const response = await fetch(`${this.config.apiBase}/history`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`Clear history failed: ${response.statusText}`);
    }
  }

  // Mock implementations
  _mockSearch(query, options = {}) {
    const lowerQuery = query.toLowerCase();
    const types = options.types || ['card', 'task', 'file', 'chat'];
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    let results = [];

    if (types.includes('card')) {
      results.push(...this._mockSearchCards(query, options));
    }
    if (types.includes('task')) {
      results.push(...this._mockSearchTasks(query, options));
    }
    if (types.includes('file')) {
      results.push(...this._mockSearchFiles(query, options));
    }
    if (types.includes('chat')) {
      results.push(...this._mockSearchChat(query, options));
    }

    // Sort by relevance
    results.sort((a, b) => b.score - a.score);

    const total = results.length;
    const items = results.slice(offset, offset + limit);

    return Promise.resolve({
      total,
      items,
      facets: {
        types: [
          { type: 'card', count: items.filter(i => i.type === 'card').length },
          { type: 'task', count: items.filter(i => i.type === 'task').length },
          { type: 'file', count: items.filter(i => i.type === 'file').length },
          { type: 'chat', count: items.filter(i => i.type === 'chat').length }
        ],
        tags: [
          { tag: 'important', count: 3 },
          { tag: 'work', count: 2 }
        ]
      },
      took: 15
    });
  }

  _mockSearchCards(query, options = {}) {
    const lowerQuery = query.toLowerCase();
    const mockCards = [
      {
        type: 'card',
        id: 'card-1',
        title: 'Product Roadmap',
        snippet: 'Q1 features include search functionality and file management...',
        score: lowerQuery.includes('search') ? 0.95 : 0.5,
        highlights: ['<mark>search</mark> functionality'],
        metadata: { tags: ['work', 'planning'] },
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now() - 3600000
      },
      {
        type: 'card',
        id: 'card-2',
        title: 'Meeting Notes',
        snippet: 'Discussed project timeline and resource allocation...',
        score: lowerQuery.includes('meeting') ? 0.9 : 0.3,
        highlights: ['<mark>Meeting</mark> Notes'],
        metadata: { tags: ['important', 'notes'] },
        createdAt: Date.now() - 172800000,
        updatedAt: Date.now() - 7200000
      }
    ];

    return mockCards.filter(card => 
      card.title.toLowerCase().includes(lowerQuery) ||
      card.snippet.toLowerCase().includes(lowerQuery)
    );
  }

  _mockSearchTasks(query, options = {}) {
    const lowerQuery = query.toLowerCase();
    const mockTasks = [
      {
        type: 'task',
        id: 'task-1',
        title: 'Implement search feature',
        snippet: 'Add full-text search capability to the application...',
        score: lowerQuery.includes('search') ? 0.93 : 0.4,
        highlights: ['Implement <mark>search</mark> feature'],
        metadata: { 
          status: 'in_progress', 
          priority: 8,
          assignee: 'user-1',
          dueDate: Date.now() + 86400000 * 7,
          tags: ['feature', 'important']
        },
        createdAt: Date.now() - 259200000,
        updatedAt: Date.now() - 3600000
      },
      {
        type: 'task',
        id: 'task-2',
        title: 'Update documentation',
        snippet: 'Document the new search API endpoints...',
        score: lowerQuery.includes('doc') ? 0.88 : 0.35,
        highlights: ['<mark>Document</mark> the new search API'],
        metadata: { 
          status: 'todo', 
          priority: 5,
          assignee: 'user-2',
          dueDate: Date.now() + 86400000 * 14,
          tags: ['documentation']
        },
        createdAt: Date.now() - 172800000,
        updatedAt: Date.now() - 86400000
      }
    ];

    return mockTasks.filter(task => 
      task.title.toLowerCase().includes(lowerQuery) ||
      task.snippet.toLowerCase().includes(lowerQuery)
    );
  }

  _mockSearchFiles(query, options = {}) {
    const lowerQuery = query.toLowerCase();
    const mockFiles = [
      {
        type: 'file',
        id: 'file-1',
        title: 'search-spec.md',
        snippet: '/docs/specs/search-spec.md',
        score: lowerQuery.includes('search') ? 1.0 : 0.5,
        highlights: [],
        metadata: {
          path: '/docs/specs/search-spec.md',
          size: 15360,
          mimeType: 'text/markdown'
        },
        createdAt: Date.now() - 432000000,
        updatedAt: Date.now() - 86400000
      },
      {
        type: 'file',
        id: 'file-2',
        title: 'presentation.pdf',
        snippet: '/documents/presentation.pdf',
        score: lowerQuery.includes('presentation') ? 1.0 : 0.3,
        highlights: [],
        metadata: {
          path: '/documents/presentation.pdf',
          size: 2048576,
          mimeType: 'application/pdf'
        },
        createdAt: Date.now() - 604800000,
        updatedAt: Date.now() - 259200000
      }
    ];

    return mockFiles.filter(file => 
      file.title.toLowerCase().includes(lowerQuery) ||
      file.snippet.toLowerCase().includes(lowerQuery)
    );
  }

  _mockSearchChat(query, options = {}) {
    const lowerQuery = query.toLowerCase();
    const mockChats = [
      {
        type: 'chat',
        id: 'chat-1',
        title: 'Alice in #general',
        snippet: 'Has anyone tested the new search feature yet?',
        score: lowerQuery.includes('search') ? 0.7 : 0.25,
        highlights: [],
        metadata: {
          senderId: 'user-alice',
          senderName: 'Alice',
          roomId: 'room-general',
          roomName: '#general'
        },
        createdAt: Date.now() - 7200000,
        updatedAt: Date.now() - 7200000
      },
      {
        type: 'chat',
        id: 'chat-2',
        title: 'Bob in #dev',
        snippet: 'The search API is working great!',
        score: lowerQuery.includes('search') ? 0.68 : 0.22,
        highlights: [],
        metadata: {
          senderId: 'user-bob',
          senderName: 'Bob',
          roomId: 'room-dev',
          roomName: '#dev'
        },
        createdAt: Date.now() - 3600000,
        updatedAt: Date.now() - 3600000
      }
    ];

    return mockChats.filter(chat => 
      chat.snippet.toLowerCase().includes(lowerQuery)
    );
  }

  _mockGetIndexStats() {
    return Promise.resolve({
      totalDocuments: 42,
      indexSize: 1024 * 512, // 512 KB
      lastIndexTime: Date.now() - 3600000,
      entityCounts: {
        card: 15,
        task: 18,
        file: 7,
        chat: 2
      }
    });
  }

  _mockGetSuggestions(prefix, limit) {
    const mockSuggestions = [
      'search functionality',
      'search API',
      'search feature',
      'meeting notes',
      'presentation',
      'project timeline',
      'documentation',
      'roadmap'
    ];

    const filtered = mockSuggestions
      .filter(s => s.toLowerCase().startsWith(prefix.toLowerCase()))
      .slice(0, limit);

    return Promise.resolve(filtered);
  }

  _mockGetHistory(limit) {
    const mockHistory = [
      {
        query: 'search feature',
        timestamp: Date.now() - 3600000,
        resultCount: 5
      },
      {
        query: 'meeting',
        timestamp: Date.now() - 7200000,
        resultCount: 3
      },
      {
        query: 'documentation',
        timestamp: Date.now() - 86400000,
        resultCount: 8
      }
    ];

    return Promise.resolve(mockHistory.slice(0, limit));
  }
}

// Export for use in browser environment
if (typeof window !== 'undefined') {
  window.SearchService = SearchService;
}

// Export for use in module environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SearchService;
}

/**
 * Type definitions for better IDE support
 * 
 * @typedef {Object} SearchOptions
 * @property {Array<string>} [types] - Entity types to search
 * @property {number} [limit] - Maximum results
 * @property {number} [offset] - Pagination offset
 * @property {string} [sortBy] - Sort field (relevance|date|name)
 * @property {string} [sortOrder] - Sort order (asc|desc)
 * @property {DateRange} [dateRange] - Date range filter
 * @property {Array<string>} [tags] - Tag filters
 * 
 * @typedef {Object} DateRange
 * @property {number} [start] - Start timestamp
 * @property {number} [end] - End timestamp
 * 
 * @typedef {Object} SearchResults
 * @property {number} total - Total results
 * @property {Array<SearchResultItem>} items - Result items
 * @property {SearchFacets} facets - Result facets
 * @property {number} took - Query time in ms
 * 
 * @typedef {Object} SearchResultItem
 * @property {string} type - Entity type
 * @property {string} id - Entity ID
 * @property {string} title - Result title
 * @property {string} snippet - Content snippet
 * @property {number} score - Relevance score
 * @property {Array<string>} highlights - Highlighted matches
 * @property {Object} metadata - Additional metadata
 * @property {number} createdAt - Creation timestamp
 * @property {number} updatedAt - Update timestamp
 * 
 * @typedef {Object} SearchFacets
 * @property {Array<TypeCount>} types - Type counts
 * @property {Array<TagCount>} tags - Tag counts
 * 
 * @typedef {Object} TypeCount
 * @property {string} type - Type name
 * @property {number} count - Count
 * 
 * @typedef {Object} TagCount
 * @property {string} tag - Tag name
 * @property {number} count - Count
 * 
 * @typedef {Object} IndexStats
 * @property {number} totalDocuments - Total indexed documents
 * @property {number} indexSize - Index size in bytes
 * @property {number} lastIndexTime - Last index timestamp
 * @property {Object} entityCounts - Entity type counts
 * 
 * @typedef {Object} SearchHistoryItem
 * @property {string} query - Search query
 * @property {number} timestamp - Search timestamp
 * @property {number} resultCount - Result count
 */
