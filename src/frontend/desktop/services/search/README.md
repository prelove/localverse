# Search Service

Full-text search service for Localverse OS.

## Features

- Global search across all entity types (cards, tasks, files, chat)
- Type-specific search (searchCards, searchTasks, searchFiles, searchChat)
- Search suggestions and autocomplete
- Search history tracking
- Index management and statistics
- Mock mode for development

## Usage

```javascript
// Create search service (defaults to mock mode)
const searchService = new SearchService({
  useMock: true,  // Set to false to use real API
  apiBase: '/api/local/search'
});

// Global search
const results = await searchService.search('project', {
  types: ['card', 'task'],
  limit: 20,
  sortBy: 'relevance'
});

console.log(`Found ${results.total} results in ${results.took}ms`);
results.items.forEach(item => {
  console.log(`${item.type}: ${item.title} (score: ${item.score})`);
});

// Search specific entity type
const cards = await searchService.searchCards('meeting', {
  tags: ['important'],
  dateRange: {
    start: Date.now() - 7 * 86400000, // Last 7 days
    end: Date.now()
  }
});

// Get search suggestions
const suggestions = await searchService.getSuggestions('sea', 10);
// Returns: ['search functionality', 'search API', 'search feature']

// Get search history
const history = await searchService.getHistory(10);

// Get index statistics
const stats = await searchService.getIndexStats();
console.log(`Indexed ${stats.totalDocuments} documents`);
console.log('Entity counts:', stats.entityCounts);

// Reindex
await searchService.reindex(); // Reindex all
await searchService.reindex('card'); // Reindex only cards

// Clear history
await searchService.clearHistory();
```

## API Endpoints

### Global Search
- **POST** `/api/local/search`
  - Body: `{ query, types?, limit?, offset?, sortBy?, sortOrder?, dateRange?, tags? }`
  - Returns: `{ total, items, facets, took }`

### Entity-Specific Search
- **POST** `/api/local/search/cards`
- **POST** `/api/local/search/tasks`
- **POST** `/api/local/search/files`
- **POST** `/api/local/search/chat`
  - Body: `{ query, ...options }`
  - Returns: `{ results: [...] }`

### Index Management
- **POST** `/api/local/search/reindex`
  - Body: `{ entityType? }`
- **GET** `/api/local/search/stats`
  - Returns: `{ totalDocuments, indexSize, lastIndexTime, entityCounts }`

### Search Suggestions
- **GET** `/api/local/search/suggestions?prefix=xxx&limit=10`
  - Returns: `{ suggestions: [...] }`

### Search History
- **GET** `/api/local/search/history?limit=20`
  - Returns: `{ history: [...] }`
- **DELETE** `/api/local/search/history`
  - Clears search history

## Search Options

```typescript
interface SearchOptions {
  types?: Array<'card' | 'task' | 'file' | 'chat'>;
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'date' | 'name';
  sortOrder?: 'asc' | 'desc';
  dateRange?: {
    start?: number;
    end?: number;
  };
  tags?: string[];
}
```

## Search Results

```typescript
interface SearchResults {
  total: number;
  items: SearchResultItem[];
  facets: {
    types: Array<{ type: string; count: number }>;
    tags: Array<{ tag: string; count: number }>;
  };
  took: number; // milliseconds
}

interface SearchResultItem {
  type: 'card' | 'task' | 'file' | 'chat';
  id: string;
  title: string;
  snippet: string;
  score: number;
  highlights: string[];
  metadata: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}
```

## Implementation Details

### Backend (Java)
- Uses SQLite FTS5 for full-text search on cards and tasks
- Uses LIKE queries for file and chat search
- BM25 ranking algorithm for relevance scoring
- Text highlighting with `<mark>` tags
- Multi-language support via FTS5 unicode61 tokenizer

### Frontend (JavaScript)
- Mock mode for development without backend
- Fetch API for HTTP communication
- Promise-based async API
- Type definitions via JSDoc for IDE support

## Development

The service defaults to mock mode for development. To test with real data:

1. Ensure the database has FTS tables:
   ```sql
   CREATE VIRTUAL TABLE cards_fts USING fts5(title, content, tags);
   CREATE VIRTUAL TABLE tasks_fts USING fts5(title, content, tags);
   ```

2. Initialize the search service with real API:
   ```javascript
   const searchService = new SearchService({ useMock: false });
   ```

3. Test search:
   ```javascript
   const results = await searchService.search('test query');
   ```
