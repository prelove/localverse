/**
 * UUID v7 生成器
 * 基于时间戳的 UUID，适合用作数据库主键
 * 格式：xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx
 * - 前 48 位：Unix 时间戳（毫秒）
 * - 接下来 12 位：随机数
 * - 版本位：7
 * - 变体位：10
 * - 最后 62 位：随机数
 */

/**
 * 生成 UUID v7
 * @returns {string} UUID v7 格式的字符串
 */
export function uuidv7() {
  const timestamp = Date.now();
  const timestampHex = timestamp.toString(16).padStart(12, '0');
  
  const randomBytes = new Uint8Array(10);
  crypto.getRandomValues(randomBytes);
  const randomHex = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // UUID v7 格式
  return [
    timestampHex.slice(0, 8),                                                      // 时间戳高位
    timestampHex.slice(8, 12),                                                     // 时间戳低位
    '7' + randomHex.slice(0, 3),                                                   // 版本 7 + 随机
    ((parseInt(randomHex.slice(3, 4), 16) & 0x3) | 0x8).toString(16) + randomHex.slice(4, 7),  // 变体 + 随机
    randomHex.slice(7, 19)                                                         // 随机
  ].join('-');
}

/**
 * 生成带前缀的 ID
 * @param {string} prefix - ID 前缀（可选）
 * @returns {string} 带前缀的 UUID 或纯 UUID
 */
export function generateId(prefix = '') {
  const id = uuidv7();
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * 从 UUID v7 中提取时间戳
 * @param {string} uuid - UUID v7 字符串
 * @returns {number} Unix 时间戳（毫秒）
 */
export function extractTimestamp(uuid) {
  const timestampHex = uuid.replace(/-/g, '').slice(0, 12);
  return parseInt(timestampHex, 16);
}
