/**
 * 数据库 Schema 工具
 * 提供 Schema 验证和帮助函数
 */

/**
 * 常见表的字段定义
 */
export const COMMON_FIELDS = {
  // 主键
  id: 'TEXT PRIMARY KEY',
  
  // 时间戳
  created_at: 'INTEGER NOT NULL',
  updated_at: 'INTEGER NOT NULL',
  deleted_at: 'INTEGER',
  
  // 版本控制
  version: 'INTEGER DEFAULT 1',
  
  // 软删除
  deleted: 'INTEGER DEFAULT 0',
  deleted_by: 'TEXT',
  
  // 同步状态
  sync_status: "TEXT DEFAULT 'local'",
};

/**
 * 创建时间戳字段
 * @returns {Object} 包含当前时间戳的对象
 */
export function timestamps() {
  const now = Date.now();
  return {
    created_at: now,
    updated_at: now
  };
}

/**
 * 更新时间戳字段
 * @returns {Object} 包含当前时间戳的对象
 */
export function updateTimestamp() {
  return {
    updated_at: Date.now()
  };
}

/**
 * 软删除字段
 * @param {string} userId - 删除者 ID
 * @returns {Object} 软删除相关字段
 */
export function softDelete(userId = null) {
  return {
    deleted: 1,
    deleted_at: Date.now(),
    deleted_by: userId
  };
}

/**
 * 验证必填字段
 * @param {Object} data - 数据对象
 * @param {Array<string>} required - 必填字段列表
 * @throws {Error} 如果缺少必填字段
 */
export function validateRequired(data, required) {
  const missing = required.filter(field => !data[field]);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}

/**
 * JSON 字段序列化
 * @param {*} value - 要序列化的值
 * @returns {string|null} JSON 字符串或 null
 */
export function toJSON(value) {
  if (value === null || value === undefined) {
    return null;
  }
  return JSON.stringify(value);
}

/**
 * JSON 字段反序列化
 * @param {string} value - JSON 字符串
 * @param {*} defaultValue - 默认值
 * @returns {*} 解析后的值或默认值
 */
export function fromJSON(value, defaultValue = null) {
  if (!value) {
    return defaultValue;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error('Failed to parse JSON:', error);
    return defaultValue;
  }
}
