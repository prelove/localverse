/**
 * 备份与恢复服务
 * 
 * 提供数据备份、恢复和管理功能
 */

const API_BASE = 'http://127.0.0.1:8765/api/local/backup';

export class BackupService {
  /**
   * 创建备份
   * @param {string} description - 备份描述
   * @returns {Promise<Object>} 备份结果
   */
  static async createBackup(description = '') {
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ description })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create backup');
      }

      return await response.json();
    } catch (error) {
      console.error('Create backup error:', error);
      throw error;
    }
  }

  /**
   * 恢复备份
   * @param {string} fileName - 备份文件名
   * @returns {Promise<Object>} 恢复结果
   */
  static async restoreBackup(fileName) {
    try {
      const response = await fetch(`${API_BASE}/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ file_name: fileName })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to restore backup');
      }

      return await response.json();
    } catch (error) {
      console.error('Restore backup error:', error);
      throw error;
    }
  }

  /**
   * 列出所有备份
   * @returns {Promise<Array>} 备份列表
   */
  static async listBackups() {
    try {
      const response = await fetch(`${API_BASE}/list`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to list backups');
        }

      const result = await response.json();
      return result.backups || [];
    } catch (error) {
      console.error('List backups error:', error);
      throw error;
    }
  }

  /**
   * 验证备份文件
   * @param {string} fileName - 备份文件名
   * @returns {Promise<Object>} 验证结果
   */
  static async validateBackup(fileName) {
    try {
      const response = await fetch(`${API_BASE}/validate?file_name=${encodeURIComponent(fileName)}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to validate backup');
      }

      return await response.json();
    } catch (error) {
      console.error('Validate backup error:', error);
      throw error;
    }
  }

  /**
   * 删除备份
   * @param {string} fileName - 备份文件名
   * @returns {Promise<Object>} 删除结果
   */
  static async deleteBackup(fileName) {
    try {
      const response = await fetch(`${API_BASE}?file_name=${encodeURIComponent(fileName)}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete backup');
      }

      return await response.json();
    } catch (error) {
      console.error('Delete backup error:', error);
      throw error;
    }
  }

  /**
   * 格式化文件大小
   * @param {number} bytes - 字节数
   * @returns {string} 格式化后的大小
   */
  static formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * 格式化时间戳
   * @param {number} timestamp - Unix 毫秒时间戳
   * @returns {string} 格式化后的时间
   */
  static formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}

export default BackupService;
