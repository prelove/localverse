/**
 * VersionManager - Manages card version history
 */
class VersionManager {
  constructor(wikiService) {
    this.wikiService = wikiService;
  }

  /**
   * Save a new version of a card
   * @param {string} cardId - Card ID
   * @param {string} title - Card title
   * @param {string} content - Card content
   * @param {number} version - Version number
   * @param {string} createdBy - User ID
   */
  async saveVersion(cardId, title, content, version, createdBy) {
    await this.wikiService.saveVersion(cardId, title, content, version, createdBy);
  }

  /**
   * Get all versions for a card
   * @param {string} cardId - Card ID
   * @returns {Array} Array of versions
   */
  async getVersions(cardId) {
    return await this.wikiService.getVersions(cardId);
  }

  /**
   * Get a specific version
   * @param {string} versionId - Version ID
   * @returns {Object} Version object
   */
  async getVersion(versionId) {
    return await this.wikiService.getVersion(versionId);
  }

  /**
   * Restore a card to a specific version
   * @param {string} cardId - Card ID
   * @param {string} versionId - Version ID to restore
   * @param {string} updatedBy - User ID
   * @returns {Object} Updated card
   */
  async restoreVersion(cardId, versionId, updatedBy) {
    const version = await this.getVersion(versionId);
    if (!version) {
      throw new Error('Version not found');
    }

    const card = await this.wikiService.updateCard(cardId, {
      title: version.title,
      content: version.content,
      updatedBy
    });

    return card;
  }

  /**
   * Compare two versions
   * @param {string} versionId1 - First version ID
   * @param {string} versionId2 - Second version ID
   * @returns {Object} Comparison result
   */
  async compareVersions(versionId1, versionId2) {
    const [v1, v2] = await Promise.all([
      this.getVersion(versionId1),
      this.getVersion(versionId2)
    ]);

    if (!v1 || !v2) {
      throw new Error('One or both versions not found');
    }

    return {
      version1: v1,
      version2: v2,
      titleChanged: v1.title !== v2.title,
      contentChanged: v1.content !== v2.content,
      timeDiff: v2.created_at - v1.created_at
    };
  }

  /**
   * Get version diff statistics
   * @param {string} content1 - First content
   * @param {string} content2 - Second content
   * @returns {Object} Diff statistics
   */
  getDiffStats(content1, content2) {
    const lines1 = (content1 || '').split('\n');
    const lines2 = (content2 || '').split('\n');

    return {
      linesAdded: Math.max(0, lines2.length - lines1.length),
      linesRemoved: Math.max(0, lines1.length - lines2.length),
      charsAdded: Math.max(0, content2.length - content1.length),
      charsRemoved: Math.max(0, content1.length - content2.length)
    };
  }

  /**
   * Format version for display
   * @param {Object} version - Version object
   * @returns {Object} Formatted version
   */
  formatVersion(version) {
    return {
      id: version.id,
      version: version.version,
      title: version.title,
      contentPreview: this.getContentPreview(version.content),
      createdAt: new Date(version.created_at).toLocaleString(),
      createdBy: version.created_by || 'Unknown'
    };
  }

  /**
   * Get content preview
   * @param {string} content - Full content
   * @param {number} maxLength - Maximum length
   * @returns {string} Preview text
   */
  getContentPreview(content, maxLength = 100) {
    if (!content) return '';
    
    const text = content.replace(/[#*`\[\]]/g, '').trim();
    
    if (text.length <= maxLength) {
      return text;
    }
    
    return text.slice(0, maxLength) + '...';
  }

  /**
   * Clean up old versions (keep only recent N versions)
   * @param {string} cardId - Card ID
   * @param {number} keepCount - Number of versions to keep
   */
  async cleanupOldVersions(cardId, keepCount = 10) {
    const versions = await this.getVersions(cardId);
    
    if (versions.length <= keepCount) {
      return;
    }

    // Sort by version number (descending)
    versions.sort((a, b) => b.version - a.version);
    
    // Delete versions beyond keepCount
    const toDelete = versions.slice(keepCount);
    
    for (const version of toDelete) {
      await this.wikiService.db.exec(
        'DELETE FROM wiki_card_history WHERE id = ?',
        [version.id]
      );
    }
  }
}

export default VersionManager;
