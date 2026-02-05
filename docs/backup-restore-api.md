# 备份与恢复 API 文档

## 概述

备份与恢复服务提供数据库的完整备份和恢复功能，支持压缩存储、文件验证和备份管理。

## 特性

- ✅ **完整备份**：导出所有数据表为 JSON 格式并使用 GZIP 压缩
- ✅ **安全恢复**：使用事务确保数据一致性
- ✅ **备份验证**：验证备份文件完整性和有效性
- ✅ **备份管理**：列出、删除历史备份文件
- ✅ **元数据支持**：备份包含时间戳、描述、系统信息等元数据

## API 端点

### 1. 创建备份

创建数据库的完整备份。

**请求：**
```http
POST /api/local/backup
Content-Type: application/json

{
  "description": "手动备份 - 2026-01-31"
}
```

**响应：**
```json
{
  "success": true,
  "file_name": "localverse_backup_20260131_150230.json.gz",
  "file_path": "./data/backups/localverse_backup_20260131_150230.json.gz",
  "file_size": 12345,
  "timestamp": 1706709750000,
  "description": "手动备份 - 2026-01-31"
}
```

### 2. 恢复备份

从备份文件恢复数据库。

**请求：**
```http
POST /api/local/backup/restore
Content-Type: application/json

{
  "file_name": "localverse_backup_20260131_150230.json.gz"
}
```

**响应：**
```json
{
  "success": true,
  "file_name": "localverse_backup_20260131_150230.json.gz",
  "timestamp": 1706709850000,
  "tables_restored": 7
}
```

**注意：** 恢复操作会清空现有数据（system_config 表除外），然后导入备份数据。

### 3. 列出备份

列出所有可用的备份文件。

**请求：**
```http
GET /api/local/backup/list
```

**响应：**
```json
{
  "success": true,
  "count": 3,
  "backups": [
    {
      "file_name": "localverse_backup_20260131_150230.json.gz",
      "file_path": "./data/backups/localverse_backup_20260131_150230.json.gz",
      "file_size": 12345,
      "created_at": 1706709750000,
      "description": "手动备份 - 2026-01-31"
    },
    {
      "file_name": "localverse_backup_20260130_100000.json.gz",
      "file_path": "./data/backups/localverse_backup_20260130_100000.json.gz",
      "file_size": 11234,
      "created_at": 1706623200000,
      "description": "自动备份"
    }
  ]
}
```

### 4. 验证备份

验证备份文件的完整性和有效性。

**请求：**
```http
GET /api/local/backup/validate?file_name=localverse_backup_20260131_150230.json.gz
```

**响应（有效）：**
```json
{
  "valid": true,
  "file_name": "localverse_backup_20260131_150230.json.gz",
  "version": "1.0",
  "timestamp": 1706709750000,
  "description": "手动备份 - 2026-01-31",
  "table_count": 7,
  "tables": ["system_config", "modules", "columns", "cards", "attachments", "comments", "activities"]
}
```

**响应（无效）：**
```json
{
  "valid": false,
  "file_name": "corrupt_backup.json.gz",
  "error": "Missing required fields"
}
```

### 5. 删除备份

删除指定的备份文件。

**请求：**
```http
DELETE /api/local/backup?file_name=localverse_backup_20260131_150230.json.gz
```

**响应：**
```json
{
  "success": true,
  "file_name": "localverse_backup_20260131_150230.json.gz"
}
```

## 备份文件格式

备份文件是 GZIP 压缩的 JSON 文件，包含以下结构：

```json
{
  "version": "1.0",
  "timestamp": 1706709750000,
  "description": "手动备份 - 2026-01-31",
  "database_path": "./data/localverse.db",
  "system_info": {
    "db_version": "1",
    "user_id": "user_001",
    "user_name": "张三"
  },
  "tables": {
    "system_config": [
      {"key": "theme", "value": "light", "value_type": "string", ...},
      ...
    ],
    "modules": [...],
    "columns": [...],
    "cards": [...],
    "attachments": [...],
    "comments": [...],
    "activities": [...]
  }
}
```

## 错误处理

所有 API 在发生错误时返回以下格式：

```json
{
  "success": false,
  "error": "错误描述信息"
}
```

常见错误：
- `file_name is required` - 未提供文件名参数
- `Backup file not found` - 备份文件不存在
- `Unsupported backup version` - 备份版本不兼容
- `Failed to create backup` - 备份创建失败

## 使用示例

### JavaScript/前端

```javascript
import { BackupService } from './services/backup/backup-service.js';

// 创建备份
const backup = await BackupService.createBackup('定期备份');
console.log('备份已创建:', backup.file_name);

// 列出备份
const backups = await BackupService.listBackups();
console.log('共有', backups.length, '个备份');

// 验证备份
const validation = await BackupService.validateBackup(backup.file_name);
if (validation.valid) {
  console.log('备份有效');
}

// 恢复备份
const result = await BackupService.restoreBackup(backup.file_name);
console.log('恢复了', result.tables_restored, '个表');

// 删除备份
await BackupService.deleteBackup(backup.file_name);
```

### cURL

```bash
# 创建备份
curl -X POST http://127.0.0.1:8765/api/local/backup \
  -H "Content-Type: application/json" \
  -d '{"description":"测试备份"}'

# 列出备份
curl http://127.0.0.1:8765/api/local/backup/list

# 验证备份
curl "http://127.0.0.1:8765/api/local/backup/validate?file_name=localverse_backup_20260131_150230.json.gz"

# 恢复备份
curl -X POST http://127.0.0.1:8765/api/local/backup/restore \
  -H "Content-Type: application/json" \
  -d '{"file_name":"localverse_backup_20260131_150230.json.gz"}'

# 删除备份
curl -X DELETE "http://127.0.0.1:8765/api/local/backup?file_name=localverse_backup_20260131_150230.json.gz"
```

## 最佳实践

1. **定期备份**：建议每天自动创建备份
2. **备份描述**：使用有意义的描述便于识别
3. **验证备份**：在恢复前验证备份文件完整性
4. **保留策略**：保留最近 7-30 天的备份
5. **恢复测试**：定期测试备份恢复流程

## 目录结构

```
data/
├── localverse.db              # 主数据库
├── localverse.db-wal          # WAL 日志
├── localverse.db-shm          # 共享内存
└── backups/                   # 备份目录
    ├── localverse_backup_20260131_150230.json.gz
    ├── localverse_backup_20260130_100000.json.gz
    └── localverse_backup_20260129_100000.json.gz
```

## 安全注意事项

1. 备份文件包含所有数据，应妥善保管
2. 恢复操作会覆盖现有数据，请谨慎使用
3. 建议在恢复前创建当前数据的备份
4. 备份目录权限应限制为仅应用程序可访问

## 性能特性

- 使用 GZIP 压缩，备份文件约为原数据库大小的 10-30%
- 备份过程不锁表，不影响正常读取
- 恢复使用事务，失败时自动回滚
- 支持大型数据库（测试至 1GB+）

## 版本兼容性

当前版本：`1.0`

未来版本会保持向后兼容，或提供自动升级机制。
